package authapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// A percentage code applies against the plan's FULL renewal figure (NOT the intro)
// and reduces the activation charge accordingly, then flips the captured
// redemption to applied with the money-given-away amount.
func TestVerifySubscriptionAuthorizationAppliesPercentageDiscountOffRenewal(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "quarterly",
			FirstPurchaseConsumed: false,
			QuarterlyFirstMinor:   11800, // intro (must NOT be charged)
			QuarterlyRenewalMinor: 14700, // renewal (discount base)
		},
	}
	discounts := &fakeDiscountRepository{
		code: ports.SubscriptionDiscountCode{
			DiscountCodeID: "code-1",
			Code:           "SAVE10",
			DiscountType:   "percentage",
			DiscountValue:  10,
			MaxPerAccount:  1,
		},
		hasPending: true,
		pending: ports.PendingDiscountRedemption{
			RedemptionID:  "redemption-1",
			DiscountType:  "percentage",
			DiscountValue: 10,
			PlanCode:      "growth",
			Cadence:       "quarterly",
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newDiscountTestService(businesses, payments, discounts)

	// Initialize prices the checkout at the DISCOUNTED figure (a code REPLACES the
	// intro): 10% off the 14700 renewal is 13230, rounded to the whole cedi 13200
	// ("no pesewa decimals anywhere", Pricing Book §1/§7) — and NOT the 11800 intro.
	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "quarterly", Code: "SAVE10",
	})
	if err != nil {
		t.Fatalf("initialize: unexpected error: %v", err)
	}
	if payments.initInput.AmountMinor != 13463 {
		t.Fatalf("expected the discounted checkout amount plus §4.1 fees (13200 -> 13463), got %d", payments.initInput.AmountMinor)
	}

	// Verify books the paid discounted amount and flips the redemption to applied.
	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: link.Reference,
	})
	if err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if result.Status != "active" {
		t.Fatalf("expected active subscription, got %q", result.Status)
	}
	if payments.chargeInput.AuthorizationCode != "" {
		t.Fatalf("the discounted first period must NOT be re-charged, got %+v", payments.chargeInput)
	}
	if businesses.activationPayment.AmountMinor != 13463 {
		t.Fatalf("expected the activation payment booked at the discounted amount, got %d", businesses.activationPayment.AmountMinor)
	}
	if len(discounts.marked) != 1 || discounts.marked[0].DiscountMinor != 1500 {
		t.Fatalf("expected the redemption marked applied with a 1500 discount, got %+v", discounts.marked)
	}
	if discounts.marked[0].RedemptionID != "redemption-1" {
		t.Fatalf("expected the captured redemption flipped to applied, got %q", discounts.marked[0].RedemptionID)
	}
}

// A free-period code charges nothing at activation and starts a free window
// (next billing = now + value months), recording the full renewal as the discount.
func TestVerifySubscriptionAuthorizationAppliesFreePeriodDiscount(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "yearly",
			FirstPurchaseConsumed: false,
			YearlyFirstMinor:      89100,
			YearlyRenewalMinor:    118800,
		},
	}
	discounts := &fakeDiscountRepository{
		code: ports.SubscriptionDiscountCode{
			DiscountCodeID: "code-1",
			Code:           "FREE3",
			DiscountType:   "free_period",
			DiscountValue:  3,
			MaxPerAccount:  1,
		},
		hasPending: true,
		pending: ports.PendingDiscountRedemption{
			RedemptionID:  "redemption-1",
			DiscountType:  "free_period",
			DiscountValue: 3,
			PlanCode:      "growth",
			Cadence:       "yearly",
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newDiscountTestService(businesses, payments, discounts)

	// A free-period code collects nothing, so initialize activates it immediately
	// with NO Paystack checkout (a zero-amount checkout would be rejected) and marks
	// the redemption applied — there is no verify step to run.
	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly", Code: "FREE3",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !link.Activated || link.RedirectURL != "" {
		t.Fatalf("a free-period code must activate immediately with no checkout link, got %+v", link)
	}
	if payments.initInput.AmountMinor != 0 {
		t.Fatalf("a free-period code must not open a checkout, but priced %d", payments.initInput.AmountMinor)
	}
	if len(discounts.freePeriods) != 1 || discounts.freePeriods[0].FreeMonths != 3 {
		t.Fatalf("expected a 3-month free-period activation, got %+v", discounts.freePeriods)
	}
	if len(discounts.marked) != 1 || discounts.marked[0].DiscountMinor != 118800 {
		t.Fatalf("expected the redemption marked applied with the full renewal as discount, got %+v", discounts.marked)
	}
}

