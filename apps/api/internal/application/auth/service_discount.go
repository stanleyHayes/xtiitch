package authapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// Subscription discount-code checkout errors. They are distinct sentinels so the
// dashboard can show a precise, non-silent message for an invalid/ineligible code
// (a bad code must never be quietly ignored — the Pricing Book §4).
var (
	// ErrDiscountCodeInvalid: unknown, inactive, archived, or discounts unavailable.
	ErrDiscountCodeInvalid = errors.New("discount code is invalid")
	// ErrDiscountCodeExpired: outside the code's [valid_from, valid_until] window.
	ErrDiscountCodeExpired = errors.New("discount code is expired or not yet valid")
	// ErrDiscountCodeIneligible: plan/cadence not eligible, or first-purchase-only
	// on an account that already consumed its first purchase.
	ErrDiscountCodeIneligible = errors.New("discount code is not eligible for this plan")
	// ErrDiscountCodeExhausted: total or per-account redemption cap reached.
	ErrDiscountCodeExhausted = errors.New("discount code has reached its redemption limit")
)

// Self-serve plan-change errors (Pricing Book §7). Distinct sentinels so the
// captureSubscriptionDiscount validates an optional discount code at checkout and,
// when valid, records a PENDING redemption keyed to the subscription and returns
// the computed outcome so the caller can price the first-period checkout (a code
// REPLACES the intro figure; a free_period/full discount needs no checkout at all).
// The verify step reads the pending redemption back and marks it applied once the
// first period is paid. A blank code is a no-op (nil outcome); any non-blank but
// invalid/ineligible code is rejected (never silently ignored).
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) captureSubscriptionDiscount(
	ctx context.Context,
	scope common.TenantScope,
	sub ports.BusinessSubscriptionRecord,
	cadence string,
	rawCode string,
) (*discountOutcome, error) {
	code := normalizeDiscountCode(rawCode)
	if code == "" {
		return nil, nil
	}
	if s.discounts == nil {
		return nil, ErrDiscountCodeInvalid
	}
	record, err := s.discounts.FindActiveDiscountCodeByCode(ctx, code)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil, ErrDiscountCodeInvalid
		}
		return nil, err
	}
	now := s.clock.Now()
	if record.ValidFrom != nil && now.Before(*record.ValidFrom) {
		return nil, ErrDiscountCodeExpired
	}
	// valid_until is exclusive: at or after it the code is expired.
	if record.ValidUntil != nil && !now.Before(*record.ValidUntil) {
		return nil, ErrDiscountCodeExpired
	}
	// Empty eligible_plans/eligible_cadences mean "all".
	if len(record.EligiblePlans) > 0 && !containsFold(record.EligiblePlans, sub.PlanCode) {
		return nil, ErrDiscountCodeIneligible
	}
	if len(record.EligibleCadences) > 0 && !containsFold(record.EligibleCadences, cadence) {
		return nil, ErrDiscountCodeIneligible
	}
	if record.FirstPurchaseOnly && sub.FirstPurchaseConsumed {
		return nil, ErrDiscountCodeIneligible
	}
	// A code is computed against the plan's FULL renewal figure; refuse when unset.
	renewal := renewalFigureMinor(sub, cadence)
	if renewal <= 0 {
		return nil, ErrDiscountCodeIneligible
	}
	outcome := computeDiscountOutcome(record.DiscountType, record.DiscountValue, renewal)
	// Enforce the per-account + total caps and insert the pending redemption
	// ATOMICALLY under an advisory lock on the code. This closes the check-then-act
	// race where two concurrent checkouts of a last-slot code both pass a separate
	// applied-only count and over-redeem; the repo counts applied + recent-pending
	// under the lock, so the second caller is refused before it can pay.
	if _, err := s.discounts.CreateRedemptionWithinCaps(ctx, scope, ports.CreateDiscountRedemptionInput{
		DiscountCodeID: record.DiscountCodeID,
		BusinessID:     sub.BusinessID,
		SubscriptionID: sub.SubscriptionID,
		AccountKey:     sub.BusinessID.String(),
		PlanCode:       sub.PlanCode,
		Cadence:        cadence,
		DiscountMinor:  outcome.DiscountMinor,
		Status:         "pending",
	}, record.MaxPerAccount, record.MaxRedemptionsTotal); err != nil {
		if errors.Is(err, ports.ErrDiscountRedemptionCapReached) {
			return nil, ErrDiscountCodeExhausted
		}
		return nil, err
	}
	return &outcome, nil
}

