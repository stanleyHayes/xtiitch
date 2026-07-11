package checkoutapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func (s Service) reserveAffiliateAttribution(
	ctx context.Context,
	scope common.TenantScope,
	input affiliateCheckoutInput,
) {
	code := normalizeCheckoutPromotionCode(input.code)
	if code == "" || s.affiliates == nil || input.orderID.IsZero() || input.grossMinor <= 0 {
		return
	}

	_, err := s.affiliates.ReserveAffiliateAttribution(ctx, scope, ports.ReserveAffiliateAttributionInput{
		ReservationID: s.ids.NewID(),
		BusinessID:    scope.BusinessID,
		OrderID:       input.orderID,
		Code:          code,
		ClickID:       input.clickID,
		VisitorID:     strings.TrimSpace(input.visitorID),
		GrossMinor:    input.grossMinor,
	})
	if err == nil || errors.Is(err, ports.ErrNotFound) {
		return
	}
	s.logger.ErrorContext(ctx, "checkout: failed to reserve affiliate attribution",
		"business_id", scope.BusinessID.String(),
		"order_id", input.orderID.String(),
		"affiliate_code", code,
		"error", err)
}

func (s Service) reserveReferralAttribution(
	ctx context.Context,
	scope common.TenantScope,
	input referralCheckoutInput,
) {
	code := normalizeCheckoutPromotionCode(input.code)
	if code == "" || s.referrals == nil || input.orderID.IsZero() ||
		input.refereeCustomerID.IsZero() || input.grossMinor <= 0 {
		return
	}

	_, err := s.referrals.ReserveReferralAttribution(ctx, scope, ports.ReserveReferralAttributionInput{
		ReferralID:        s.ids.NewID(),
		BusinessID:        scope.BusinessID,
		OrderID:           input.orderID,
		RefereeCustomerID: input.refereeCustomerID,
		RefereeEmail:      strings.TrimSpace(input.refereeEmail),
		RefereePhone:      strings.TrimSpace(input.refereePhone),
		Code:              code,
		GrossMinor:        input.grossMinor,
	})
	if err == nil || errors.Is(err, ports.ErrNotFound) {
		return
	}
	s.logger.ErrorContext(ctx, "checkout: failed to reserve referral attribution",
		"business_id", scope.BusinessID.String(),
		"order_id", input.orderID.String(),
		"referral_code", code,
		"error", err)
}
