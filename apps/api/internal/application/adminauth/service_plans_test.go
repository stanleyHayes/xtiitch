package adminauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestPlanPackagesRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"audit-create", "audit-update", "audit-archive"},
	)

	plans, err := service.ListPlans(context.Background(), ListPlansCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list plans: %v", err)
	}
	if len(plans) != 1 || plans[0].Code != "growth" {
		t.Fatalf("unexpected plans: %+v", plans)
	}

	designLimit := 25
	created, err := service.CreatePlan(context.Background(), CreatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		Code:            " Pro-Plus ",
		Name:            "  Pro   Plus  ",
		MonthlyFeeMinor: 15000,
		YearlyFeeMinor:  150000,
		CommissionBPS:   75,
		DesignLimit:     &designLimit,
		UserAgent:       "test-agent",
		IPAddress:       "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create plan: %v", err)
	}
	if businesses.createdPlan.Code != "pro-plus" ||
		businesses.createdPlan.Name != "Pro Plus" ||
		businesses.createdPlan.YearlyFeeMinor != 150000 ||
		*businesses.createdPlan.DesignLimit != 25 {
		t.Fatalf("expected normalized create input, got %+v", businesses.createdPlan)
	}
	if created.Code != "pro-plus" {
		t.Fatalf("unexpected created plan: %+v", created)
	}

	updated, err := service.UpdatePlan(context.Background(), UpdatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		PlanID:          "plan-growth",
		Name:            "Growth Plus",
		MonthlyFeeMinor: 18000,
		YearlyFeeMinor:  180000,
		CommissionBPS:   50,
		IsActive:        true,
		UserAgent:       "test-agent",
		IPAddress:       "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update plan: %v", err)
	}
	if businesses.updatedPlan.Name != "Growth Plus" ||
		businesses.updatedPlan.YearlyFeeMinor != 180000 ||
		businesses.updatedPlan.IsActive != true {
		t.Fatalf("expected normalized update input, got %+v", businesses.updatedPlan)
	}
	if updated.Name != "Growth Plus" {
		t.Fatalf("unexpected updated plan: %+v", updated)
	}

	archived, err := service.ArchivePlan(context.Background(), ArchivePlanCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		PlanID:      "plan-growth",
		Reason:      " replaced by pro ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive plan: %v", err)
	}
	if businesses.archivedPlan.PlanID != "plan-growth" || archived.IsActive {
		t.Fatalf("expected archived plan, got input=%+v record=%+v", businesses.archivedPlan, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created plan package" ||
		audits.created[1].Action != "Updated plan package" ||
		audits.created[2].Action != "Archived plan package" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.CreatePlan(context.Background(), CreatePlanCommand{
		ActorUserID:     "support-1",
		ActorRole:       admindomain.RoleSupport,
		Code:            "support-plan",
		Name:            "Support Plan",
		MonthlyFeeMinor: 1000,
		YearlyFeeMinor:  10000,
		CommissionBPS:   100,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestPlanPackageValidation(t *testing.T) {
	t.Parallel()

	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		&fakeAdminBusinesses{},
		time.Now(),
		[]common.ID{"audit"},
	)

	_, err := service.CreatePlan(context.Background(), CreatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		Code:            "bad code",
		Name:            "Bad",
		MonthlyFeeMinor: 1000,
		YearlyFeeMinor:  10000,
		CommissionBPS:   100,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid code, got %v", err)
	}

	negativeLimit := -1
	_, err = service.UpdatePlan(context.Background(), UpdatePlanCommand{
		ActorUserID:     "operator-1",
		ActorRole:       admindomain.RoleOperator,
		PlanID:          "plan-growth",
		Name:            "Growth",
		MonthlyFeeMinor: 1000,
		YearlyFeeMinor:  -1000,
		CommissionBPS:   10001,
		DesignLimit:     &negativeLimit,
		IsActive:        true,
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid economics, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminPlans(context.Context) ([]ports.AdminPlanRecord, error) {
	if repo.plans != nil {
		return repo.plans, nil
	}
	return []ports.AdminPlanRecord{fakeAdminPlanRecord(
		"plan-growth",
		"growth",
		"Growth",
		12000,
		144000,
		50,
		nil,
		true,
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminPlan(
	_ context.Context,
	input ports.CreateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	repo.createdPlan = input
	return fakeAdminPlanRecord(
		"plan-created",
		input.Code,
		input.Name,
		input.MonthlyFeeMinor,
		input.YearlyFeeMinor,
		input.CommissionBPS,
		input.DesignLimit,
		true,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminPlan(
	_ context.Context,
	input ports.UpdateAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	repo.updatedPlan = input
	return fakeAdminPlanRecord(
		input.PlanID,
		"growth",
		input.Name,
		input.MonthlyFeeMinor,
		input.YearlyFeeMinor,
		input.CommissionBPS,
		input.DesignLimit,
		input.IsActive,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminPlan(
	_ context.Context,
	input ports.ArchiveAdminPlanInput,
) (ports.AdminPlanRecord, error) {
	repo.archivedPlan = input
	return fakeAdminPlanRecord(
		input.PlanID,
		"growth",
		"Growth",
		12000,
		144000,
		50,
		nil,
		false,
	), nil
}

func (repo *fakeAdminBusinesses) ListAdminPlanEntitlements(context.Context) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	return []ports.AdminPlanEntitlementFeatureRecord{
		{
			FeatureKey:  "online_ordering",
			Label:       "Online ordering",
			Description: "Checkout entitlement",
			Category:    "Storefront",
			ValueType:   "boolean",
			SortOrder:   1,
			IsActive:    true,
			Values: []ports.AdminPlanEntitlementValueRecord{
				{
					PlanID:    "plan-growth",
					PlanCode:  "growth",
					Enabled:   true,
					UpdatedAt: time.Now(),
				},
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}, nil
}

func (repo *fakeAdminBusinesses) UpdateAdminPlanEntitlements(
	_ context.Context,
	input ports.UpdateAdminPlanEntitlementsInput,
) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	repo.updatedPlanEntitlements = input
	return repo.ListAdminPlanEntitlements(context.Background())
}

func fakeAdminPlanRecord(
	planID common.ID,
	code string,
	name string,
	monthlyFeeMinor int64,
	yearlyFeeMinor int64,
	commissionBPS int,
	designLimit *int,
	isActive bool,
) ports.AdminPlanRecord {
	return ports.AdminPlanRecord{
		PlanID:                  planID,
		Code:                    code,
		Name:                    name,
		MonthlyFeeMinor:         monthlyFeeMinor,
		YearlyFeeMinor:          yearlyFeeMinor,
		CommissionBPS:           commissionBPS,
		DesignLimit:             designLimit,
		IsActive:                isActive,
		BusinessCount:           2,
		ActiveSubscriptionCount: 1,
		EstimatedMRRMinor:       monthlyFeeMinor,
		CreatedAt:               time.Now(),
		UpdatedAt:               time.Now(),
	}
}
