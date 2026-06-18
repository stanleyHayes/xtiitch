package catalogueapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func TestNormalizeBusinessPromotionInputCleansCodeAndTargets(t *testing.T) {
	t.Parallel()

	maxDiscount := int64(12000)
	globalLimit := 20
	perCustomerLimit := 1
	collectionID := common.ID("collection-1")

	input, err := normalizeBusinessPromotionInput(BusinessPromotionCommand{
		Scope:                 common.TenantScope{BusinessID: "business-1"},
		PromotionID:           "promotion-1",
		Code:                  "  summer_20 ",
		Title:                 "  Summer discount  ",
		Description:           "  For collection launch  ",
		DiscountType:          "percentage",
		DiscountValue:         2000,
		MaxDiscountMinor:      &maxDiscount,
		MinSpendMinor:         10000,
		UsageLimitGlobal:      &globalLimit,
		UsageLimitPerCustomer: &perCustomerLimit,
		ScopeName:             "collection",
		TargetCollectionID:    &collectionID,
		Status:                "active",
	})
	if err != nil {
		t.Fatalf("normalize business promotion: %v", err)
	}
	if input.Code != "SUMMER_20" ||
		input.Title != "Summer discount" ||
		input.Description != "For collection launch" ||
		input.BusinessID != common.ID("business-1") ||
		input.Scope != "collection" ||
		input.TargetCollectionID == nil ||
		*input.TargetCollectionID != collectionID ||
		input.TargetDesignID != nil {
		t.Fatalf("unexpected normalized input: %+v", input)
	}
}

func TestNormalizeBusinessPromotionInputRejectsUnsafeShapes(t *testing.T) {
	t.Parallel()

	maxDiscount := int64(12000)
	collectionID := common.ID("collection-1")
	designID := common.ID("design-1")
	startsAt := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	endsAt := startsAt.Add(-time.Hour)

	tests := []struct {
		name string
		cmd  BusinessPromotionCommand
	}{
		{
			name: "bad code",
			cmd: BusinessPromotionCommand{
				Code:          "x",
				Title:         "Bad",
				DiscountType:  "fixed",
				DiscountValue: 1000,
				ScopeName:     "store",
				Status:        "active",
			},
		},
		{
			name: "percentage without max discount",
			cmd: BusinessPromotionCommand{
				Code:          "PERCENT10",
				Title:         "No max",
				DiscountType:  "percentage",
				DiscountValue: 1000,
				ScopeName:     "store",
				Status:        "active",
			},
		},
		{
			name: "collection and design targets together",
			cmd: BusinessPromotionCommand{
				Code:               "BOTH10",
				Title:              "Both targets",
				DiscountType:       "percentage",
				DiscountValue:      1000,
				MaxDiscountMinor:   &maxDiscount,
				ScopeName:          "collection",
				TargetCollectionID: &collectionID,
				TargetDesignID:     &designID,
				Status:             "active",
			},
		},
		{
			name: "invalid time window",
			cmd: BusinessPromotionCommand{
				Code:             "TIME10",
				Title:            "Bad time",
				DiscountType:     "percentage",
				DiscountValue:    1000,
				MaxDiscountMinor: &maxDiscount,
				ScopeName:        "store",
				Status:           "active",
				StartsAt:         &startsAt,
				EndsAt:           &endsAt,
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := normalizeBusinessPromotionInput(tc.cmd)
			if !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("expected invalid input, got %v", err)
			}
		})
	}
}

func TestBusinessPromotionWritesRequireOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	repo := &fakePromotionRepo{}
	service := NewService(Dependencies{
		Promotions: repo,
		IDs:        &sequenceIDs{ids: []common.ID{"promotion-1"}},
	})
	maxDiscount := int64(10000)

	_, err := service.CreateBusinessPromotion(context.Background(), BusinessPromotionCommand{
		Scope:            common.TenantScope{BusinessID: "business-1"},
		ActorRole:        business.UserRoleStaff,
		Code:             "STAFF10",
		Title:            "Staff discount",
		DiscountType:     "percentage",
		DiscountValue:    1000,
		MaxDiscountMinor: &maxDiscount,
		ScopeName:        "store",
		Status:           "active",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff promotion creation to be forbidden, got %v", err)
	}
	if repo.created {
		t.Fatal("expected staff promotion creation to stop before repository write")
	}

	_, err = service.ArchiveBusinessPromotion(context.Background(), BusinessPromotionActionCommand{
		Scope:       common.TenantScope{BusinessID: "business-1"},
		ActorRole:   business.UserRoleOwner,
		PromotionID: "promotion-1",
	})
	if err != nil {
		t.Fatalf("expected owner to archive promotion, got %v", err)
	}
	if !repo.archived {
		t.Fatal("expected owner archive to reach repository")
	}
}

type fakePromotionRepo struct {
	created  bool
	archived bool
}

func (repo *fakePromotionRepo) ListBusinessPromotions(context.Context, common.TenantScope) ([]ports.BusinessPromotionRecord, error) {
	return nil, nil
}

func (repo *fakePromotionRepo) CreateBusinessPromotion(_ context.Context, scope common.TenantScope, input ports.BusinessPromotionInput) (ports.BusinessPromotionRecord, error) {
	repo.created = true
	return ports.BusinessPromotionRecord{PromotionID: input.PromotionID, BusinessID: scope.BusinessID}, nil
}

func (repo *fakePromotionRepo) UpdateBusinessPromotion(_ context.Context, scope common.TenantScope, input ports.BusinessPromotionInput) (ports.BusinessPromotionRecord, error) {
	return ports.BusinessPromotionRecord{PromotionID: input.PromotionID, BusinessID: scope.BusinessID}, nil
}

func (repo *fakePromotionRepo) ArchiveBusinessPromotion(_ context.Context, scope common.TenantScope, promotionID common.ID) (ports.BusinessPromotionRecord, error) {
	repo.archived = true
	return ports.BusinessPromotionRecord{PromotionID: promotionID, BusinessID: scope.BusinessID}, nil
}

func (repo *fakePromotionRepo) ReservePromotion(context.Context, common.TenantScope, ports.ReservePromotionInput) (ports.PromotionRedemption, error) {
	return ports.PromotionRedemption{}, nil
}

func (repo *fakePromotionRepo) VoidPendingPromotionRedemptions(context.Context, common.TenantScope, common.ID) error {
	return nil
}
