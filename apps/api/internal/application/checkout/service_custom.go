package checkoutapp

import (
	"context"
	"errors"
	"strings"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

type PlaceCustomOrderCommand struct {
	StoreHandle        string
	DesignHandle       string
	SizeMode           string
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
	// Measurements maps the business's measurement field ids to entered values;
	// only used (and required) for the self-measure route.
	Measurements map[string]string
	// Note is the customer's free-text instruction captured at checkout ('' if none).
	Note string
	// CallbackURL is where the payment provider returns the customer after they
	// pay the deposit (§5.2). Optional; validated by cleanCallbackURL.
	CallbackURL string
}

type PlaceCustomOrderResult struct {
	OrderID          common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
	DiscountMinor    int64
	// Quote is the §4.2–§4.6 fee breakdown behind the deposit charge, so the
	// checkout response renders exactly what the customer pays.
	Quote money.StoreSaleQuote
}

// PlaceCustomOrder records a custom (bespoke) order through one of the three
// measurement routes. Self-measure and home-visit raise a deposit over the money
// rails and stay draft until the deposit webhook confirms them at the first
// bespoke stage; come-to-shop is arranged in person and is confirmed at once
// with no online payment. The account-free customer tracks it by the returned id.
func (s Service) PlaceCustomOrder(ctx context.Context, cmd PlaceCustomOrderCommand) (PlaceCustomOrderResult, error) {
	customer := customerDetails{
		name:     strings.TrimSpace(cmd.CustomerName),
		phone:    strings.TrimSpace(cmd.CustomerPhone),
		whatsapp: strings.TrimSpace(cmd.CustomerWhatsApp),
		email:    strings.TrimSpace(cmd.CustomerEmail),
	}
	if customer.name == "" || customer.email == "" {
		return PlaceCustomOrderResult{}, ErrInvalidInput
	}
	mode := order.SizeMode(cmd.SizeMode)
	if !mode.IsCustomRoute() {
		return PlaceCustomOrderResult{}, ErrInvalidSizeMode
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return PlaceCustomOrderResult{}, ErrInvalidInput
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return PlaceCustomOrderResult{}, ErrStoreNotFound
		}
		return PlaceCustomOrderResult{}, err
	}
	if !store.OnlineOrderingEnabled {
		return PlaceCustomOrderResult{}, ErrOnlineOrderingOff
	}
	scope := common.TenantScope{BusinessID: store.BusinessID}

	design, err := s.resolveCustomDesign(ctx, store, cmd.DesignHandle, mode)
	if err != nil {
		return PlaceCustomOrderResult{}, err
	}

	if mode == order.SizeModeComeToShop {
		if normalizeCheckoutPromotionCode(cmd.PromoCode) != "" {
			return PlaceCustomOrderResult{}, ErrPromotionUnavailable
		}
		return s.placeComeToShop(ctx, scope, store.BusinessID, design.ID, customer)
	}
	return s.placeDepositCustomOrder(ctx, scope, store, design, mode, customer, cmd)
}

// resolveCustomDesign loads an active design for a custom order, gating on the
// store's bespoke (and, for self-measure, measurements) switch, and never letting
// an unguessable handle span tenants.
func (s Service) resolveCustomDesign(
	ctx context.Context,
	store ports.Storefront,
	designHandle string,
	mode order.SizeMode,
) (catalogue.Design, error) {
	if !store.Settings.BespokeEnabled {
		return catalogue.Design{}, ErrBespokeDisabled
	}
	if mode == order.SizeModeSelfMeasure && !store.Settings.MeasurementsEnabled {
		return catalogue.Design{}, ErrMeasurementsDisabled
	}
	design, err := s.storefront.GetActiveDesignByHandle(ctx, strings.TrimSpace(designHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return catalogue.Design{}, ErrDesignUnavailable
		}
		return catalogue.Design{}, err
	}
	if design.Design.BusinessID != store.BusinessID {
		return catalogue.Design{}, ErrDesignUnavailable
	}
	return design.Design, nil
}

