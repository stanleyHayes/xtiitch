package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type PromotionRepository interface {
	ListBusinessPromotions(ctx context.Context, scope common.TenantScope) ([]BusinessPromotionRecord, error)
	CreateBusinessPromotion(ctx context.Context, scope common.TenantScope, input BusinessPromotionInput) (BusinessPromotionRecord, error)
	UpdateBusinessPromotion(ctx context.Context, scope common.TenantScope, input BusinessPromotionInput) (BusinessPromotionRecord, error)
	ArchiveBusinessPromotion(ctx context.Context, scope common.TenantScope, promotionID common.ID) (BusinessPromotionRecord, error)
	ReservePromotion(ctx context.Context, scope common.TenantScope, input ReservePromotionInput) (PromotionRedemption, error)
	VoidPendingPromotionRedemptions(ctx context.Context, scope common.TenantScope, orderID common.ID) error
}

type BusinessPromotionRecord struct {
	PromotionID           common.ID
	BusinessID            common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	RedemptionCount       int
	DiscountRedeemedMinor int64
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type BusinessPromotionInput struct {
	PromotionID           common.ID
	BusinessID            common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
}

type ReservePromotionInput struct {
	RedemptionID  common.ID
	BusinessID    common.ID
	OrderID       common.ID
	CustomerID    common.ID
	CustomerEmail string
	CustomerPhone string
	DesignID      common.ID
	Code          string
	SubtotalMinor int64
}

type PromotionRedemption struct {
	RedemptionID  common.ID
	PromotionID   common.ID
	BusinessID    common.ID
	OrderID       common.ID
	CustomerID    common.ID
	Code          string
	DiscountMinor int64
	FundingSource string
	SubtotalMinor int64
}
