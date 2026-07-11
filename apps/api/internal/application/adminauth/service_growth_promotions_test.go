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

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func TestPromotionsRequirePermissionAndAudit(t *testing.T) {
	t.Parallel()

	businessID := common.ID("business-1")
	maxDiscount := int64(5000)
	globalLimit := 100
	perCustomerLimit := 1
	businesses := &fakeAdminBusinesses{}
	service, audits := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		businesses,
		time.Now(),
		[]common.ID{"promotion-created", "audit-create", "audit-update", "audit-archive"},
	)

	promotions, err := service.ListPromotions(context.Background(), ListPromotionsCommand{
		ActorRole: admindomain.RoleOperator,
	})
	if err != nil {
		t.Fatalf("list promotions: %v", err)
	}
	if len(promotions) != 1 || promotions[0].Code != "WELCOME10" {
		t.Fatalf("unexpected promotions: %+v", promotions)
	}

	created, err := service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:           "operator-1",
		ActorRole:             admindomain.RoleOperator,
		BusinessID:            &businessID,
		Code:                  " welcome10 ",
		Title:                 "  Welcome   Ten  ",
		Description:           "  first order  ",
		DiscountType:          "percentage",
		DiscountValue:         1000,
		MaxDiscountMinor:      &maxDiscount,
		MinSpendMinor:         10000,
		UsageLimitGlobal:      &globalLimit,
		UsageLimitPerCustomer: &perCustomerLimit,
		FundingSource:         "split",
		Scope:                 "store",
		Status:                "active",
		UserAgent:             "test-agent",
		IPAddress:             "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create promotion: %v", err)
	}
	if created.PromotionID != "promotion-created" ||
		businesses.createdPromotion.Code != "WELCOME10" ||
		businesses.createdPromotion.Title != "Welcome Ten" ||
		businesses.createdPromotion.Description != "first order" ||
		*businesses.createdPromotion.MaxDiscountMinor != 5000 ||
		*businesses.createdPromotion.UsageLimitGlobal != 100 {
		t.Fatalf("expected normalized create input, got input=%+v record=%+v", businesses.createdPromotion, created)
	}

	updated, err := service.UpdatePromotion(context.Background(), UpdatePromotionCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		PromotionID:   "promotion-created",
		Code:          "WELCOME10",
		Title:         "Welcome Ten Paused",
		DiscountType:  "fixed",
		DiscountValue: 1500,
		MinSpendMinor: 5000,
		FundingSource: "business",
		Scope:         "store",
		Status:        "paused",
		UserAgent:     "test-agent",
		IPAddress:     "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("update promotion: %v", err)
	}
	if businesses.updatedPromotion.Status != "paused" || updated.Status != "paused" {
		t.Fatalf("expected paused update, got input=%+v record=%+v", businesses.updatedPromotion, updated)
	}

	archived, err := service.ArchivePromotion(context.Background(), ArchivePromotionCommand{
		ActorUserID: "operator-1",
		ActorRole:   admindomain.RoleOperator,
		PromotionID: "promotion-created",
		Reason:      " campaign ended ",
		UserAgent:   "test-agent",
		IPAddress:   "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("archive promotion: %v", err)
	}
	if businesses.archivedPromotion.PromotionID != "promotion-created" || archived.Status != "archived" {
		t.Fatalf("expected archived promotion, got input=%+v record=%+v", businesses.archivedPromotion, archived)
	}
	if len(audits.created) != 3 {
		t.Fatalf("expected three audit events, got %d", len(audits.created))
	}
	if audits.created[0].Action != "Created promotion" ||
		audits.created[1].Action != "Updated promotion" ||
		audits.created[2].Action != "Archived promotion" ||
		audits.created[0].Metadata["code"] != "WELCOME10" {
		t.Fatalf("unexpected audit events: %+v", audits.created)
	}

	_, err = service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:   "support-1",
		ActorRole:     admindomain.RoleSupport,
		Code:          "NOPE",
		Title:         "Nope",
		DiscountType:  "fixed",
		DiscountValue: 100,
		FundingSource: "business",
		Scope:         "store",
		Status:        "active",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected support role to be forbidden, got %v", err)
	}
}

