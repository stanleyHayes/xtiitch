package authapp

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Subscription discount-code checkout errors. They are distinct sentinels so the
// ListPublicPlans returns the active plan catalogue for the unauthenticated
// signup plan picker.
func (s Service) ListPublicPlans(ctx context.Context) ([]ports.PublicPlanRecord, error) {
	return s.businesses.ListActivePlans(ctx)
}

// SubscriptionActivation reports whether a paid plan has paid (activated) its
// first invoice, powering the dashboard activation banner/page. A paid plan that
// has never paid is 'trialing' (Activated=false); a free plan or a paid plan that
// has paid is 'active' (Activated=true). AmountDueMinor is the first-purchase
// figure the owner must pay to activate.
type SubscriptionActivation struct {
	Activated bool
	Status    string
	PlanCode  string
	PlanName  string
	// AmountDueMinor is the first-purchase charge (minor units) needed to activate.
	AmountDueMinor int
}

// GetSubscriptionActivation resolves the tenant's activation state from its
// current subscription. activated = status != "trialing".
func (s Service) GetSubscriptionActivation(ctx context.Context, scope common.TenantScope) (SubscriptionActivation, error) {
	sub, err := s.businesses.GetBusinessSubscription(ctx, scope.BusinessID)
	if err != nil {
		return SubscriptionActivation{}, err
	}
	return SubscriptionActivation{
		// Activated = a free plan, or a paid plan that has actually been charged
		// at least once, with no upgrade awaiting payment. A paid plan that has
		// never paid (a fresh 'trialing' signup OR a grandfathered 'active'
		// account that never set up billing) and a payment-pending upgrade are
		// NOT activated: they see the banner and are blocked from paid
		// write-actions.
		Activated: (sub.MonthlyFeeMinor == 0 || sub.FirstPurchaseConsumed) && sub.PendingUpgradePlanID.IsZero(),
		Status:    sub.Status,
		PlanCode:  sub.PlanCode,
		// The subscription record carries the plan code, not its display name; the
		// dashboard shows the code as the plan label here.
		PlanName:       sub.PlanCode,
		AmountDueMinor: firstPurchaseAmountDue(sub),
	}, nil
}

// firstPurchaseAmountDue picks the first-purchase charge for the subscription's
// chosen cadence (the Pricing Book intro figure), falling back to the monthly fee
// when the cadence is the legacy/unset 'monthly'.
func firstPurchaseAmountDue(sub ports.BusinessSubscriptionRecord) int {
	switch sub.BillingCadence {
	case "quarterly":
		return sub.QuarterlyFirstMinor
	case "yearly":
		return sub.YearlyFirstMinor
	default:
		// Monthly billing is not offered under the Pricing Book, and the legacy
		// monthly_fee_minor is a nominal placeholder (e.g. GHS 1). Before the owner
		// picks a cadence on the billing screen, show the quarterly first-purchase
		// price — the lower of the two real activation options — not the placeholder.
		return sub.QuarterlyFirstMinor
	}
}

type InitializeSubscriptionAuthorizationCommand struct {
	Scope       common.TenantScope
	CallbackURL string
	// PlanCode is the TARGET plan the owner is activating/upgrading to. When set and
	// it differs from the current plan (e.g. a free store upgrading to a paid plan),
	// the plan is parked as PAYMENT-PENDING so the fee gate and first charge use the
	// target plan — while entitlements keep resolving from the current paid-up plan
	// until Paystack verifies the payment (verified in the callback). Empty keeps
	// the current plan (a re-activation).
	PlanCode string
	// BillingCadence is the owner's chosen cadence: 'quarterly' or 'yearly'.
	// Monthly billing is not offered under the Pricing Book, so an empty or
	// 'monthly' value is rejected for a paid plan.
	BillingCadence string
	// Code is an optional subscription discount code. When present it is validated
	// at checkout and, if valid, captured as a pending redemption that the later
	// verify step applies to the first charge (a code REPLACES the intro figure).
	Code string
}

type SubscriptionAuthorizationLink struct {
	BusinessID   common.ID
	BusinessName string
	OwnerEmail   string
	RedirectURL  string
	AccessCode   string
	Reference    string
	// Activated is true when the plan was activated immediately with no Paystack
	// checkout — a free_period or full (>=100%) discount collects nothing, and a
	// period already paid needs nothing. The dashboard shows success (no redirect).
	Activated bool
}

