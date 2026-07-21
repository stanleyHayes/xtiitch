package authapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// A free store activating a paid plan gets a Paystack checkout priced on the
// target plan, but the plan itself is only PARKED as payment-pending at
// initialize — never switched before Paystack verifies the payment, so an
// abandoned checkout can never unlock the paid plan's features.
func TestInitializeSubscriptionAuthorizationParksTargetPlanPendingPayment(t *testing.T) {
	t.Parallel()

	// A store on the FREE plan (fee 0) activating a paid plan. Without the pending
	// park this fails the fee gate outright — the reported "couldn't start billing"
	// bug for free→paid upgrades.
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "free", MonthlyFeeMinor: 0, Status: "active",
		},
		planByCode: ports.PlanPricingRecord{PlanID: "plan-growth", Code: "growth", MonthlyFeeMinor: 9900},
		subscriptionUpgraded: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 9900, Status: "active", BillingCadence: "yearly",
			YearlyFirstMinor: 89100, PendingUpgradePlanID: "plan-growth",
		},
	}
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{chargeStatus: "success"})

	result, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb",
		BillingCadence: "yearly", PlanCode: "growth",
	})
	if err != nil {
		t.Fatalf("free→paid activation should succeed, got %v", err)
	}
	if businesses.pendingUpgradeSet != "plan-growth" {
		t.Fatalf("expected the target plan parked as payment-pending, got %q", businesses.pendingUpgradeSet)
	}
	if businesses.upgradeApplied != nil {
		t.Fatalf("the plan must NOT switch at initialize — only on a verified payment, got %+v", businesses.upgradeApplied)
	}
	if result.RedirectURL == "" {
		t.Fatal("expected a Paystack authorization link")
	}
}

// A Paystack-VERIFIED first payment applies the parked plan switch — the only
// path that unlocks the paid plan's entitlements.
func TestVerifySubscriptionAuthorizationAppliesPendingPlanUpgrade(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 9900, Status: "trialing",
			BillingCadence: "yearly", YearlyFirstMinor: 89100,
			PendingUpgradePlanID: "plan-growth",
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newSubscriptionTestService(businesses, payments)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, Reference: "xtsub_act_1",
	})
	if err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if result.Status != "active" {
		t.Fatalf("expected an active subscription, got %+v", result)
	}
	if businesses.upgradeApplied == nil || businesses.upgradeApplied.NewPlanID != "plan-growth" {
		t.Fatalf("expected the pending plan applied on verified payment, got %+v", businesses.upgradeApplied)
	}
	if businesses.upgradeApplied.AmountMinor != 0 {
		t.Fatalf("the pending switch books no proration invoice (the first period books separately), got %d",
			businesses.upgradeApplied.AmountMinor)
	}
}

// An abandoned/failed checkout applies NOTHING: the parked plan stays pending
// and entitlements keep resolving from the current paid-up plan.
func TestVerifySubscriptionAuthorizationKeepsPendingPlanLockedWhenPaymentFails(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 9900, Status: "trialing",
			BillingCadence: "yearly", YearlyFirstMinor: 89100,
			PendingUpgradePlanID: "plan-growth",
		},
	}
	payments := &fakeSubscriptionPayments{verifyNotSucceeded: true}
	service := newSubscriptionTestService(businesses, payments)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, Reference: "xtsub_act_1",
	})
	if err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if result.Status == "active" {
		t.Fatalf("an unpaid checkout must not report active, got %+v", result)
	}
	if businesses.upgradeApplied != nil {
		t.Fatalf("an unpaid checkout must never unlock the plan, got %+v", businesses.upgradeApplied)
	}
	if businesses.recurringActivated != nil {
		t.Fatal("an unpaid checkout must not activate recurring billing")
	}
	if businesses.activationPayment.ChargeRef != "" {
		t.Fatal("an unpaid checkout must not book an activation payment")
	}
}

func TestInitializeSubscriptionAuthorizationRejectsFreeWithoutTarget(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "free", MonthlyFeeMinor: 0, Status: "active",
		},
	}
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
	_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("a free plan with no target must be rejected, got %v", err)
	}
	if businesses.upgradeApplied != nil {
		t.Fatal("no plan switch should occur without a target")
	}
}