// A FULL (100% / fixed >= renewal) discount collects nothing, so it activates like a
// free period covering exactly this cadence (quarterly = 3 months) — NOT a zero paid
// invoice, which the amount_minor > 0 DB check would reject.
func TestVerifySubscriptionAuthorizationAppliesFullDiscountAsFreeWindow(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "quarterly",
			QuarterlyRenewalMinor: 14700,
		},
	}
	discounts := &fakeDiscountRepository{
		code: ports.SubscriptionDiscountCode{
			DiscountCodeID: "code-1",
			Code:           "FREEQ",
			DiscountType:   "percentage",
			DiscountValue:  100,
			MaxPerAccount:  1,
		},
		hasPending: true,
		pending: ports.PendingDiscountRedemption{
			RedemptionID:  "redemption-1",
			DiscountType:  "percentage",
			DiscountValue: 100,
			PlanCode:      "growth",
			Cadence:       "quarterly",
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newDiscountTestService(businesses, payments, discounts)

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "quarterly", Code: "FREEQ",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !link.Activated || payments.initInput.AmountMinor != 0 {
		t.Fatalf("a full discount must activate with no checkout, got link=%+v amount=%d", link, payments.initInput.AmountMinor)
	}
	// Activated as a free window covering the quarterly period — never a zero invoice.
	if len(discounts.freePeriods) != 1 || discounts.freePeriods[0].FreeMonths != 3 {
		t.Fatalf("expected a 3-month (one quarter) free window, got %+v", discounts.freePeriods)
	}
	if businesses.activationPayment.ChargeRef != "" {
		t.Fatalf("a full discount must NOT book a (zero) paid invoice, got %+v", businesses.activationPayment)
	}
	if len(discounts.marked) != 1 || discounts.marked[0].DiscountMinor != 14700 {
		t.Fatalf("expected the redemption marked applied with the full renewal as discount, got %+v", discounts.marked)
	}
}

// A valid code at checkout is captured as a PENDING redemption (not applied yet),
// so an abandoned checkout never consumes a redemption slot.
func TestInitializeSubscriptionAuthorizationCapturesValidDiscountAsPending(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			QuarterlyRenewalMinor: 14700,
		},
	}
	discounts := &fakeDiscountRepository{
		code: ports.SubscriptionDiscountCode{
			DiscountCodeID:    "code-1",
			Code:              "WELCOME20",
			DiscountType:      "percentage",
			DiscountValue:     20,
			FirstPurchaseOnly: true,
			MaxPerAccount:     1,
		},
	}
	service := newDiscountTestService(businesses, &fakeSubscriptionPayments{}, discounts)

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		BillingCadence: "quarterly",
		Code:           " welcome20 ",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if link.RedirectURL == "" {
		t.Fatalf("expected a redirect link, got %+v", link)
	}
	if discounts.lookupCode != "WELCOME20" {
		t.Fatalf("expected the code normalized to upper-case, got %q", discounts.lookupCode)
	}
	if businesses.cadenceSet != "quarterly" {
		t.Fatalf("expected the cadence persisted, got %q", businesses.cadenceSet)
	}
	if len(discounts.created) != 1 {
		t.Fatalf("expected exactly one redemption captured, got %d", len(discounts.created))
	}
	captured := discounts.created[0]
	if captured.Status != "pending" {
		t.Fatalf("expected a pending capture, got %q", captured.Status)
	}
	// The discount is derived from the ROUNDED charge so the two always reconcile to
	// the renewal figure exactly: 20% off 14700 is 11760, the charge rounds to the
	// whole cedi 11800, so the discount recorded for attribution is 2900.
	if captured.DiscountMinor != 2900 || captured.Cadence != "quarterly" || captured.PlanCode != "growth" {
		t.Fatalf("unexpected captured redemption: %+v", captured)
	}
	if captured.SubscriptionID != "sub-1" || captured.DiscountCodeID != "code-1" {
		t.Fatalf("expected the capture keyed to the subscription + code, got %+v", captured)
	}
}

