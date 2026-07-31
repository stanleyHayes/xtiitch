package catalogueapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestBusinessAffiliateWritesRequireOwnerOrAdmin(t *testing.T) {
	t.Parallel()
	repository := &fakeBusinessAffiliates{}
	service := NewService(Dependencies{
		Affiliates: repository,
		IDs:        &sequenceIDs{ids: []common.ID{"programme-1"}},
	})
	scope := common.TenantScope{BusinessID: "business-1"}

	_, err := service.CreateBusinessAffiliateProgramme(
		context.Background(),
		BusinessAffiliateProgrammeCommand{
			Scope: scope, ActorUserID: "staff-1", ActorRole: business.UserRoleStaff,
			Name: "Creators", Status: "active",
			DefaultPurchaseCommissionBPS: 1000, CookieWindowDays: 30,
			HoldDays: 14, PayoutMode: "manual", AllowedTargetScope: "store",
		},
	)
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff role to be forbidden, got %v", err)
	}

	record, err := service.CreateBusinessAffiliateProgramme(
		context.Background(),
		BusinessAffiliateProgrammeCommand{
			Scope: scope, ActorUserID: "owner-1", ActorRole: business.UserRoleOwner,
			Name: "  Store   creators ", Status: "active",
			DefaultPurchaseCommissionBPS:      1000,
			DefaultFirstPaidPlanCommissionBPS: 0,
			CookieWindowDays:                  30, HoldDays: 14, PayoutMode: "manual",
			AllowedTargetScope: "store",
		},
	)
	if err != nil {
		t.Fatalf("owner create programme: %v", err)
	}
	if record.AffiliateProgrammeID != "programme-1" ||
		repository.createdProgramme.Name != "Store creators" ||
		repository.createdProgramme.BusinessID != scope.BusinessID {
		t.Fatalf("unexpected programme input=%+v record=%+v", repository.createdProgramme, record)
	}
}

func TestBusinessAffiliateTargetRequiresOwnedTargetShape(t *testing.T) {
	t.Parallel()
	repository := &fakeBusinessAffiliates{}
	service := NewService(Dependencies{
		Affiliates: repository,
		IDs:        &sequenceIDs{ids: []common.ID{"unused", "affiliate-1"}},
	})
	scope := common.TenantScope{BusinessID: "business-1"}

	_, err := service.CreateBusinessAffiliate(context.Background(), BusinessAffiliateCommand{
		Scope: scope, ActorUserID: "owner-1", ActorRole: business.UserRoleOwner,
		AffiliateProgrammeID: "programme-1", Code: " CREATOR-1 ",
		DisplayName: " Ama Creator ", PurchaseCommissionBPS: 900,
		CookieWindowDays: 30, Status: "active", TargetScope: "design",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected missing design target to fail, got %v", err)
	}

	targetID := common.ID("design-1")
	record, err := service.CreateBusinessAffiliate(context.Background(), BusinessAffiliateCommand{
		Scope: scope, ActorUserID: "owner-1", ActorRole: business.UserRoleOwner,
		AffiliateProgrammeID: "programme-1", Code: " creator-1 ",
		DisplayName: " Ama   Creator ", Email: "AMA@EXAMPLE.COM",
		PurchaseCommissionBPS: 900, FirstPaidPlanCommissionBPS: 0,
		CookieWindowDays: 30, Status: "active", TargetScope: "design",
		TargetRefID: &targetID,
	})
	if err != nil {
		t.Fatalf("create design affiliate: %v", err)
	}
	if record.AffiliateID != "affiliate-1" ||
		repository.createdAffiliate.Code != "CREATOR-1" ||
		repository.createdAffiliate.Email != "ama@example.com" {
		t.Fatalf("unexpected affiliate input=%+v record=%+v", repository.createdAffiliate, record)
	}
}

type fakeBusinessAffiliates struct {
	createdProgramme ports.BusinessAffiliateProgrammeInput
	createdAffiliate ports.BusinessAffiliateInput
}

func (repo *fakeBusinessAffiliates) ListBusinessAffiliateProgrammes(
	context.Context,
	common.TenantScope,
) ([]ports.BusinessAffiliateProgrammeRecord, error) {
	return nil, nil
}
func (repo *fakeBusinessAffiliates) CreateBusinessAffiliateProgramme(
	_ context.Context,
	_ common.TenantScope,
	input ports.BusinessAffiliateProgrammeInput,
) (ports.BusinessAffiliateProgrammeRecord, error) {
	repo.createdProgramme = input
	return ports.BusinessAffiliateProgrammeRecord{
		AffiliateProgrammeID: input.AffiliateProgrammeID,
		BusinessID:           input.BusinessID,
		Name:                 input.Name,
	}, nil
}
func (repo *fakeBusinessAffiliates) UpdateBusinessAffiliateProgramme(
	context.Context,
	common.TenantScope,
	ports.BusinessAffiliateProgrammeInput,
) (ports.BusinessAffiliateProgrammeRecord, error) {
	return ports.BusinessAffiliateProgrammeRecord{}, nil
}
func (repo *fakeBusinessAffiliates) ListBusinessAffiliates(
	context.Context,
	common.TenantScope,
) ([]ports.BusinessAffiliateRecord, error) {
	return nil, nil
}
func (repo *fakeBusinessAffiliates) CreateBusinessAffiliate(
	_ context.Context,
	_ common.TenantScope,
	input ports.BusinessAffiliateInput,
) (ports.BusinessAffiliateRecord, error) {
	repo.createdAffiliate = input
	return ports.BusinessAffiliateRecord{
		AffiliateID: input.AffiliateID,
		Code:        input.Code,
	}, nil
}
func (repo *fakeBusinessAffiliates) UpdateBusinessAffiliate(
	context.Context,
	common.TenantScope,
	ports.BusinessAffiliateInput,
) (ports.BusinessAffiliateRecord, error) {
	return ports.BusinessAffiliateRecord{}, nil
}
func (repo *fakeBusinessAffiliates) PauseBusinessAffiliate(
	context.Context,
	common.TenantScope,
	common.ID,
	common.ID,
) (ports.BusinessAffiliateRecord, error) {
	return ports.BusinessAffiliateRecord{}, nil
}
func (repo *fakeBusinessAffiliates) ListBusinessAffiliateAttribution(
	context.Context,
	common.TenantScope,
) ([]ports.BusinessAffiliateAttributionRecord, error) {
	return nil, nil
}