// activateDiscountedWithoutCharge activates a subscription whose captured discount
// collects NOTHING at checkout — a free_period starts a free window, a full
// (>=100%) discount books a zero paid invoice on the normal cadence — then flips
// the pending redemption to 'applied'. Used at initialize so these codes never open
// a zero-amount Paystack checkout (which Paystack would reject). The activation
// carries BOTH the ref and the period anchor it was derived from, so the window's
// start always matches the ref a re-entry re-derives.
func (s Service) activateDiscountedWithoutCharge(
	ctx context.Context,
	scope common.TenantScope,
	sub ports.BusinessSubscriptionRecord,
	cadence string,
	activation ports.SubscriptionActivationCharge,
	outcome discountOutcome,
) error {
	pending, err := s.discounts.FindPendingRedemption(ctx, scope, sub.SubscriptionID)
	if err != nil {
		return err
	}
	// A free_period covers the code's month count; a full (100% / fixed >= renewal)
	// discount covers exactly this cadence's period. Both collect NOTHING, so both
	// start a free window via ActivateFreePeriodBilling, which books a ZERO
	// already-paid invoice as the receipt for that window (migration 000092 admits
	// it; the table used to require amount_minor > 0, so every free-period
	// redemption failed on the CHECK).
	freeMonths := outcome.FreeMonths
	if !outcome.FreePeriod {
		freeMonths = cadenceMonths(cadence)
	}
	if err := s.discounts.ActivateFreePeriodBilling(ctx, scope, ports.ActivateFreePeriodInput{
		BusinessID:  sub.BusinessID,
		ChargeRef:   activation.Ref,
		PeriodStart: activation.PeriodStart,
		Currency:    "GHS",
		FreeMonths:  freeMonths,
	}); err != nil {
		return err
	}
	return s.discounts.MarkRedemptionApplied(ctx, scope, ports.MarkDiscountRedemptionAppliedInput{
		RedemptionID:  pending.RedemptionID,
		DiscountMinor: outcome.DiscountMinor,
	})
}

// cadenceMonths is the number of months a billing cadence covers.
func cadenceMonths(cadence string) int {
	switch cadence {
	case "quarterly":
		return 3
	case "yearly":
		return 12
	default:
		return 1
	}
}

// bookFirstPeriodPaid records the first period as PAID after a standard checkout
// (the customer already paid at checkout.paystack.com — never re-charged here) and
// flips any captured discount to 'applied'. paidMinor is the amount Paystack
// actually collected. Idempotent: the paid-invoice insert no-ops on a repeat ref.
// The activation carries BOTH the ref and the period anchor it was derived from,
// so the booked period always matches the ref a retried callback re-derives.
func (s Service) bookFirstPeriodPaid(
	ctx context.Context,
	scope common.TenantScope,
	sub ports.BusinessSubscriptionRecord,
	cadence string,
	activation ports.SubscriptionActivationCharge,
	paidMinor int64,
) error {
	if err := s.businesses.RecordSubscriptionActivationPayment(ctx, ports.RecordSubscriptionActivationPaymentInput{
		BusinessID:     sub.BusinessID,
		AmountMinor:    paidMinor,
		Currency:       "GHS",
		ChargeRef:      activation.Ref,
		PeriodStart:    activation.PeriodStart,
		BillingCadence: cadence,
	}); err != nil {
		return err
	}
	if s.discounts == nil {
		return nil
	}
	// A partial discount that went through checkout leaves a pending redemption;
	// mark it applied now that the first period is paid. Free/full discounts were
	// already applied at initialize (no checkout), so none is pending here.
	pending, err := s.discounts.FindPendingRedemption(ctx, scope, sub.SubscriptionID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil
		}
		return err
	}
	// A merchant may abandon one plan checkout and choose another. The older
	// pending redemption must not be applied to the later plan/cadence merely
	// because it belongs to the same subscription row.
	if !strings.EqualFold(strings.TrimSpace(pending.PlanCode), strings.TrimSpace(sub.PlanCode)) ||
		!strings.EqualFold(strings.TrimSpace(pending.Cadence), cadence) {
		return nil
	}
	outcome := computeDiscountOutcome(pending.DiscountType, pending.DiscountValue, renewalFigureMinor(sub, cadence))
	return s.discounts.MarkRedemptionApplied(ctx, scope, ports.MarkDiscountRedemptionAppliedInput{
		RedemptionID:  pending.RedemptionID,
		DiscountMinor: outcome.DiscountMinor,
	})
}