func TestInitializeSubscriptionAuthorizationRejectsDowngradeTarget(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 9900, Status: "active",
		},
		planByCode: ports.PlanPricingRecord{PlanID: "plan-starter", Code: "starter", MonthlyFeeMinor: 4900},
	}
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
	_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly", PlanCode: "starter",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("a downgrade via activation must be rejected, got %v", err)
	}
	if businesses.upgradeApplied != nil {
		t.Fatal("no immediate switch on a downgrade target")
	}
}

func TestVerifySubscriptionAuthorizationChargesFirstPeriod(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:   "sub-1",
			BusinessID:       "business-1",
			OwnerEmail:       "owner@adwoa.test",
			MonthlyFeeMinor:  9900,
			Status:           "trialing",
			BillingCadence:   "yearly",
			YearlyFirstMinor: 89100,
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newSubscriptionTestService(businesses, payments)

	// Initialize prices the STANDARD checkout at the first-period figure (the yearly
	// INTRO here, not the monthly fee) — the customer pays it at checkout.
	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly",
	})
	if err != nil {
		t.Fatalf("initialize: unexpected error: %v", err)
	}
	if payments.initInput.AmountMinor != 90872 || payments.initInput.Currency != "GHS" {
		t.Fatalf("expected the yearly intro figure plus the §4.1 VAT/Transaction-fee lines at checkout, got %+v", payments.initInput)
	}
	if link.RedirectURL == "" || link.Activated {
		t.Fatalf("expected a redirect checkout link, got %+v", link)
	}

	// Verify confirms the paid checkout and BOOKS it (never re-charges), storing the
	// reusable authorization for the recurring sweep.
	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, Reference: link.Reference,
	})
	if err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if result.Status != "active" || result.BillingMode != "recurring" {
		t.Fatalf("expected active recurring subscription, got %+v", result)
	}
	if result.ProviderSubscriptionRef != "AUTH_x" {
		t.Fatalf("expected the reusable authorization stored, got %q", result.ProviderSubscriptionRef)
	}
	if payments.chargeInput.AuthorizationCode != "" {
		t.Fatalf("the first period must NOT be re-charged, but ChargeAuthorization ran: %+v", payments.chargeInput)
	}
	if businesses.activationPayment.AmountMinor != 90872 || businesses.activationPayment.ChargeRef == "" {
		t.Fatalf("expected the activation payment booked at the paid amount, got %+v", businesses.activationPayment)
	}
	if businesses.activationPayment.BillingCadence != "yearly" {
		t.Fatalf("expected the activation payment to carry the yearly cadence, got %q", businesses.activationPayment.BillingCadence)
	}
}

// A MOBILE-MONEY checkout succeeds but yields NO reusable authorization. The
// subscription must STILL be flipped to recurring so the renewal sweep picks it up,
// with the channel stored as mobile_money so the sweep re-prompts (rather than
// leaving it billing_mode='manual', which the sweep skips forever — a renewal leak).
func TestVerifySubscriptionAuthorizationMobileMoneyActivatesRecurringWithoutAuth(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:   "sub-1",
			BusinessID:       "business-1",
			OwnerEmail:       "owner@adwoa.test",
			MonthlyFeeMinor:  9900,
			Status:           "trialing",
			BillingCadence:   "yearly",
			YearlyFirstMinor: 89100,
		},
	}
	payments := &fakeSubscriptionPayments{verifyNoAuth: true, verifyChannel: "mobile_money"}
	service := newSubscriptionTestService(businesses, payments)

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly",
	})
	if err != nil {
		t.Fatalf("initialize: unexpected error: %v", err)
	}
	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, Reference: link.Reference,
	})
	if err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if result.Status != "active" || result.BillingMode != "recurring" {
		t.Fatalf("a paid MoMo signup must activate as recurring, got %+v", result)
	}
	if businesses.recurringActivated == nil {
		t.Fatal("ActivateRecurringBilling must be called for MoMo so the sweep picks it up")
	}
	if businesses.recurringActivated.ProviderChannel != "mobile_money" {
		t.Fatalf("expected the mobile_money channel stored, got %q", businesses.recurringActivated.ProviderChannel)
	}
	if businesses.recurringActivated.ProviderSubscriptionRef != "" {
		t.Fatalf("a MoMo authorization has no reusable code, got %q", businesses.recurringActivated.ProviderSubscriptionRef)
	}
	if businesses.activationPayment.AmountMinor != 90872 {
		t.Fatalf("the paid period must still be booked, got %+v", businesses.activationPayment)
	}
}

