package authapp

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// An UPGRADE opens checkout for the prorated difference and parks the target.
// Even a stored card must not be silently charged or unlock the plan before the
// owner explicitly pays and Paystack verifies the callback.
// Proration = ceil( (newRenewal - currentRenewal) * daysRemaining / totalDays ):
// growth→studio quarterly renewal diff = 59700-29700 = 30000; a 92-day period with
// 30 days remaining → ceil(30000*30/92) = ceil(9782.6…) = 9800 (the ceil rounds up).
func TestChangeSubscriptionPlanUpgradeRequiresCheckoutBeforeSwitching(t *testing.T) {
	t.Parallel()

	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC) // 92 days
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)       // 30 days remaining

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:          "sub-1",
			BusinessID:              "business-1",
			OwnerEmail:              "owner@adwoa.test",
			PlanCode:                "growth",
			MonthlyFeeMinor:         4900,
			Status:                  "active",
			BillingMode:             "recurring",
			ProviderSubscriptionRef: "AUTH_x",
			BillingCadence:          "quarterly",
			QuarterlyRenewalMinor:   29700,
			CurrentPeriodStart:      periodStart,
			CurrentPeriodEnd:        periodEnd,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID:                "plan-studio",
			Code:                  "studio",
			MonthlyFeeMinor:       9900,
			QuarterlyRenewalMinor: 59700,
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newPlanChangeTestService(businesses, payments, now)

	result, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		PlanCode:    "studio",
		CallbackURL: "https://dashboard.example/callback?flow=plan-change",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Immediate || result.PlanCode != "studio" || result.AuthorizationURL != "https://pay" {
		t.Fatalf("expected a pending Paystack checkout for studio, got %+v", result)
	}
	// The prorated difference is billed in WHOLE CEDIS: 9800 pesewas becomes GHS 98
	// ("Whole cedis in all display and billing", Pricing Book §7; checklist #14
	// names proration). Ceil, so a genuine upgrade never rounds down to nothing.
	if result.ProratedChargeMinor != 9995 {
		t.Fatalf("expected prorated charge of 9995 (9800 + §4.1 Transaction fee), got %d", result.ProratedChargeMinor)
	}
	if !result.EffectiveAt.Equal(now) {
		t.Fatalf("an upgrade should take effect now (%s), got %s", now, result.EffectiveAt)
	}
	if payments.chargeInput.AmountMinor != 0 {
		t.Fatalf("stored authorization must not be charged silently, got %+v", payments.chargeInput)
	}
	if payments.initInput.AmountMinor != 9995 ||
		!strings.HasPrefix(payments.initInput.Reference, "xtsub_upgrade_checkout_sub-1_studio_") {
		t.Fatalf("expected the prorated Paystack checkout, got %+v", payments.initInput)
	}
	if businesses.upgradeApplied != nil || businesses.pendingUpgradeSet != "plan-studio" {
		t.Fatalf("target must remain parked until payment verification: pending=%q applied=%+v",
			businesses.pendingUpgradeSet, businesses.upgradeApplied)
	}
	if businesses.downgradeScheduled != nil {
		t.Fatal("an upgrade must not schedule a pending downgrade")
	}
}

