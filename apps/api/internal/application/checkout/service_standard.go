package checkoutapp

import (
	"context"
	"errors"
	"strings"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

type PlaceStandardOrderCommand struct {
	// CustomerID is supplied only after the public handler verifies an optional
	// customer bearer token. It keeps email-only sign-ins attached to their real
	// account instead of creating an anonymous customer for every checkout.
	CustomerID         common.ID
	StoreHandle        string
	DesignHandle       string
	SizeBandID         common.ID
	CustomerName       string
	CustomerPhone      string
	CustomerWhatsApp   string
	CustomerEmail      string
	Method             money.PaymentMethod
	PromoCode          string
	AffiliateCode      string
	AffiliateClickID   common.ID
	AffiliateVisitorID string
	ReferralCode       string
	// Note is the customer's free-text instruction captured at checkout ('' if none).
	Note string
	// CallbackURL is where the payment provider returns the customer after they
	// pay (§5.2: back to the cart so they can settle the next store basket).
	// Optional; validated by CleanCallbackURL.
	CallbackURL string
}

type PlaceStandardOrderResult struct {
	OrderID          common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
	DiscountMinor    int64
	// Quote is the §4.2–§4.6 fee breakdown behind the charge, so the checkout
	// response renders exactly what the customer pays.
	Quote money.StoreSaleQuote
}

// PlaceStandardOrder records a standard order against a listed size band and
// raises the full payment for it through the money rails. The order stays draft
// until its payment is confirmed by webhook (which advances it to its first
// stage). The account-free customer tracks it by the returned order reference.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) PlaceStandardOrder(ctx context.Context, cmd PlaceStandardOrderCommand) (PlaceStandardOrderResult, error) {
	name := strings.TrimSpace(cmd.CustomerName)
	email := strings.TrimSpace(cmd.CustomerEmail)
	if name == "" || email == "" || cmd.SizeBandID == "" {
		return PlaceStandardOrderResult{}, ErrInvalidInput
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return PlaceStandardOrderResult{}, ErrInvalidInput
	}
	callbackURL, err := CleanCallbackURL(cmd.CallbackURL)
	if err != nil {
		return PlaceStandardOrderResult{}, err
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return PlaceStandardOrderResult{}, ErrStoreNotFound
		}
		return PlaceStandardOrderResult{}, err
	}
	if !store.OnlineOrderingEnabled {
		return PlaceStandardOrderResult{}, ErrOnlineOrderingOff
	}
	scope := common.TenantScope{BusinessID: store.BusinessID}

	charge, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return PlaceStandardOrderResult{}, err
	}
	if !charge.Verified || charge.SubaccountRef == "" {
		return PlaceStandardOrderResult{}, ErrNotVerified
	}

	designID, price, err := s.resolvePricedDesign(ctx, store.BusinessID, cmd.DesignHandle, cmd.SizeBandID)
	if err != nil {
		return PlaceStandardOrderResult{}, err
	}

	orderID := s.ids.NewID()
	customerID := cmd.CustomerID
	customerCreated := false
	if customerID.IsZero() {
		customerID, customerCreated, err = s.resolveCustomerByPhone(ctx, cmd.CustomerPhone)
		if err != nil {
			return PlaceStandardOrderResult{}, err
		}
	}
	cleanupCustomerID := common.ID("")
	if customerCreated {
		cleanupCustomerID = customerID
	}
	sizeBandID := cmd.SizeBandID
	if err := s.orders.CreateOnlineOrder(ctx, scope, ports.CreateOnlineOrderInput{
		OrderID:          orderID,
		BusinessID:       store.BusinessID,
		CustomerID:       customerID,
		DesignID:         designID,
		SizeBandID:       &sizeBandID,
		CustomerName:     name,
		CustomerPhone:    strings.TrimSpace(cmd.CustomerPhone),
		CustomerWhatsApp: strings.TrimSpace(cmd.CustomerWhatsApp),
		CustomerEmail:    email,
		AgreedTotalMinor: price,
		Note:             strings.TrimSpace(cmd.Note),
	}); err != nil {
		return PlaceStandardOrderResult{}, err
	}

	promotion, err := s.reservePromotion(ctx, scope, promotionCheckoutInput{
		code:          cmd.PromoCode,
		orderID:       orderID,
		customerID:    customerID,
		customerEmail: email,
		customerPhone: strings.TrimSpace(cmd.CustomerPhone),
		designID:      designID,
		subtotalMinor: price,
		commissionBps: charge.CommissionBps,
	})
	if err != nil {
		s.discardDraft(ctx, scope, orderID, cleanupCustomerID)
		return PlaceStandardOrderResult{}, err
	}
	chargeAmount := price
	if promotion.discountMinor > 0 {
		chargeAmount = promotion.payableMinor
		if err := s.orders.SetDraftOrderAgreedTotal(ctx, scope, orderID, chargeAmount); err != nil {
			s.voidPromotionReservation(ctx, scope, orderID)
			s.discardDraft(ctx, scope, orderID, cleanupCustomerID)
			return PlaceStandardOrderResult{}, err
		}
	}
	s.reserveAffiliateAttribution(ctx, scope, affiliateCheckoutInput{
		code:       cmd.AffiliateCode,
		clickID:    cmd.AffiliateClickID,
		visitorID:  cmd.AffiliateVisitorID,
		orderID:    orderID,
		grossMinor: chargeAmount,
	})
	s.reserveReferralAttribution(ctx, scope, referralCheckoutInput{
		code:              cmd.ReferralCode,
		orderID:           orderID,
		refereeCustomerID: customerID,
		refereeEmail:      email,
		refereePhone:      strings.TrimSpace(cmd.CustomerPhone),
		grossMinor:        chargeAmount,
	})

	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	chargeResult, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:                   scope,
		OrderID:                 &orderID,
		Purpose:                 money.PaymentPurposeStandardFull,
		AmountMinor:             chargeAmount,
		CommissionMinorOverride: promotion.commissionMinor,
		Method:                  method,
		CustomerEmail:           email,
		CallbackURL:             callbackURL,
	})
	if err != nil {
		// The draft order is committed but no payment was raised, so it could
		// never be confirmed. Roll it back so checkout stays all-or-nothing and
		// no un-payable draft (or its customer) is left to accumulate.
		s.voidPromotionReservation(ctx, scope, orderID)
		s.discardDraft(ctx, scope, orderID, cleanupCustomerID)
		return PlaceStandardOrderResult{}, err
	}

	return PlaceStandardOrderResult{
		OrderID:          orderID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      chargeAmount,
		DiscountMinor:    promotion.discountMinor,
		Quote:            chargeResult.Quote,
	}, nil
}
