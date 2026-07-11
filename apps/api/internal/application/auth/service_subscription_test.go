package authapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// A paid plan's authorization-verify charges the first period immediately and,
// on success, books the activation payment and reports the subscription active.
func TestInitializeSubscriptionAuthorizationUpgradesFreePlanToTarget(t *testing.T) {
	t.Parallel()

	// A store on the FREE plan (fee 0) activating a paid plan. Without the plan
	// switch this fails the fee gate outright — the reported "couldn't start billing"
	// bug for free→paid upgrades.
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "free", MonthlyFeeMinor: 0, Status: "active",
		},
		planByCode: ports.PlanPricingRecord{PlanID: "plan-growth", Code: "growth", MonthlyFeeMinor: 9900},
		subscriptionUpgraded: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 9900, Status: "active", BillingCadence: "yearly", YearlyFirstMinor: 89100,
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
	if businesses.upgradeApplied == nil || businesses.upgradeApplied.NewPlanID != "plan-growth" {
		t.Fatalf("expected the subscription switched to the target plan, got %+v", businesses.upgradeApplied)
	}
	if businesses.upgradeApplied.AmountMinor != 0 {
		t.Fatalf("activation switch must not book a proration invoice (first charge is on the callback), got %d", businesses.upgradeApplied.AmountMinor)
	}
	if result.RedirectURL == "" {
		t.Fatal("expected a Paystack authorization link")
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
	if payments.initInput.AmountMinor != 89100 || payments.initInput.Currency != "GHS" {
		t.Fatalf("expected the yearly intro figure at checkout, got %+v", payments.initInput)
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
	if businesses.activationPayment.AmountMinor != 89100 || businesses.activationPayment.ChargeRef == "" {
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
	if businesses.activationPayment.AmountMinor != 89100 {
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
	if payments.initInput.AmountMinor != 11800 {
		t.Fatalf("first purchase must price the checkout at the quarterly INTRO figure (11800), got %d", payments.initInput.AmountMinor)
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
	if businesses.activationPayment.AmountMinor != 11800 || businesses.activationPayment.BillingCadence != "quarterly" {
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
	if payments.initInput.AmountMinor != 14700 {
		t.Fatalf("a consumed account must price the checkout at the quarterly RENEWAL figure (14700), got %d", payments.initInput.AmountMinor)
	}
	if _, err := service.VerifySubscriptionAuthorization(context.Background(), VerifySubscriptionAuthorizationCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		Reference: link.Reference,
	}); err != nil {
		t.Fatalf("verify: unexpected error: %v", err)
	}
	if businesses.activationPayment.AmountMinor != 14700 {
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