// A DOWNGRADE records a pending plan change effective at the current period end and
// charges nothing / changes no entitlements now (no refund mid-cycle).
func TestChangeSubscriptionPlanDowngradeSchedulesPendingChangeAndDoesNotCharge(t *testing.T) {
	t.Parallel()

	periodEnd := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID:          "sub-1",
			BusinessID:              "business-1",
			OwnerEmail:              "owner@adwoa.test",
			PlanCode:                "studio",
			MonthlyFeeMinor:         9900,
			Status:                  "active",
			BillingMode:             "recurring",
			ProviderSubscriptionRef: "AUTH_x",
			BillingCadence:          "quarterly",
			QuarterlyRenewalMinor:   59700,
			CurrentPeriodStart:      time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
			CurrentPeriodEnd:        periodEnd,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID:                "plan-growth",
			Code:                  "growth",
			MonthlyFeeMinor:       4900,
			QuarterlyRenewalMinor: 29700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newPlanChangeTestService(businesses, payments, now)
	// A downgrade never touches Paystack, so it must remain available even when
	// the payment provider is temporarily unavailable.
	service.payments = nil

	result, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "growth",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Immediate || result.PlanCode != "growth" {
		t.Fatalf("expected a scheduled (not immediate) downgrade to growth, got %+v", result)
	}
	if result.ProratedChargeMinor != 0 {
		t.Fatalf("a downgrade must not charge, got %d", result.ProratedChargeMinor)
	}
	if !result.EffectiveAt.Equal(periodEnd) {
		t.Fatalf("a downgrade should take effect at the period end (%s), got %s", periodEnd, result.EffectiveAt)
	}
	// No charge attempted (the fake records the input only when ChargeAuthorization runs).
	if payments.chargeInput.AmountMinor != 0 || payments.chargeInput.Reference != "" {
		t.Fatalf("a downgrade must not charge the card, got %+v", payments.chargeInput)
	}
	if businesses.upgradeApplied != nil {
		t.Fatal("a downgrade must not switch the plan now")
	}
	if businesses.downgradeScheduled == nil {
		t.Fatal("expected a pending downgrade to be recorded")
	}
	if businesses.downgradeScheduled.NewPlanID != "plan-growth" || !businesses.downgradeScheduled.EffectiveAt.Equal(periodEnd) {
		t.Fatalf("expected the pending downgrade to target growth at the period end, got %+v", *businesses.downgradeScheduled)
	}
}

// The old whole-day proration truncated the final partial day to zero, allowing
// an upgrade during the last 23:59 of a paid period without a charge. Any positive
// remainder must still produce at least the whole-cedi billing floor.
func TestProrationChargesTheFinalPartialDay(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := end.Add(-6 * time.Hour)
	if got := prorationChargeMinor(29700, 59700, start, end, now); got != 100 {
		t.Fatalf("final partial day proration = %d, want the GHS 1.00 floor", got)
	}
}

// Monthly price order alone is not enough to grant an upgrade. If cadence
// renewal prices are equal or inverted, there is no positive amount to verify,
// so the change must fail closed instead of activating for free.
func TestChangeSubscriptionPlanRejectsZeroProrationUpgrade(t *testing.T) {
	t.Parallel()

	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 4900, Status: "active", BillingMode: "recurring",
			ProviderSubscriptionRef: "AUTH_x", BillingCadence: "quarterly", QuarterlyRenewalMinor: 29700,
			CurrentPeriodStart: periodStart, CurrentPeriodEnd: periodEnd,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID: "plan-studio", Code: "studio", MonthlyFeeMinor: 9900, QuarterlyRenewalMinor: 29700,
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newPlanChangeTestService(businesses, payments, now)

	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner, PlanCode: "studio",
		CallbackURL: "https://dashboard.example/callback?flow=plan-change",
	})
	if !errors.Is(err, ErrPlanChangePricingInvalid) {
		t.Fatalf("expected a zero-price upgrade to fail closed, got %v", err)
	}
	if businesses.upgradeApplied != nil || !businesses.pendingUpgradeSet.IsZero() || payments.initInput.AmountMinor != 0 {
		t.Fatal("an unpriced upgrade must neither open checkout nor switch the plan")
	}
}