func TestPromotionValidation(t *testing.T) {
	t.Parallel()

	service, _ := newTestServiceWithBusinesses(
		&fakeAdminUsers{},
		&fakeAdminSessions{},
		&fakeAdminBusinesses{},
		time.Now(),
		[]common.ID{"promotion", "audit"},
	)

	_, err := service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:   "operator-1",
		ActorRole:     admindomain.RoleOperator,
		Code:          "bad code",
		Title:         "Bad",
		DiscountType:  "percentage",
		DiscountValue: 1000,
		FundingSource: "business",
		Scope:         "store",
		Status:        "active",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid promotion code/cap, got %v", err)
	}

	negativeLimit := -1
	_, err = service.CreatePromotion(context.Background(), CreatePromotionCommand{
		ActorUserID:      "operator-1",
		ActorRole:        admindomain.RoleOperator,
		Code:             "FIXED10",
		Title:            "Fixed",
		DiscountType:     "fixed",
		DiscountValue:    1000,
		UsageLimitGlobal: &negativeLimit,
		FundingSource:    "business",
		Scope:            "store",
		Status:           "active",
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected invalid promotion limit, got %v", err)
	}
}

func (repo *fakeAdminBusinesses) ListAdminPromotions(context.Context) ([]ports.AdminPromotionRecord, error) {
	if repo.promotions != nil {
		return repo.promotions, nil
	}
	return []ports.AdminPromotionRecord{fakeAdminPromotionRecord(
		"promotion-1",
		nil,
		"WELCOME10",
		"Welcome Ten",
		"percentage",
		1000,
		int64Ptr(5000),
		"active",
	)}, nil
}

func (repo *fakeAdminBusinesses) CreateAdminPromotion(
	_ context.Context,
	input ports.CreateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	repo.createdPromotion = input
	return fakeAdminPromotionRecord(
		input.PromotionID,
		input.BusinessID,
		input.Code,
		input.Title,
		input.DiscountType,
		input.DiscountValue,
		input.MaxDiscountMinor,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) UpdateAdminPromotion(
	_ context.Context,
	input ports.UpdateAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	repo.updatedPromotion = input
	return fakeAdminPromotionRecord(
		input.PromotionID,
		input.BusinessID,
		input.Code,
		input.Title,
		input.DiscountType,
		input.DiscountValue,
		input.MaxDiscountMinor,
		input.Status,
	), nil
}

func (repo *fakeAdminBusinesses) ArchiveAdminPromotion(
	_ context.Context,
	input ports.ArchiveAdminPromotionInput,
) (ports.AdminPromotionRecord, error) {
	repo.archivedPromotion = input
	return fakeAdminPromotionRecord(
		input.PromotionID,
		nil,
		"WELCOME10",
		"Welcome Ten",
		"percentage",
		1000,
		int64Ptr(5000),
		"archived",
	), nil
}

func fakeAdminPromotionRecord(
	promotionID common.ID,
	businessID *common.ID,
	code string,
	title string,
	discountType string,
	discountValue int64,
	maxDiscountMinor *int64,
	status string,
) ports.AdminPromotionRecord {
	record := ports.AdminPromotionRecord{
		PromotionID:           promotionID,
		BusinessID:            businessID,
		Code:                  code,
		Title:                 title,
		Description:           "first order",
		DiscountType:          discountType,
		DiscountValue:         discountValue,
		MaxDiscountMinor:      maxDiscountMinor,
		MinSpendMinor:         10000,
		UsageLimitGlobal:      intPtr(100),
		UsageLimitPerCustomer: intPtr(1),
		FundingSource:         "business",
		Scope:                 "store",
		Status:                status,
		RedemptionCount:       2,
		DiscountRedeemedMinor: 2500,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}
	if businessID != nil {
		record.BusinessName = "Ama Stitches"
		record.BusinessHandle = "ama-stitches"
	}
	return record
}