// When the checkout was not completed/paid, the subscription is not reported active
// and no payment is booked (the tenant can retry).
func TestVerifySubscriptionAuthorizationLeavesUnactivatedWhenCheckoutNotPaid(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:   "sub-1",
			BusinessID:       "business-1",
			OwnerEmail:       "owner@adwoa.test",
			MonthlyFeeMinor:  9900,
			Status:           "trialing",
			BillingCadence:   "yearly",
			YearlyFirstMinor: 89100,
		},
	}
	payments := &fakeSubscriptionPayments{verifyNotSucceeded: true}
	service := newSubscriptionTestService(businesses, payments)

	if _, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "yearly",
	}); err != nil {
		t.Fatalf("initialize: unexpected error: %v", err)
	}
	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status == "active" {
		t.Fatal("an unpaid/abandoned checkout must not report the subscription active")
	}
	if businesses.activationPayment.ChargeRef != "" {
		t.Fatal("no activation payment should be booked when the checkout was not paid")
	}
}

// Re-verifying after the first period is already paid must NOT charge the card
// again (idempotency guard against double-submit / callback replay).
func TestVerifySubscriptionAuthorizationDoesNotRechargeWhenAlreadyPaid(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		activationAlreadyPaid: true,
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			MonthlyFeeMinor:       9900,
			Status:                "active",
			BillingCadence:        "yearly",
			FirstPurchaseConsumed: true,
			YearlyRenewalMinor:    118800,
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newSubscriptionTestService(businesses, payments)

	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: "paystack-ref",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payments.chargeInput.AuthorizationCode != "" {
		t.Fatalf("must not charge again when the period is already paid, but charged %+v", payments.chargeInput)
	}
	if businesses.activationPayment.ChargeRef != "" {
		t.Fatal("must not re-book an activation payment when already paid")
	}
	if result.Status != "active" {
		t.Fatalf("an already-paid subscription should still report active, got %q", result.Status)
	}
}

// A first purchase (intro not yet consumed) on a QUARTERLY cadence bills the
// quarterly INTRO figure and books the activation payment with that cadence, so
// the repository can mark the first purchase consumed and set a 3-month period.
func TestVerifySubscriptionAuthorizationFirstPurchaseChargesQuarterlyIntro(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "quarterly",
			FirstPurchaseConsumed: false,
			QuarterlyFirstMinor:   11800,
			QuarterlyRenewalMinor: 14700,
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newSubscriptionTestService(businesses, payments)

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "quarterly",
	})
	if err != nil {
		t.Fatalf("initialize: unexpected error: %v", err)
	}
	if payments.initInput.AmountMinor != 12035 {
		t.Fatalf("first purchase must price the checkout at the quarterly INTRO figure plus §4.1 fees (11800 -> 12035), got %d", payments.initInput.AmountMinor)
	}
	result, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: link.Reference,
	})
	if err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if result.Status != "active" {
		t.Fatalf("expected active subscription after a paid checkout, got %q", result.Status)
	}
	if businesses.activationPayment.AmountMinor != 12035 || businesses.activationPayment.BillingCadence != "quarterly" {
		t.Fatalf("expected the intro payment booked with the quarterly cadence, got %+v", businesses.activationPayment)
	}
}