// An expired period must be renewed before changing plans. Otherwise proration
// is zero and a higher plan could be granted without a valid paid window.
func TestChangeSubscriptionPlanRejectsExpiredBillingPeriod(t *testing.T) {
	t.Parallel()

	periodStart := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	periodEnd := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := periodEnd.Add(time.Hour)
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 4900, Status: "active", BillingMode: "recurring",
			ProviderSubscriptionRef: "AUTH_x", BillingCadence: "quarterly", QuarterlyRenewalMinor: 29700,
			CurrentPeriodStart: periodStart, CurrentPeriodEnd: periodEnd,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID: "plan-studio", Code: "studio", MonthlyFeeMinor: 9900, QuarterlyRenewalMinor: 59700,
		},
	}
	service := newPlanChangeTestService(businesses, &fakeSubscriptionPayments{}, now)

	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner, PlanCode: "studio",
	})
	if !errors.Is(err, ErrPlanChangeBillingInactive) {
		t.Fatalf("expected expired billing to require renewal, got %v", err)
	}
	if businesses.upgradeApplied != nil {
		t.Fatal("an expired billing period must not grant the higher plan")
	}
}

// Switching to the plan the business is already on is refused (no upgrade/downgrade).
func TestChangeSubscriptionPlanRejectsSamePlan(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			BusinessID:      "business-1",
			PlanCode:        "growth",
			MonthlyFeeMinor: 4900,
			Status:          "active",
			BillingCadence:  "quarterly",
		},
		planByCode: ports.PlanPricingRecord{PlanID: "plan-growth", Code: "growth", MonthlyFeeMinor: 4900},
	}
	service := newPlanChangeTestService(
		businesses,
		&fakeSubscriptionPayments{chargeStatus: "success"},
		time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC),
	)

	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "growth",
	})
	if !errors.Is(err, ErrPlanChangeSamePlan) {
		t.Fatalf("expected ErrPlanChangeSamePlan, got %v", err)
	}
}

// The API must have a trusted callback URL before it can open an upgrade checkout;
// without one there is no safe verification route and nothing may be activated.
func TestChangeSubscriptionPlanUpgradeRequiresCallback(t *testing.T) {
	t.Parallel()

	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			BusinessID:            "business-1",
			PlanCode:              "growth",
			MonthlyFeeMinor:       4900,
			Status:                "active",
			BillingMode:           "manual",
			BillingCadence:        "quarterly",
			QuarterlyRenewalMinor: 29700,
			CurrentPeriodStart:    time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
			CurrentPeriodEnd:      time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		},
		planByCode: ports.PlanPricingRecord{
			PlanID:                "plan-studio",
			Code:                  "studio",
			MonthlyFeeMinor:       9900,
			QuarterlyRenewalMinor: 59700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	service := newPlanChangeTestService(businesses, payments, time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC))

	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "studio",
	})
	if !errors.Is(err, ErrPlanChangeBillingInactive) {
		t.Fatalf("expected ErrPlanChangeBillingInactive, got %v", err)
	}
	if payments.chargeInput.AmountMinor != 0 || businesses.upgradeApplied != nil {
		t.Fatal("nothing should be charged or switched without a callback")
	}
}

// Mobile-money payments activate recurring billing without a reusable card
// authorization. An upgrade must therefore open a prorated Paystack checkout,
// not strand the owner with "billing inactive" or grant the plan before payment.
func TestChangeSubscriptionPlanMobileMoneyUpgradeOpensProratedCheckout(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 4900, Status: "active", BillingMode: "recurring",
			BillingCadence: "quarterly", QuarterlyRenewalMinor: 29700,
			CurrentPeriodStart: start, CurrentPeriodEnd: end,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID: "plan-studio", Code: "studio", MonthlyFeeMinor: 9900, QuarterlyRenewalMinor: 59700,
		},
	}
	payments := &fakeSubscriptionPayments{}
	service := newPlanChangeTestService(businesses, payments, now)
	result, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		PlanCode: "studio", CallbackURL: "https://dashboard.example/callback?flow=plan-change",
	})
	if err != nil {
		t.Fatalf("mobile-money upgrade should open checkout: %v", err)
	}
	if result.AuthorizationURL != "https://pay" || result.Immediate {
		t.Fatalf("expected a pending interactive checkout, got %+v", result)
	}
	if businesses.pendingUpgradeSet != "plan-studio" || businesses.upgradeApplied != nil {
		t.Fatalf("target must be parked but not applied before payment: pending=%q applied=%+v",
			businesses.pendingUpgradeSet, businesses.upgradeApplied)
	}
	if payments.initInput.AmountMinor != result.ProratedChargeMinor ||
		payments.initInput.CallbackURL != "https://dashboard.example/callback?flow=plan-change" {
		t.Fatalf("unexpected checkout input: %+v", payments.initInput)
	}
}

