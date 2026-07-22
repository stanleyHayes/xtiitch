package authapp

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// Self-serve plan-change errors (Pricing Book §7). Distinct sentinels so the
// dashboard can explain precisely why a change was refused.
var (
	// ErrPlanChangeSamePlan: the target is the current plan, or a same-priced tier
	// (classification by monthly_fee_minor yields neither an upgrade nor a downgrade).
	ErrPlanChangeSamePlan = errors.New("subscription is already on that plan")
	// ErrPlanChangeBillingInactive: an upgrade that owes a prorated charge needs an
	// active recurring authorization on file, but the subscription has none (e.g. a
	// free plan or one that never completed billing setup). They must set up billing
	// via the activation flow first.
	ErrPlanChangeBillingInactive = errors.New("active recurring billing is required to upgrade")
	// ErrPlanChangeChargeFailed: the prorated upgrade charge did not succeed, so the
	// plan was NOT switched (money-critical: never grant entitlements unpaid).
	ErrPlanChangeChargeFailed = errors.New("the prorated upgrade charge did not succeed")
)

// ChangeSubscriptionPlanCommand is an owner/admin request to move to another plan.
type ChangeSubscriptionPlanCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	PlanCode    string
	CallbackURL string
}

// ChangeSubscriptionPlanResult reports the outcome of a plan change: an UPGRADE is
// applied immediately (Immediate = true) and may carry a prorated charge; a
// DOWNGRADE is scheduled for the next renewal (Immediate = false, EffectiveAt is
// the period end) with no charge or refund now.
type ChangeSubscriptionPlanResult struct {
	PlanCode string
	// Immediate is true for an applied upgrade, false for a scheduled downgrade.
	Immediate bool
	// ProratedChargeMinor is the amount charged now for the remainder of the current
	// period (upgrade). Zero for a downgrade or when the prorated difference rounds
	// to zero.
	ProratedChargeMinor int64
	// EffectiveAt is when the new plan takes effect: now for an upgrade, the current
	// period end for a scheduled downgrade.
	EffectiveAt time.Time
	// AuthorizationURL is present when an upgrade needs an interactive Paystack
	// checkout (for example, a mobile-money subscription has no reusable card).
	AuthorizationURL string
}

// ChangeSubscriptionPlan moves a business between plans self-serve (Pricing Book
// §7). It classifies by monthly_fee_minor: a strictly higher fee is an UPGRADE
// (switch + prorated charge now, entitlements immediate); a strictly lower fee is a
// DOWNGRADE (parked to apply at the next renewal, no mid-cycle refund or entitlement
// change); an equal fee is refused. Owner/admin only.
func (s Service) ChangeSubscriptionPlan(ctx context.Context, cmd ChangeSubscriptionPlanCommand) (ChangeSubscriptionPlanResult, error) {
	if err := authorizeBusinessUserManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	planCode := strings.ToLower(strings.TrimSpace(cmd.PlanCode))
	if planCode == "" {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrInvalidInput
	}

	subscription, err := s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
	if err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	// A canceled subscription must re-activate through the normal flow, not swap plans.
	if subscription.Status == "canceled" {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrInvalidInput
	}

	target, err := s.businesses.GetPlanByCode(ctx, planCode)
	if err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	effectiveSubscription := effectiveSubscriptionPlan(subscription)
	if strings.EqualFold(strings.TrimSpace(target.Code), strings.TrimSpace(effectiveSubscription.PlanCode)) {
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeSamePlan
	}

	switch {
	case target.MonthlyFeeMinor > effectiveSubscription.MonthlyFeeMinor:
		return s.upgradeSubscriptionPlan(ctx, effectiveSubscription, target, cmd.CallbackURL)
	case target.MonthlyFeeMinor < effectiveSubscription.MonthlyFeeMinor:
		return s.downgradeSubscriptionPlan(ctx, effectiveSubscription, target)
	default:
		// Same monthly fee → neither an upgrade nor a downgrade.
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeSamePlan
	}
}

// effectiveSubscriptionPlan returns the paid-up plan used to classify and price
// a change. GetBusinessSubscription deliberately exposes pending-target pricing
// in its primary fields so activation can charge that target; a retry must still
// compare against the current/free plan or it is incorrectly rejected as a
// same-plan change.
func effectiveSubscriptionPlan(sub ports.BusinessSubscriptionRecord) ports.BusinessSubscriptionRecord {
	if strings.TrimSpace(sub.EffectivePlanCode) == "" {
		return sub
	}
	sub.PlanCode = sub.EffectivePlanCode
	sub.MonthlyFeeMinor = sub.EffectiveMonthlyFeeMinor
	sub.QuarterlyRenewalMinor = sub.EffectiveQuarterlyRenewalMinor
	sub.YearlyRenewalMinor = sub.EffectiveYearlyRenewalMinor
	return sub
}

