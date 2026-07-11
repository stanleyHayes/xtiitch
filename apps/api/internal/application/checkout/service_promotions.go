package checkoutapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

type promotionCheckoutInput struct {
	code          string
	orderID       common.ID
	customerID    common.ID
	customerEmail string
	customerPhone string
	designID      common.ID
	subtotalMinor int64
	commissionBps int
}

type promotionCheckoutResult struct {
	payableMinor    int64
	discountMinor   int64
	commissionMinor *int64
}

type affiliateCheckoutInput struct {
	code       string
	clickID    common.ID
	visitorID  string
	orderID    common.ID
	grossMinor int64
}

type referralCheckoutInput struct {
	code              string
	orderID           common.ID
	refereeCustomerID common.ID
	refereeEmail      string
	refereePhone      string
	grossMinor        int64
}

func (s Service) reservePromotion(
	ctx context.Context,
	scope common.TenantScope,
	input promotionCheckoutInput,
) (promotionCheckoutResult, error) {
	code := normalizeCheckoutPromotionCode(input.code)
	if code == "" {
		return promotionCheckoutResult{payableMinor: input.subtotalMinor}, nil
	}
	if s.promotions == nil {
		return promotionCheckoutResult{}, ErrPromotionUnavailable
	}

	redemption, err := s.promotions.ReservePromotion(ctx, scope, ports.ReservePromotionInput{
		RedemptionID:  s.ids.NewID(),
		BusinessID:    scope.BusinessID,
		OrderID:       input.orderID,
		CustomerID:    input.customerID,
		CustomerEmail: strings.TrimSpace(input.customerEmail),
		CustomerPhone: strings.TrimSpace(input.customerPhone),
		DesignID:      input.designID,
		Code:          code,
		SubtotalMinor: input.subtotalMinor,
	})
	if err != nil {
		if errors.Is(err, ports.ErrPromotionUnavailable) || errors.Is(err, ports.ErrNotFound) {
			return promotionCheckoutResult{}, ErrPromotionUnavailable
		}
		return promotionCheckoutResult{}, err
	}
	if redemption.DiscountMinor <= 0 || redemption.DiscountMinor >= input.subtotalMinor {
		s.voidPromotionReservation(ctx, scope, input.orderID)
		return promotionCheckoutResult{}, ErrPromotionUnavailable
	}

	payable := input.subtotalMinor - redemption.DiscountMinor
	commission, err := promotionCommissionMinor(
		input.subtotalMinor,
		payable,
		redemption.DiscountMinor,
		input.commissionBps,
		redemption.FundingSource,
	)
	if err != nil {
		s.voidPromotionReservation(ctx, scope, input.orderID)
		return promotionCheckoutResult{}, err
	}

	return promotionCheckoutResult{
		payableMinor:    payable,
		discountMinor:   redemption.DiscountMinor,
		commissionMinor: &commission,
	}, nil
}

func (s Service) voidPromotionReservation(ctx context.Context, scope common.TenantScope, orderID common.ID) {
	if s.promotions == nil || orderID.IsZero() {
		return
	}
	if err := s.promotions.VoidPendingPromotionRedemptions(ctx, scope, orderID); err != nil {
		s.logger.ErrorContext(ctx, "checkout: failed to void pending promotion redemption",
			"business_id", scope.BusinessID.String(), "order_id", orderID.String(), "error", err)
	}
}

func normalizeCheckoutPromotionCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}
func promotionCommissionMinor(
	originalMinor int64,
	payableMinor int64,
	discountMinor int64,
	commissionBps int,
	fundingSource string,
) (int64, error) {
	originalCommission := money.Commission(originalMinor, commissionBps)
	switch fundingSource {
	case "business":
		if originalCommission > payableMinor {
			return 0, ErrPromotionUnavailable
		}
		return originalCommission, nil
	case "platform":
		if discountMinor > originalCommission {
			return 0, ErrPromotionUnavailable
		}
		return originalCommission - discountMinor, nil
	case "split":
		return money.Commission(payableMinor, commissionBps), nil
	default:
		return 0, ErrPromotionUnavailable
	}
}