// Returning from an abandoned interactive upgrade leaves the target parked.
// Retrying that same target must compare it with the effective paid-up plan,
// not reject it as "already on that plan" because billing fields show the
// pending target.
func TestChangeSubscriptionPlanRetriesPendingInteractiveUpgrade(t *testing.T) {
	t.Parallel()

	start := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			// Primary billing fields describe the parked target.
			PlanCode: "studio", MonthlyFeeMinor: 9900, QuarterlyRenewalMinor: 59700,
			PendingUpgradePlanID: "plan-studio",
			// Effective fields describe the current paid-up plan and entitlements.
			EffectivePlanCode: "growth", EffectiveMonthlyFeeMinor: 4900,
			EffectiveQuarterlyRenewalMinor: 29700,
			Status:                         "active", BillingMode: "recurring", BillingCadence: "quarterly",
			CurrentPeriodStart: start, CurrentPeriodEnd: end,
		},
		planByCode: ports.PlanPricingRecord{
			PlanID: "plan-studio", Code: "studio", MonthlyFeeMinor: 9900, QuarterlyRenewalMinor: 59700,
		},
	}
	service := newPlanChangeTestService(businesses, &fakeSubscriptionPayments{}, now)
	result, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		PlanCode: "studio", CallbackURL: "https://dashboard.example/callback?flow=plan-change",
	})
	if err != nil {
		t.Fatalf("pending upgrade retry should open checkout: %v", err)
	}
	if result.AuthorizationURL != "https://pay" || result.Immediate {
		t.Fatalf("expected a fresh interactive retry for the parked target, got %+v", result)
	}
	if businesses.upgradeApplied != nil {
		t.Fatalf("retry initialization must not unlock the target: %+v", businesses.upgradeApplied)
	}
}

func TestChangeSubscriptionPlanFailedCheckoutInitializationDoesNotParkTarget(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC)
	businesses := &fakeBusinessIdentityRepository{
		subscription: ports.BusinessSubscriptionRecord{
			SubscriptionID: "sub-1", BusinessID: "business-1", OwnerEmail: "owner@example.com",
			PlanCode: "growth", MonthlyFeeMinor: 4900, Status: "active", BillingMode: "recurring",
			BillingCadence: "quarterly", QuarterlyRenewalMinor: 29700,
			CurrentPeriodStart: time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
			CurrentPeriodEnd:   time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC),
		},
		planByCode: ports.PlanPricingRecord{
			PlanID: "plan-studio", Code: "studio", MonthlyFeeMinor: 9900, QuarterlyRenewalMinor: 59700,
		},
	}
	service := newPlanChangeTestService(businesses, &fakeSubscriptionPayments{initErr: errors.New("paystack unavailable")}, now)
	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner,
		PlanCode: "studio", CallbackURL: "https://dashboard.example/callback?flow=plan-change",
	})
	if !errors.Is(err, ErrPlanChangeChargeFailed) {
		t.Fatalf("expected checkout initialization failure, got %v", err)
	}
	if !businesses.pendingUpgradeSet.IsZero() {
		t.Fatalf("failed checkout must not strand a pending plan, got %q", businesses.pendingUpgradeSet)
	}
}

// A non-owner/non-admin cannot change the plan.
func TestChangeSubscriptionPlanRequiresManagerRole(t *testing.T) {
	t.Parallel()

	service := newPlanChangeTestService(&fakeBusinessIdentityRepository{}, &fakeSubscriptionPayments{}, time.Now())
	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleStaff,
		PlanCode:  "studio",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for a staff actor, got %v", err)
	}
}