// upgradeSubscriptionPlan switches to the higher plan immediately and charges the
// prorated difference for the remainder of the current period. The plan is switched
// only after a successful charge (or when nothing is owed).
//
//nolint:gocognit // card recovery and interactive MoMo fallback are intentionally fail-closed in one money-critical transaction flow
func (s Service) upgradeSubscriptionPlan(
	ctx context.Context,
	sub ports.BusinessSubscriptionRecord,
	target ports.PlanPricingRecord,
	callbackURL string,
) (ChangeSubscriptionPlanResult, error) {
	now := s.clock.Now()
	if s.payments == nil {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrForbidden
	}
	if !subscriptionPeriodActive(sub, now) {
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeBillingInactive
	}
	// Proration is computed against the cadence renewal figures, matching how the
	// recurring sweep bills each renewal. A non-billable cadence has no figure.
	cadence, err := normalizeBillingCadence(sub.BillingCadence)
	if err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	currentRenewal := renewalFigureMinor(sub, cadence)
	newRenewal := targetRenewalFigureMinor(target, cadence)
	if newRenewal <= 0 {
		return ChangeSubscriptionPlanResult{}, authdomain.ErrInvalidInput
	}

	proration := prorationChargeMinor(currentRenewal, newRenewal, sub.CurrentPeriodStart, sub.CurrentPeriodEnd, now)

	// Nothing owed (difference rounds to zero, or the period is over): switch now
	// without a charge.
	if proration <= 0 {
		if err := s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
			BusinessID: sub.BusinessID,
			NewPlanID:  target.PlanID,
		}); err != nil {
			return ChangeSubscriptionPlanResult{}, err
		}
		return ChangeSubscriptionPlanResult{PlanCode: target.Code, Immediate: true, ProratedChargeMinor: 0, EffectiveAt: now}, nil
	}

	// A mobile-money subscription has no reusable authorization. Park the target
	// plan and open a standard Paystack checkout for the prorated amount instead;
	// the callback applies the upgrade only after provider verification.
	if sub.BillingMode != "recurring" || strings.TrimSpace(sub.ProviderSubscriptionRef) == "" {
		if strings.TrimSpace(callbackURL) == "" {
			return ChangeSubscriptionPlanResult{}, ErrPlanChangeBillingInactive
		}
		grossProration := s.subscriptionChargeTotal(ctx, proration)
		ref := fmt.Sprintf("xtsub_upgrade_checkout_%s_%s_%d_%d_%d", sub.SubscriptionID, target.Code,
			sub.CurrentPeriodStart.Unix(), grossProration, now.UnixNano())
		checkout, err := s.payments.InitializeAuthorization(ctx, ports.InitializeAuthorizationInput{
			BusinessID: sub.BusinessID, CustomerEmail: strings.TrimSpace(sub.OwnerEmail),
			AmountMinor: grossProration, Currency: "GHS", Reference: ref,
			CallbackURL: strings.TrimSpace(callbackURL),
		})
		if err != nil || strings.TrimSpace(checkout.RedirectURL) == "" {
			return ChangeSubscriptionPlanResult{}, ErrPlanChangeChargeFailed
		}
		// Park only after Paystack accepted the checkout. If initialization fails,
		// leaving a pending target would make the current subscription look as if it
		// were already on that plan and strand the owner's retry.
		if err := s.businesses.SetPendingPlanUpgrade(ctx, sub.BusinessID, target.PlanID); err != nil {
			return ChangeSubscriptionPlanResult{}, err
		}
		return ChangeSubscriptionPlanResult{
			PlanCode: target.Code, Immediate: false, ProratedChargeMinor: grossProration,
			EffectiveAt: now, AuthorizationURL: strings.TrimSpace(checkout.RedirectURL),
		}, nil
	}

	// VAT applies to the prorated top-up too, plus the §4.1 Transaction fee
	// grossed up over package + VAT — so the charge, the booked invoice, and the
	// reported amount agree and Xtiitch nets the proration + VAT exactly.
	grossProration := s.subscriptionChargeTotal(ctx, proration)

	// Deterministic ref keyed on the subscription + target plan + period start, so a
	// double submit / retry reuses it: Paystack dedupes the charge and the invoice
	// insert no-ops — mirroring the activation charge's idempotency.
	ref := "xtsub_upgrade_" + sub.SubscriptionID.String() + "_" + target.Code + "_" + strconv.FormatInt(sub.CurrentPeriodStart.Unix(), 10)

	// RECOVERY: a prior attempt may have charged the card but then failed to switch
	// the plan (leaving the tenant paid-but-not-upgraded). Because charge_authorization
	// REJECTS a duplicate reference, a naive retry would be stuck forever. So first
	// verify the deterministic ref: if it already succeeded, skip the (duplicate)
	// charge and go straight to applying the upgrade, which is idempotent on the ref.
	verify, verifyErr := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: ref})
	if verifyErr == nil && verify.Succeeded && verify.AmountMinor < grossProration {
		// A successful provider status is insufficient if the amount does not cover
		// this upgrade. Never grant higher entitlements on an old/partial charge.
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeChargeFailed
	}
	if verifyErr != nil || !verify.Succeeded {
		charge, chargeErr := s.payments.ChargeAuthorization(ctx, ports.ChargeAuthorizationInput{
			BusinessID:        sub.BusinessID,
			AuthorizationCode: strings.TrimSpace(sub.ProviderSubscriptionRef),
			CustomerEmail:     strings.TrimSpace(sub.OwnerEmail),
			AmountMinor:       grossProration,
			Currency:          "GHS",
			Reference:         ref,
		})
		if chargeErr != nil || !strings.EqualFold(strings.TrimSpace(charge.Status), "success") ||
			charge.AmountMinor < grossProration {
			// Do not switch the plan on a non-success charge: entitlements never go
			// unpaid. The deterministic ref lets the owner safely retry.
			return ChangeSubscriptionPlanResult{}, ErrPlanChangeChargeFailed
		}
	}

	if err := s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
		BusinessID:  sub.BusinessID,
		NewPlanID:   target.PlanID,
		AmountMinor: grossProration,
		Currency:    "GHS",
		ChargeRef:   ref,
	}); err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}

	return ChangeSubscriptionPlanResult{PlanCode: target.Code, Immediate: true, ProratedChargeMinor: grossProration, EffectiveAt: now}, nil
}

