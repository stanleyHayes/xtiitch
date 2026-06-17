package ports

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type PromotionRepository interface {
	ReservePromotion(ctx context.Context, scope common.TenantScope, input ReservePromotionInput) (PromotionRedemption, error)
	VoidPendingPromotionRedemptions(ctx context.Context, scope common.TenantScope, orderID common.ID) error
}

type ReservePromotionInput struct {
	RedemptionID  common.ID
	BusinessID    common.ID
	OrderID       common.ID
	CustomerID    common.ID
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