// An ineligible (wrong plan) or expired code is rejected at checkout — never
// silently ignored — and nothing is captured or persisted.
func TestInitializeSubscriptionAuthorizationRejectsIneligibleAndExpiredCodes(t *testing.T) {
	t.Parallel()

	baseSubscription := ports.BusinessSubscriptionRecord{
		SubscriptionID:        "sub-1",
		BusinessID:            "business-1",
		OwnerEmail:            "owner@adwoa.test",
		PlanCode:              "growth",
		MonthlyFeeMinor:       4900,
		Status:                "trialing",
		QuarterlyRenewalMinor: 14700,
	}
	past := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC) // before the fixed clock

	cases := []struct {
		name string
		code ports.SubscriptionDiscountCode
		want error
	}{
		{
			name: "wrong plan",
			code: ports.SubscriptionDiscountCode{
				DiscountCodeID: "code-1",
				DiscountType:   "percentage",
				DiscountValue:  20,
				EligiblePlans:  []string{"studio"},
				MaxPerAccount:  1,
			},
			want: ErrDiscountCodeIneligible,
		},
		{
			name: "expired",
			code: ports.SubscriptionDiscountCode{
				DiscountCodeID: "code-1",
				DiscountType:   "percentage",
				DiscountValue:  20,
				MaxPerAccount:  1,
				ValidUntil:     &past,
			},
			want: ErrDiscountCodeExpired,
		},
	}
	for _, tc := range cases {
		businesses := &fakeBusinessIdentityRepository{subscription: baseSubscription}
		discounts := &fakeDiscountRepository{code: tc.code}
		service := newDiscountTestService(businesses, &fakeSubscriptionPayments{}, discounts)

		_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
			Scope:          common.TenantScope{BusinessID: "business-1"},
			BillingCadence: "quarterly",
			Code:           "SOMECODE",
		})
		if !errors.Is(err, tc.want) {
			t.Fatalf("%s: expected %v, got %v", tc.name, tc.want, err)
		}
		if len(discounts.created) != 0 {
			t.Fatalf("%s: a rejected code must capture nothing, got %+v", tc.name, discounts.created)
		}
		if businesses.cadenceSet != "" {
			t.Fatalf("%s: a rejected code must not persist the cadence or start billing", tc.name)
		}
	}
}

// The per-account cap is enforced at checkout: once a business has applied the
// code max_per_account times, a further checkout is refused.
func TestInitializeSubscriptionAuthorizationEnforcesPerAccountLimit(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			QuarterlyRenewalMinor: 14700,
		},
	}
	discounts := &fakeDiscountRepository{
		appliedForAccount: 1,
		code: ports.SubscriptionDiscountCode{
			DiscountCodeID: "code-1",
			DiscountType:   "percentage",
			DiscountValue:  20,
			MaxPerAccount:  1,
		},
	}
	service := newDiscountTestService(businesses, &fakeSubscriptionPayments{}, discounts)

	_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		BillingCadence: "quarterly",
		Code:           "WELCOME20",
	})
	if !errors.Is(err, ErrDiscountCodeExhausted) {
		t.Fatalf("expected the per-account cap to reject the code, got %v", err)
	}
	if len(discounts.created) != 0 {
		t.Fatalf("an exhausted code must capture nothing, got %+v", discounts.created)
	}
}

// A pending redemption captured for an abandoned plan choice must not discount
// or be consumed by a later checkout for another plan/cadence on the same
// subscription.
func TestStalePendingDiscountDoesNotReduceOrApplyLaterPlanPayment(t *testing.T) {
	t.Parallel()

	subscription := ports.BusinessSubscriptionRecord{
		SubscriptionID:        "sub-1",
		BusinessID:            "business-1",
		OwnerEmail:            "owner@adwoa.test",
		PlanCode:              "growth",
		MonthlyFeeMinor:       4900,
		Status:                "trialing",
		BillingCadence:        "quarterly",
		QuarterlyFirstMinor:   11800,
		QuarterlyRenewalMinor: 14700,
	}
	businesses := &fakeBusinessIdentityRepository{subscription: subscription}
	discounts := &fakeDiscountRepository{
		hasPending: true,
		pending: ports.PendingDiscountRedemption{
			RedemptionID:  "old-redemption",
			DiscountType:  "percentage",
			DiscountValue: 90,
			PlanCode:      "starter",
			Cadence:       "yearly",
		},
	}
	service := newDiscountTestService(businesses, &fakeSubscriptionPayments{}, discounts)
	scope := common.TenantScope{BusinessID: "business-1"}

	due, err := service.subscriptionActivationCheckoutDue(context.Background(), scope, subscription, "quarterly")
	if err != nil {
		t.Fatalf("checkout due: %v", err)
	}
	if due != 12035 {
		t.Fatalf("stale discount must not reduce the normal 12035 checkout, got %d", due)
	}

	err = service.bookFirstPeriodPaid(
		context.Background(),
		scope,
		subscription,
		"quarterly",
		ports.SubscriptionActivationCharge{Ref: "xtsub_act_test"},
		due,
	)
	if err != nil {
		t.Fatalf("book paid period: %v", err)
	}
	if len(discounts.marked) != 0 {
		t.Fatalf("stale redemption must remain unapplied, got %+v", discounts.marked)
	}
}