// normalizeDiscountCode upper-cases and trims a discount code to match the stored
// canonical form (the DB constraint requires codes be upper-case).
func normalizeDiscountCode(raw string) string {
	return strings.ToUpper(strings.TrimSpace(raw))
}

// discountOutcome is the applied result of a discount code at activation.
type discountOutcome struct {
	// ChargeMinor is the amount to charge the card now (0 for free_period / a full
	// discount).
	ChargeMinor int64
	// DiscountMinor is the money given away (renewal - charge), for attribution.
	DiscountMinor int64
	FreePeriod    bool
	FreeMonths    int
}

// computeDiscountOutcome applies a discount code against the plan's FULL renewal
// figure for the cadence (a code REPLACES the intro figure). Amounts are pesewas.
func computeDiscountOutcome(discountType string, value int, renewalMinor int64) discountOutcome {
	switch discountType {
	case "percentage":
		reduction := renewalMinor * int64(value) / 100 // floor
		if reduction > renewalMinor {
			reduction = renewalMinor
		}
		// Round the CHARGE to a whole cedi, then derive the discount from it, so
		// the two always reconcile to the renewal figure exactly. Xtiitch bills
		// whole cedis only ("no pesewa decimals anywhere", Pricing Book §1/§7), and
		// a percentage of a charm-priced figure lands on a pesewa more often than
		// not: 20% off GHS 297 is GHS 237.60.
		charge := money.RoundToWholeCedi(renewalMinor - reduction)
		if charge > renewalMinor {
			charge = renewalMinor
		}
		return discountOutcome{ChargeMinor: charge, DiscountMinor: renewalMinor - charge}
	case "fixed":
		// Rounded for the same reason as the percentage branch: the admin's field
		// takes GHS with pesewas, so a code entered as GHS 12.50 off a charm-priced
		// renewal bills GHS 134.50 -- a pesewa figure the book forbids ("no pesewa
		// decimals anywhere", §1/§7). The discount is then derived from the rounded
		// charge so the two reconcile to the renewal exactly.
		charge := money.RoundToWholeCedi(renewalMinor - int64(value))
		if charge < 0 {
			charge = 0
		}
		if charge > renewalMinor {
			charge = renewalMinor
		}
		return discountOutcome{ChargeMinor: charge, DiscountMinor: renewalMinor - charge}
	case "free_period":
		return discountOutcome{ChargeMinor: 0, DiscountMinor: renewalMinor, FreePeriod: true, FreeMonths: value}
	default:
		// Unknown type (guarded by the DB CHECK): apply no discount.
		return discountOutcome{ChargeMinor: renewalMinor, DiscountMinor: 0}
	}
}

// renewalFigureMinor returns the plan's FULL renewal figure for the cadence
// (minor units) — the base a discount is computed against. Zero when unset.
func renewalFigureMinor(sub ports.BusinessSubscriptionRecord, cadence string) int64 {
	switch cadence {
	case "quarterly":
		return int64(sub.QuarterlyRenewalMinor)
	case "yearly":
		return int64(sub.YearlyRenewalMinor)
	default:
		return 0
	}
}