// An account that has already consumed its first purchase bills the FULL renewal
// figure for its cadence, never the intro again (cancel+resubscribe safety).
func TestVerifySubscriptionAuthorizationConsumedAccountChargesRenewal(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:        "sub-1",
			BusinessID:            "business-1",
			OwnerEmail:            "owner@adwoa.test",
			MonthlyFeeMinor:       4900,
			Status:                "trialing",
			BillingCadence:        "quarterly",
			FirstPurchaseConsumed: true,
			QuarterlyFirstMinor:   11800,
			QuarterlyRenewalMinor: 14700,
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newSubscriptionTestService(businesses, payments)

	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, CallbackURL: "https://x/cb", BillingCadence: "quarterly",
	})
	if err != nil {
		t.Fatalf("initialize: unexpected error: %v", err)
	}
	if payments.initInput.AmountMinor != 14992 {
		t.Fatalf("a consumed account must price the checkout at the quarterly RENEWAL figure plus §4.1 fees (14700 -> 14992), got %d", payments.initInput.AmountMinor)
	}
	if _, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: link.Reference,
	}); err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if businesses.activationPayment.AmountMinor != 14992 {
		t.Fatalf("expected the renewal figure booked, got %d", businesses.activationPayment.AmountMinor)
	}
}

// A paid plan cannot be activated with a non-billable cadence: monthly/empty are
// rejected and no charge is attempted.
func TestVerifySubscriptionAuthorizationRejectsNonBillableCadence(t *testing.T) {
	t.Parallel()

	for _, cadence := range []string{"monthly", ""} {
		businesses := &fakeBusinessIdentityRepository{
			subscription: ports.BusinessSubscriptionRecord{
				SubscriptionID:      "sub-1",
				BusinessID:          "business-1",
				OwnerEmail:          "owner@adwoa.test",
				MonthlyFeeMinor:     4900,
				Status:              "trialing",
				BillingCadence:      cadence,
				QuarterlyFirstMinor: 11800,
			},
		}
		payments := &fakeSubscriptionPayments{chargeStatus: "success"}
		service := newSubscriptionTestService(businesses, payments)

		_, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
			Scope:     common.TenantScope{BusinessID: "business-1"},
			Reference: "paystack-ref",
		})
		if !errors.Is(err, authdomain.ErrInvalidInput) {
			t.Fatalf("cadence %q: expected ErrInvalidInput, got %v", cadence, err)
		}
		if payments.chargeInput.AuthorizationCode != "" {
			t.Fatalf("cadence %q: must not charge when the cadence is not billable", cadence)
		}
	}
}

// The authorization-link step rejects a monthly/empty cadence for a paid plan and
// persists a valid quarterly/yearly cadence before redirecting to Paystack.
func TestInitializeSubscriptionAuthorizationValidatesAndPersistsCadence(t *testing.T) {
	t.Parallel()

	newRepo := func() *fakeBusinessIdentityRepository {
		return &fakeBusinessIdentityRepository{
			subscription: ports.BusinessSubscriptionRecord{
				SubscriptionID:      "sub-1",
				BusinessID:          "business-1",
				OwnerEmail:          "owner@adwoa.test",
				MonthlyFeeMinor:     4900,
				Status:              "trialing",
				QuarterlyFirstMinor: 11800,
			},
		}
	}

	for _, cadence := range []string{"monthly", ""} {
		businesses := newRepo()
		service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
		_, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
			Scope:          common.TenantScope{BusinessID: "business-1"},
			BillingCadence: cadence,
		})
		if !errors.Is(err, authdomain.ErrInvalidInput) {
			t.Fatalf("cadence %q: expected ErrInvalidInput, got %v", cadence, err)
		}
		if businesses.cadenceSet != "" {
			t.Fatalf("cadence %q: must not persist an invalid cadence, got %q", cadence, businesses.cadenceSet)
		}
	}

	businesses := newRepo()
	service := newSubscriptionTestService(businesses, &fakeSubscriptionPayments{})
	link, err := service.InitializeSubscriptionAuthorization(context.Background(), InitializeSubscriptionAuthorizationCommand{
		Scope:          common.TenantScope{BusinessID: "business-1"},
		BillingCadence: "quarterly",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if businesses.cadenceSet != "quarterly" {
		t.Fatalf("expected the quarterly cadence to be persisted, got %q", businesses.cadenceSet)
	}
	if link.RedirectURL == "" {
		t.Fatalf("expected a redirect link, got %+v", link)
	}
}