func (s Service) placeComeToShop(
	ctx context.Context,
	scope common.TenantScope,
	businessID, designID common.ID,
	customer customerDetails,
) (PlaceCustomOrderResult, error) {
	orderID := s.ids.NewID()
	customerID, _, err := s.resolveCustomerByPhone(ctx, customer.phone)
	if err != nil {
		return PlaceCustomOrderResult{}, err
	}
	if err := s.orders.CreateCustomOrderConfirmed(ctx, scope, ports.CreateCustomOrderConfirmedInput{
		OrderID:          orderID,
		BusinessID:       businessID,
		CustomerID:       customerID,
		DesignID:         designID,
		SizeMode:         string(order.SizeModeComeToShop),
		CustomerName:     customer.name,
		CustomerPhone:    customer.phone,
		CustomerWhatsApp: customer.whatsapp,
		CustomerEmail:    customer.email,
	}); err != nil {
		return PlaceCustomOrderResult{}, err
	}
	return PlaceCustomOrderResult{OrderID: orderID}, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) placeDepositCustomOrder(
	ctx context.Context,
	scope common.TenantScope,
	store ports.Storefront,
	design catalogue.Design,
	mode order.SizeMode,
	customer customerDetails,
	cmd PlaceCustomOrderCommand,
) (PlaceCustomOrderResult, error) {
	// Only the deposit path raises a payment, so only it takes a callback_url
	// (a come-to-shop order is arranged in person and charges nothing online).
	callbackURL, err := cleanCallbackURL(cmd.CallbackURL)
	if err != nil {
		return PlaceCustomOrderResult{}, err
	}
	var measurements map[string]string
	if mode == order.SizeModeSelfMeasure {
		cleaned, err := cleanMeasurements(cmd.Measurements)
		if err != nil {
			return PlaceCustomOrderResult{}, err
		}
		measurements = cleaned
	}

	charge, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return PlaceCustomOrderResult{}, err
	}
	if !charge.Verified || charge.SubaccountRef == "" {
		return PlaceCustomOrderResult{}, ErrNotVerified
	}

	deposit := money.ResolveDeposit(design.DepositOverrideMinor, &store.DefaultDepositMinor)

	orderID := s.ids.NewID()
	customerID, customerCreated, err := s.resolveCustomerByPhone(ctx, customer.phone)
	if err != nil {
		return PlaceCustomOrderResult{}, err
	}
	cleanupCustomerID := common.ID("")
	if customerCreated {
		cleanupCustomerID = customerID
	}
	input := ports.CreateCustomOrderInput{
		OrderID:          orderID,
		BusinessID:       store.BusinessID,
		CustomerID:       customerID,
		DesignID:         design.ID,
		SizeMode:         string(mode),
		CustomerName:     customer.name,
		CustomerPhone:    customer.phone,
		CustomerWhatsApp: customer.whatsapp,
		CustomerEmail:    customer.email,
		Note:             strings.TrimSpace(cmd.Note),
	}
	if mode == order.SizeModeSelfMeasure {
		input.MeasurementID = s.ids.NewID()
		input.Measurements = measurements
	}
	if err := s.orders.CreateCustomOrder(ctx, scope, input); err != nil {
		if errors.Is(err, ports.ErrUnknownMeasurementField) {
			return PlaceCustomOrderResult{}, ErrInvalidMeasurements
		}
		return PlaceCustomOrderResult{}, err
	}

	promotion, err := s.reservePromotion(ctx, scope, promotionCheckoutInput{
		code:          cmd.PromoCode,
		orderID:       orderID,
		customerID:    customerID,
		customerEmail: customer.email,
		customerPhone: customer.phone,
		designID:      design.ID,
		subtotalMinor: deposit,
		commissionBps: charge.CommissionBps,
	})
	if err != nil {
		s.discardCustomDraft(ctx, scope, orderID, cleanupCustomerID)
		return PlaceCustomOrderResult{}, err
	}
	chargeAmount := deposit
	if promotion.discountMinor > 0 {
		chargeAmount = promotion.payableMinor
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
		refereeEmail:      customer.email,
		refereePhone:      customer.phone,
		grossMinor:        chargeAmount,
	})

	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	chargeResult, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:                   scope,
		OrderID:                 &orderID,
		Purpose:                 money.PaymentPurposeDeposit,
		AmountMinor:             chargeAmount,
		CommissionMinorOverride: promotion.commissionMinor,
		Method:                  method,
		CustomerEmail:           customer.email,
		CallbackURL:             callbackURL,
	})
	if err != nil {
		// No deposit could be raised, so the draft custom order could never be
		// confirmed: compensate it (and its measurement + customer) away.
		s.voidPromotionReservation(ctx, scope, orderID)
		s.discardCustomDraft(ctx, scope, orderID, cleanupCustomerID)
		return PlaceCustomOrderResult{}, err
	}

	return PlaceCustomOrderResult{
		OrderID:          orderID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      chargeAmount,
		DiscountMinor:    promotion.discountMinor,
		Quote:            chargeResult.Quote,
	}, nil
}