// downgradeSubscriptionPlan parks the change to apply at the next renewal. It never
// refunds or changes entitlements mid-cycle.
func (s Service) downgradeSubscriptionPlan(
	ctx context.Context,
	sub ports.BusinessSubscriptionRecord,
	target ports.PlanPricingRecord,
) (ChangeSubscriptionPlanResult, error) {
	if !subscriptionPeriodActive(sub, s.clock.Now()) {
		return ChangeSubscriptionPlanResult{}, ErrPlanChangeBillingInactive
	}
	if err := s.businesses.SchedulePlanDowngrade(ctx, ports.SchedulePlanDowngradeInput{
		BusinessID:  sub.BusinessID,
		NewPlanID:   target.PlanID,
		EffectiveAt: sub.CurrentPeriodEnd,
	}); err != nil {
		return ChangeSubscriptionPlanResult{}, err
	}
	return ChangeSubscriptionPlanResult{
		PlanCode: target.Code, Immediate: false,
		ProratedChargeMinor: 0, EffectiveAt: sub.CurrentPeriodEnd,
	}, nil
}

// subscriptionPeriodActive ensures a plan change is anchored to a real, paid
// billing window. An expired/zero window must be renewed first; otherwise an
// upgrade could switch for free or a downgrade could be scheduled in the past.
func subscriptionPeriodActive(sub ports.BusinessSubscriptionRecord, now time.Time) bool {
	return !sub.CurrentPeriodStart.IsZero() &&
		sub.CurrentPeriodEnd.After(sub.CurrentPeriodStart) &&
		sub.CurrentPeriodEnd.After(now)
}

// targetRenewalFigureMinor returns the target plan's FULL renewal figure for the
// cadence (minor units). Zero when unset for that cadence.
func targetRenewalFigureMinor(target ports.PlanPricingRecord, cadence string) int64 {
	switch cadence {
	case "quarterly":
		return int64(target.QuarterlyRenewalMinor)
	case "yearly":
		return int64(target.YearlyRenewalMinor)
	default:
		return 0
	}
}

// prorationChargeMinor computes the prorated upgrade difference to charge now:
//
//	ceil( (newRenewal - currentRenewal) * timeRemaining / totalPeriodTime )
//
// All in GHS minor units (pesewas). It guards against a non-positive difference, a
// zero/negative period, and a period already elapsed — any of which yields 0 (no
// charge). Remaining time is clamped to the full period so an odd clock never
// charges more than the full difference. Seconds, rather than whole days, ensure
// the final partial day of an active period never becomes a free upgrade.
func prorationChargeMinor(currentRenewal, newRenewal int64, periodStart, periodEnd, now time.Time) int64 {
	diff := newRenewal - currentRenewal
	if diff <= 0 {
		return 0
	}
	totalSeconds := int64(periodEnd.Sub(periodStart) / time.Second)
	if totalSeconds <= 0 {
		return 0
	}
	remainingSeconds := int64(periodEnd.Sub(now) / time.Second)
	if remainingSeconds <= 0 {
		return 0
	}
	if remainingSeconds > totalSeconds {
		remainingSeconds = totalSeconds
	}
	// ceil(diff * remainingDays / totalDays) with integer math, then up to a whole
	// cedi: Xtiitch bills whole cedis only ("Whole cedis in all display and
	// billing", Pricing Book §7; checklist #14 names proration specifically). The
	// stored figures are already whole; a proration is computed, so it is one of
	// the few places a pesewa can appear. Ceil rather than nearest so a genuine
	// upgrade of a few hours still bills a cedi instead of rounding to nothing.
	numerator := diff * remainingSeconds
	return money.CeilToWholeCedi((numerator + totalSeconds - 1) / totalSeconds)
}
