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
// 30 days remaining → ceil(30000*30/92) = ceil(9782.6…) = 9783 (the ceil rounds up).
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
	if result.ProratedChargeMinor != 9783 {
		t.Fatalf("expected prorated charge of 9783, got %d", result.ProratedChargeMinor)
	}
	if !result.EffectiveAt.Equal(now) {
		t.Fatalf("an upgrade should take effect now (%s), got %s", now, result.EffectiveAt)
	}
	// The prorated difference is charged on the stored recurring authorization.
	if payments.chargeInput.AmountMinor != 9783 || payments.chargeInput.AuthorizationCode != "AUTH_x" {
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
	if businesses.upgradeApplied.NewPlanID != "plan-studio" || businesses.upgradeApplied.AmountMinor != 9783 {
		t.Fatalf("expected the switch to the studio plan booking 9783, got %+v", *businesses.upgradeApplied)
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