type VerifySubscriptionAuthorizationCommand struct {
	Scope     common.TenantScope
	Reference string
}

type SubscriptionAuthorizationResult struct {
	SubscriptionID          common.ID
	BusinessID              common.ID
	Status                  string
	BillingMode             string
	ProviderCustomerRef     string
	ProviderSubscriptionRef string
}

// InitializeSubscriptionAuthorization starts a Paystack recurring-billing
// authorization for the signed-in tenant's paid plan and returns the redirect
// link. Free plans (no monthly fee) need no authorization.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) InitializeSubscriptionAuthorization(
	ctx context.Context,
	cmd InitializeSubscriptionAuthorizationCommand,
) (SubscriptionAuthorizationLink, error) {
	if cmd.Scope.BusinessID.IsZero() {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	if s.payments == nil {
		return SubscriptionAuthorizationLink{}, authdomain.ErrForbidden
	}
	// A paid plan must be billed quarterly or yearly — reject monthly/empty.
	cadence, err := normalizeBillingCadence(cmd.BillingCadence)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	subscription, err := s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	// A canceled subscription may re-subscribe here: "Re-subscribe restores access"
	// (Pricing Book §7 dunning). Dunning downgrades a lapsed business to Free and
	// keeps its store, orders and customers, so coming back is a supported path,
	// not an error -- and this is the "normal flow" that ChangeSubscriptionPlan
	// points a canceled subscription at, so refusing here left it with nowhere to
	// go at all.
	//
	// It costs the full renewal figure, never the intro: first_purchase_consumed
	// was set when they first paid and is never un-set, which is exactly what §7's
	// "After cancel + resubscribe, do not re-grant intro" asks for.
	// Target plan: when the owner is activating/upgrading to a specific plan (e.g. a
	// FREE store choosing a paid plan), park that plan as PAYMENT-PENDING so the fee
	// gate and the callback's first charge use the target plan's figures. Without
	// this, a free-plan store (fee 0) can never start billing — it fails the fee
	// gate below, and change-plan refuses it as "billing inactive" — a deadlock.
	//
	// The pending park changes NO entitlements: businesses.plan_id stays on the
	// current paid-up plan, so plan features/limits keep resolving from it until
	// Paystack VERIFIES the payment, and only VerifySubscriptionAuthorization
	// applies the switch (a paid plan's features never unlock on an unconfirmed
	// or failed payment). The profile shows the pending plan as "pending
	// activation" via GetSubscriptionActivation in the meantime.
	if targetCode := strings.ToLower(strings.TrimSpace(cmd.PlanCode)); targetCode != "" &&
		!strings.EqualFold(targetCode, strings.TrimSpace(subscription.PlanCode)) {
		target, err := s.businesses.GetPlanByCode(ctx, targetCode)
		if err != nil {
			return SubscriptionAuthorizationLink{}, err
		}
		if target.MonthlyFeeMinor <= 0 {
			// The target must be a paid plan; you don't "set up billing" for free.
			return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
		}
		// Only park a strict UPGRADE here (target fee > current). A downgrade must
		// go through ChangeSubscriptionPlan (parked to renewal), never an immediate
		// mid-cycle switch via activation.
		if target.MonthlyFeeMinor <= effectiveSubscriptionPlan(subscription).MonthlyFeeMinor {
			return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
		}
		if err := s.businesses.SetPendingPlanUpgrade(ctx, subscription.BusinessID, target.PlanID); err != nil {
			return SubscriptionAuthorizationLink{}, err
		}
		// Re-read so the fee gate + downstream figures reflect the pending target plan.
		subscription, err = s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
		if err != nil {
			return SubscriptionAuthorizationLink{}, err
		}
	}
	if subscription.MonthlyFeeMinor <= 0 {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Validate and capture an optional discount code BEFORE persisting the cadence
	// or minting the Paystack link, so an invalid/ineligible code fails the checkout
	// outright (never silently ignored) and never leaves a half-started billing
	// setup. A valid code is recorded as a PENDING redemption keyed to this
	// subscription and returns the outcome that prices the first-period checkout.
	outcome, err := s.captureSubscriptionDiscount(ctx, cmd.Scope, subscription, cadence, cmd.Code)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	// Persist the chosen cadence now, before the redirect: the callback that drives
	// verify/booking carries only the payment reference, so the cadence must already
	// be on the subscription to bill the right figure and set the right next billing
	// date — and to compute the deterministic per-period activation reference.
	if err := s.businesses.SetSubscriptionBillingCadence(ctx, subscription.BusinessID, cadence); err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	ownerEmail, err := normalizeEmail(subscription.OwnerEmail)
	if err != nil {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Deterministic per-period reference. It anchors the paid-invoice booking so
	// repeated callbacks (double submit, retries) never double-book, and its
	// ShouldCharge flag short-circuits a redundant checkout once the period is paid.
	activation, err := s.businesses.PrepareSubscriptionActivationCharge(ctx, subscription.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	if !activation.ShouldCharge {
		// This period is already paid (e.g. a prior checkout completed); nothing to
		// collect — report it as activated so the dashboard shows success.
		return SubscriptionAuthorizationLink{
			BusinessID:   subscription.BusinessID,
			BusinessName: subscription.BusinessName,
			OwnerEmail:   ownerEmail,
			Activated:    true,
		}, nil
	}
	// A captured discount REPLACES the intro figure. A free_period or full (>=100%)
	// discount collects nothing, so activate immediately with no Paystack checkout;
	// otherwise the checkout is priced at the discounted figure.
	chargeMinor := activationChargeMinor(subscription, cadence)
	if outcome != nil {
		if outcome.FreePeriod || outcome.ChargeMinor <= 0 {
			// The discount settled the first period in full, so a parked target plan
			// is applied now — same rule as a verified payment, with nothing to collect.
			if err := s.applyPendingPlanUpgrade(ctx, subscription); err != nil {
				return SubscriptionAuthorizationLink{}, err
			}
			if err := s.activateDiscountedWithoutCharge(ctx, cmd.Scope, subscription, cadence, activation, *outcome); err != nil {
				return SubscriptionAuthorizationLink{}, err
			}
			return SubscriptionAuthorizationLink{
				BusinessID:   subscription.BusinessID,
				BusinessName: subscription.BusinessName,
				OwnerEmail:   ownerEmail,
				Activated:    true,
			}, nil
		}
		chargeMinor = outcome.ChargeMinor
	}
	if chargeMinor <= 0 {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Open a STANDARD Paystack checkout for the first period. The customer pays now
	// by MoMo or card; a card also yields a reusable authorization that the recurring
	// sweep charges each renewal (MoMo yields none — the sweep re-prompts). The
	// reference is unique per attempt (Paystack rejects a reused reference) but the
	// callback re-derives the deterministic per-period reference to book idempotently.
	// §4.1: the checkout total carries VAT and the grossed-up Transaction fee on
	// top of the package figure, so Xtiitch nets the exact table figure.
	gross := s.subscriptionChargeTotal(ctx, chargeMinor)
	checkoutRef := fmt.Sprintf("%s_%d", activation.Ref, s.clock.Now().Unix())
	result, err := s.payments.InitializeAuthorization(ctx, ports.InitializeAuthorizationInput{
		BusinessID:    subscription.BusinessID,
		CustomerEmail: ownerEmail,
		CallbackURL:   strings.TrimSpace(cmd.CallbackURL),
		AmountMinor:   gross,
		Currency:      "GHS",
		Reference:     checkoutRef,
	})
	if err != nil {
		return SubscriptionAuthorizationLink{}, err
	}
	if strings.TrimSpace(result.RedirectURL) == "" || strings.TrimSpace(result.Reference) == "" {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	return SubscriptionAuthorizationLink{
		BusinessID:   subscription.BusinessID,
		BusinessName: subscription.BusinessName,
		OwnerEmail:   ownerEmail,
		RedirectURL:  result.RedirectURL,
		AccessCode:   result.AccessCode,
		Reference:    result.Reference,
	}, nil
}

// VerifySubscriptionAuthorization confirms the Paystack authorization the tenant
// completed and flips their subscription to recurring billing; the existing
// recurring-charge sweep then bills them each period.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) VerifySubscriptionAuthorization(
	ctx context.Context,
	cmd VerifySubscriptionAuthorizationCommand,
) (SubscriptionAuthorizationResult, error) {
	if cmd.Scope.BusinessID.IsZero() {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	if s.payments == nil {
		return SubscriptionAuthorizationResult{}, authdomain.ErrForbidden
	}
	reference := strings.TrimSpace(cmd.Reference)
	if reference == "" || len([]rune(reference)) > 160 || strings.ContainsAny(reference, " \t\r\n") {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	subscription, err := s.businesses.GetBusinessSubscription(ctx, cmd.Scope.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	// Interactive mid-cycle upgrade checkout (used when the current payment was
	// mobile money and therefore supplied no reusable authorization). Its amount is
	// embedded in a tenant/plan/period-bound reference minted by ChangePlan; verify
	// that exact amount before switching entitlements.
	if strings.HasPrefix(reference, "xtsub_upgrade_checkout_") {
		return s.verifyInteractivePlanUpgrade(ctx, subscription, reference)
	}
	// Canceled is NOT refused here, for the same reason it is not refused at
	// initialize: "Re-subscribe restores access" (Pricing Book §7). These are the
	// two halves of one payment flow, and refusing only the second half is the
	// worst of both -- initialize opens a live Paystack checkout, the owner pays,
	// and then verify throws their money away without activating anything.
	if subscription.MonthlyFeeMinor <= 0 {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	// The cadence was persisted when the authorization link was created; a paid
	// plan cannot be activated without a billable (quarterly/yearly) cadence.
	cadence, err := normalizeBillingCadence(subscription.BillingCadence)
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	// Sanity-check the plan is configured for this cadence. The first period was
	// already priced and PAID at the standard checkout; here we only confirm and
	// book it, so the amount booked is what Paystack actually collected — never
	// re-charged (which would double-bill).
	if activationChargeMinor(subscription, cadence) <= 0 {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	// Resolve the deterministic reference for THIS subscription period before
	// asking Paystack about the callback reference. A successful transaction from
	// another order, plan, or subscription must never activate this plan merely
	// because the browser supplied its reference.
	activation, err := s.businesses.PrepareSubscriptionActivationCharge(ctx, subscription.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	if !strings.HasPrefix(reference, activation.Ref+"_") {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	result, err := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: reference})
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	customerRef := strings.TrimSpace(result.CustomerCode)
	authRef := strings.TrimSpace(result.AuthorizationCode)
	if !result.Succeeded {
		// The checkout was abandoned or the payment failed; leave the subscription
		// unactivated so the tenant can retry. Any payment-pending plan upgrade
		// stays PARKED — entitlements never unlock on an unconfirmed/failed
		// payment. Report it as not-yet-paid.
		status := subscription.Status
		if status == "active" {
			status = "past_due"
		}
		return SubscriptionAuthorizationResult{
			SubscriptionID: subscription.SubscriptionID,
			BusinessID:     subscription.BusinessID,
			Status:         status,
			BillingMode:    subscription.BillingMode,
		}, nil
	}
	// A provider "success" is not enough on its own: for an unpaid period the
	// verified amount must cover the exact checkout total that this plan/cadence
	// (and any matching captured discount) required. This closes the entitlement
	// hole where an older, cheaper successful transaction could be replayed after
	// parking a higher plan. A period already recorded paid is an idempotent
	// callback and needs no second amount comparison.
	if activation.ShouldCharge {
		dueMinor, dueErr := s.subscriptionActivationCheckoutDue(ctx, cmd.Scope, subscription, cadence)
		if dueErr != nil {
			return SubscriptionAuthorizationResult{}, dueErr
		}
		if result.AmountMinor < dueMinor {
			status := subscription.Status
			if status == "active" {
				status = "past_due"
			}
			return SubscriptionAuthorizationResult{
				SubscriptionID: subscription.SubscriptionID,
				BusinessID:     subscription.BusinessID,
				Status:         status,
				BillingMode:    subscription.BillingMode,
			}, nil
		}
	}
	// The payment is Paystack-VERIFIED: apply a parked plan upgrade now (and only
	// now). This is the moment entitlements move to the target plan — the business
	// plan switches and the pending fields clear in one transaction.
	if err := s.applyPendingPlanUpgrade(ctx, subscription); err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	// Flip the subscription to recurring billing so the renewal sweep picks it up —
	// ALWAYS, even for mobile money (which yields no reusable authorization). Storing
	// the channel lets the sweep silently auto-charge a card at renewal but fall back
	// to a re-pay reminder for mobile money; without this a paid MoMo signup would be
	// left billing_mode='manual' and silently skipped by the sweep forever.
	channel := normalizeAuthorizationChannel(result.Channel)
	if authRef == "" && channel == "" {
		// No reusable authorization and an unknown channel would look card-like to the
		// sweep and get charged with an empty auth (a guaranteed failure). This is the
		// mobile-money shape, so mark it as such to route it to reminders instead.
		channel = "mobile_money"
	}
	if err := s.businesses.ActivateRecurringBilling(ctx, ports.ActivateRecurringBillingInput{
		BusinessID:              subscription.BusinessID,
		ProviderCustomerRef:     customerRef,
		ProviderSubscriptionRef: authRef,
		ProviderChannel:         channel,
	}); err != nil {
		return SubscriptionAuthorizationResult{}, err
	}

	// Book the paid first period. IDEMPOTENT: PrepareSubscriptionActivationCharge
	// returns a deterministic per-period ref and whether the period is still unpaid,
	// so a repeated callback (double submit, client retry, callback re-hit) re-uses
	// the same ref and the paid-invoice insert no-ops. The amount booked is what
	// Paystack collected at checkout.
	if activation.ShouldCharge {
		if err := s.bookFirstPeriodPaid(ctx, cmd.Scope, subscription, cadence, activation, result.AmountMinor); err != nil {
			return SubscriptionAuthorizationResult{}, err
		}
	}

	return SubscriptionAuthorizationResult{
		SubscriptionID:          subscription.SubscriptionID,
		BusinessID:              subscription.BusinessID,
		Status:                  "active",
		BillingMode:             "recurring",
		ProviderCustomerRef:     customerRef,
		ProviderSubscriptionRef: authRef,
	}, nil
}

func (s Service) verifyInteractivePlanUpgrade(
	ctx context.Context,
	subscription ports.BusinessSubscriptionRecord,
	reference string,
) (SubscriptionAuthorizationResult, error) {
	if !subscriptionPeriodActive(subscription, s.clock.Now()) {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	prefix := fmt.Sprintf("xtsub_upgrade_checkout_%s_%s_%d_", subscription.SubscriptionID,
		subscription.PlanCode, subscription.CurrentPeriodStart.Unix())
	if !strings.HasPrefix(reference, prefix) {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	parts := strings.Split(strings.TrimPrefix(reference, prefix), "_")
	if len(parts) != 2 {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	dueMinor, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || dueMinor <= 0 {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	if _, err := strconv.ParseInt(parts[1], 10, 64); err != nil {
		return SubscriptionAuthorizationResult{}, authdomain.ErrInvalidInput
	}
	verified, err := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: reference})
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	if !verified.Succeeded || verified.AmountMinor < dueMinor {
		return SubscriptionAuthorizationResult{
			SubscriptionID: subscription.SubscriptionID, BusinessID: subscription.BusinessID,
			Status: "past_due", BillingMode: subscription.BillingMode,
		}, nil
	}
	// A repeated callback sees the pending target already cleared and the target
	// plan current. Treat that as an idempotent success; otherwise apply the parked
	// target exactly once, booking the verified proration under this provider ref.
	if !subscription.PendingUpgradePlanID.IsZero() {
		if err := s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
			BusinessID: subscription.BusinessID, NewPlanID: subscription.PendingUpgradePlanID,
			AmountMinor: verified.AmountMinor, Currency: "GHS", ChargeRef: reference,
		}); err != nil {
			return SubscriptionAuthorizationResult{}, err
		}
	}
	channel := normalizeAuthorizationChannel(verified.Channel)
	authRef := strings.TrimSpace(verified.AuthorizationCode)
	if authRef == "" && channel == "" {
		channel = "mobile_money"
	}
	if err := s.businesses.ActivateRecurringBilling(ctx, ports.ActivateRecurringBillingInput{
		BusinessID: subscription.BusinessID, ProviderCustomerRef: strings.TrimSpace(verified.CustomerCode),
		ProviderSubscriptionRef: authRef, ProviderChannel: channel,
	}); err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	return SubscriptionAuthorizationResult{
		SubscriptionID: subscription.SubscriptionID, BusinessID: subscription.BusinessID,
		Status: "active", BillingMode: "recurring",
		ProviderCustomerRef: strings.TrimSpace(verified.CustomerCode), ProviderSubscriptionRef: authRef,
	}, nil
}

// subscriptionActivationCheckoutDue reconstructs the amount the standard
// checkout was opened for. A pending discount only belongs to this attempt when
// its plan and cadence still match; stale pending redemptions from an earlier
// plan choice cannot reduce a later upgrade's payment requirement.
func (s Service) subscriptionActivationCheckoutDue(
	ctx context.Context,
	scope common.TenantScope,
	sub ports.BusinessSubscriptionRecord,
	cadence string,
) (int64, error) {
	chargeMinor := activationChargeMinor(sub, cadence)
	if s.discounts != nil {
		pending, err := s.discounts.FindPendingRedemption(ctx, scope, sub.SubscriptionID)
		switch {
		case err == nil && strings.EqualFold(strings.TrimSpace(pending.PlanCode), strings.TrimSpace(sub.PlanCode)) &&
			strings.EqualFold(strings.TrimSpace(pending.Cadence), cadence):
			chargeMinor = computeDiscountOutcome(
				pending.DiscountType,
				pending.DiscountValue,
				renewalFigureMinor(sub, cadence),
			).ChargeMinor
		case err != nil && !errors.Is(err, ports.ErrNotFound):
			return 0, err
		}
	}
	if chargeMinor <= 0 {
		return 0, authdomain.ErrInvalidInput
	}
	return s.subscriptionChargeTotal(ctx, chargeMinor), nil
}

// applyPendingPlanUpgrade switches the business onto a plan that was parked as
// payment-pending at checkout initialize. Callers reach it only once money is
// settled — a Paystack-verified payment, or a discount that settled the period
// in full — so paid-plan entitlements never unlock unpaid. A no-op when nothing
// is parked.
func (s Service) applyPendingPlanUpgrade(ctx context.Context, sub ports.BusinessSubscriptionRecord) error {
	if sub.PendingUpgradePlanID.IsZero() {
		return nil
	}
	return s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
		BusinessID: sub.BusinessID,
		NewPlanID:  sub.PendingUpgradePlanID,
		// AmountMinor 0: no proration invoice here — the first period was already
		// collected at checkout and is booked separately.
	})
}

// normalizeBillingCadence validates a paid-plan billing cadence. Under the
// Pricing Book only quarterly and yearly are billable; monthly or an empty value
// is rejected as invalid input.
func normalizeBillingCadence(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "quarterly":
		return "quarterly", nil
	case "yearly":
		return "yearly", nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

// activationChargeMinor returns the exact stored figure to charge for the given
// cadence: the one-time INTRO figure while the account has not consumed its first
// purchase, otherwise the FULL renewal figure. Amounts are the verbatim Pricing
// Book figures carried on the subscription record — never computed live.
func activationChargeMinor(sub ports.BusinessSubscriptionRecord, cadence string) int64 {
	switch cadence {
	case "quarterly":
		if sub.FirstPurchaseConsumed {
			return int64(sub.QuarterlyRenewalMinor)
		}
		return int64(sub.QuarterlyFirstMinor)
	case "yearly":
		if sub.FirstPurchaseConsumed {
			return int64(sub.YearlyRenewalMinor)
		}
		return int64(sub.YearlyFirstMinor)
	default:
		return 0
	}
}

// normalizeAuthorizationChannel lower-cases and trims a Paystack authorization
// channel ('card', 'mobile_money', …) for stable comparison, matching how the
// recurring sweep reads it back to decide silent auto-charge vs re-pay reminder.
func normalizeAuthorizationChannel(channel string) string {
	return strings.ToLower(strings.TrimSpace(channel))
}

// containsFold reports whether target matches any value case-insensitively.
func containsFold(values []string, target string) bool {
	trimmedTarget := strings.TrimSpace(target)
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), trimmedTarget) {
			return true
		}
	}
	return false
}
