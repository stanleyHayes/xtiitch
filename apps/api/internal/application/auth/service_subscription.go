package authapp

import (
	"context"
	"fmt"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// SubscriptionVATPolicy reports the configured VAT rate (basis points) and
// treatment applied to subscription charges, so the public /plans endpoint can
// disclose it. A zero rate means VAT is disabled.
func (s Service) SubscriptionVATPolicy() (rateBps int, inclusive bool) {
	return s.vatRateBps, s.vatInclusive
}

// grossSubscriptionCharge applies the configured subscription VAT to a base
// grossSubscriptionCharge applies the configured subscription VAT to a base
// (net or listed) charge and returns the gross amount to charge and record. With
// VAT disabled (rate 0) or inclusive pricing the base is returned unchanged; with
// added-at-checkout pricing VAT is added on top. It is the single place the
// subscription money path grosses a charge for VAT.
func (s Service) grossSubscriptionCharge(baseMinor int64) int64 {
	return money.ApplyVAT(baseMinor, s.vatRateBps, s.vatInclusive).GrossMinor
}

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
		// at least once. A paid plan that has never paid (a fresh 'trialing' signup
		// OR a grandfathered 'active' account that never set up billing) is NOT
		// activated: it sees the banner and is blocked from paid write-actions.
		Activated: sub.MonthlyFeeMinor == 0 || sub.FirstPurchaseConsumed,
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
		return sub.MonthlyFeeMinor
	}
}

type InitializeSubscriptionAuthorizationCommand struct {
	Scope       common.TenantScope
	CallbackURL string
	// PlanCode is the TARGET plan the owner is activating/upgrading to. When set and
	// it differs from the current plan (e.g. a free store upgrading to a paid plan),
	// the subscription is switched to it before billing so the fee gate and first
	// charge use the target plan — mirroring how a fresh paid signup is seeded on
	// its plan before payment. Empty keeps the current plan (a re-activation).
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
	if subscription.Status == "canceled" {
		return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
	}
	// Target plan: when the owner is activating/upgrading to a specific plan (e.g. a
	// FREE store choosing a paid plan), switch the subscription onto that plan first
	// so the fee gate and the callback's first charge use the target plan's figures.
	// Without this, a free-plan store (fee 0) can never start billing — it fails the
	// fee gate below, and change-plan refuses it as "billing inactive" — a deadlock.
	// The switch mirrors a fresh paid signup (plan seeded before payment; the
	// non-payment sweep reverts an abandoned activation).
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
		// Only switch on a strict UPGRADE here (target fee > current). A downgrade
		// must go through ChangeSubscriptionPlan (parked to renewal), never an
		// immediate mid-cycle switch via activation.
		if target.MonthlyFeeMinor <= subscription.MonthlyFeeMinor {
			return SubscriptionAuthorizationLink{}, authdomain.ErrInvalidInput
		}
		if err := s.businesses.ApplyImmediatePlanUpgrade(ctx, ports.ApplyImmediatePlanUpgradeInput{
			BusinessID: subscription.BusinessID,
			NewPlanID:  target.PlanID,
			// AmountMinor 0: no proration invoice here — the FIRST period is charged
			// on the Paystack callback (VerifySubscriptionAuthorization).
		}); err != nil {
			return SubscriptionAuthorizationLink{}, err
		}
		// Re-read so the fee gate + downstream figures reflect the target plan.
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
			if err := s.activateDiscountedWithoutCharge(ctx, cmd.Scope, subscription, cadence, activation.Ref, *outcome); err != nil {
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
	gross := s.grossSubscriptionCharge(chargeMinor)
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
	if subscription.MonthlyFeeMinor <= 0 || subscription.Status == "canceled" {
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
	result, err := s.payments.VerifyAuthorization(ctx, ports.VerifyAuthorizationInput{Reference: reference})
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	customerRef := strings.TrimSpace(result.CustomerCode)
	authRef := strings.TrimSpace(result.AuthorizationCode)
	if !result.Succeeded {
		// The checkout was abandoned or the payment failed; leave the subscription
		// unactivated so the tenant can retry. Report it as not-yet-paid.
		status := subscription.Status
		if status == "active" {
			status = "past_due"
		}
		return SubscriptionAuthorizationResult{
			SubscriptionID: subscription.SubscriptionID,
			BusinessID:     subscription.BusinessID,
			Status:         status,
			BillingMode:    "recurring",
		}, nil
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
	activation, err := s.businesses.PrepareSubscriptionActivationCharge(ctx, subscription.BusinessID)
	if err != nil {
		return SubscriptionAuthorizationResult{}, err
	}
	if activation.ShouldCharge {
		if err := s.bookFirstPeriodPaid(ctx, cmd.Scope, subscription, cadence, activation.Ref, result.AmountMinor); err != nil {
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
