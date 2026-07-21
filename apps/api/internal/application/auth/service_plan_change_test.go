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

// An UPGRADE charges the prorated difference for the remainder of the current
// period against the stored authorization, then switches the plan immediately.
// Proration = ceil( (newRenewal - currentRenewal) * daysRemaining / totalDays ):
// growth→studio quarterly renewal diff = 59700-29700 = 30000; a 92-day period with
// 30 days remaining → ceil(30000*30/92) = ceil(9782.6…) = 9800 (the ceil rounds up).
func TestChangeSubscriptionPlanUpgradeChargesProratedDifferenceAndSwitchesImmediately(t *testing.T) {
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
	// verifyNotSucceeded so the upgrade's recovery pre-verify reports the ref as
	// not-yet-charged (first attempt), letting the proration charge proceed.
	payments := &fakeSubscriptionPayments{chargeStatus: "success", verifyNotSucceeded: true}
	service := newPlanChangeTestService(businesses, payments, now)

	result, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope:     common.TenantScope{BusinessID: "business-1"},
		ActorRole: business.UserRoleOwner,
		PlanCode:  "studio",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Immediate || result.PlanCode != "studio" {
		t.Fatalf("expected an immediate switch to studio, got %+v", result)
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
	// The prorated difference is charged on the stored recurring authorization.
	if payments.chargeInput.AmountMinor != 9995 || payments.chargeInput.AuthorizationCode != "AUTH_x" {
		t.Fatalf("expected the prorated difference charged on the stored authorization, got %+v", payments.chargeInput)
	}
	if !strings.HasPrefix(payments.chargeInput.Reference, "xtsub_upgrade_sub-1_studio_") {
		t.Fatalf("expected a deterministic upgrade ref, got %q", payments.chargeInput.Reference)
	}
	// The plan is switched immediately, keyed on the target plan, and the invoice ref
	// equals the charge ref (webhook idempotency), mirroring the activation charge.
	if businesses.upgradeApplied == nil {
		t.Fatal("expected the plan to be switched immediately")
	}
	if businesses.upgradeApplied.NewPlanID != "plan-studio" || businesses.upgradeApplied.AmountMinor != 9995 {
		t.Fatalf("expected the switch to the studio plan booking 9995, got %+v", *businesses.upgradeApplied)
	}
	if businesses.upgradeApplied.ChargeRef != payments.chargeInput.Reference {
		t.Fatalf("invoice ref must equal the charge reference, got %q vs %q",
			businesses.upgradeApplied.ChargeRef, payments.chargeInput.Reference)
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

// Recovery may trust a prior deterministic Paystack reference only when the
// provider-confirmed amount covers the current prorated upgrade charge.
func TestChangeSubscriptionPlanRejectsUnderpaidSuccessfulRecovery(t *testing.T) {
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
			PlanID: "plan-studio", Code: "studio", MonthlyFeeMinor: 9900, QuarterlyRenewalMinor: 59700,
		},
	}
	payments := &fakeSubscriptionPayments{chargeStatus: "success"}
	payments.initInput.AmountMinor = 100 // provider says success, but far below the due amount
	service := newPlanChangeTestService(businesses, payments, now)

	_, err := service.ChangeSubscriptionPlan(context.Background(), ChangeSubscriptionPlanCommand{
		Scope: common.TenantScope{BusinessID: "business-1"}, ActorRole: business.UserRoleOwner, PlanCode: "studio",
	})
	if !errors.Is(err, ErrPlanChangeChargeFailed) {
		t.Fatalf("expected an underpaid recovery to fail closed, got %v", err)
	}
	if businesses.upgradeApplied != nil || payments.chargeInput.AmountMinor != 0 {
		t.Fatal("an underpaid used reference must neither switch nor attempt a duplicate charge")
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

// An upgrade that owes a prorated charge is refused when there is no active recurring
// authorization to charge against (e.g. billing was never set up).
func TestChangeSubscriptionPlanUpgradeRequiresActiveBilling(t *testing.T) {
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
		t.Fatal("nothing should be charged or switched when billing is inactive")
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
