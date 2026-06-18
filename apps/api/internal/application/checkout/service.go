package checkoutapp

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

var (
	ErrInvalidInput         = errors.New("invalid checkout input")
	ErrStoreNotFound        = errors.New("store not found")
	ErrDesignUnavailable    = errors.New("design unavailable")
	ErrBandUnavailable      = errors.New("size band not available for this design")
	ErrNotVerified          = errors.New("store cannot take payments yet")
	ErrInvalidSizeMode      = errors.New("invalid size mode for a custom order")
	ErrBespokeDisabled      = errors.New("bespoke orders are not enabled for this store")
	ErrMeasurementsDisabled = errors.New("self-measurement is not enabled for this store")
	ErrInvalidMeasurements  = errors.New("invalid or missing measurements")
	ErrPromotionUnavailable = errors.New("promotion unavailable for this order")
)

// Payments is the slice of the payments use case the checkout needs.
type Payments interface {
	InitiateCharge(ctx context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error)
}

// Availability is the slice of the availability use case the booking checkout
// needs: confirm a requested slot is currently open and return it.
type Availability interface {
	ResolveOpenSlot(ctx context.Context, scope common.TenantScope, slotStart time.Time) (booking.Slot, error)
}

type Service struct {
	storefront   ports.StorefrontRepository
	businesses   ports.BusinessChargeRepository
	orders       ports.OrderRepository
	bookings     ports.BookingRepository
	promotions   ports.PromotionRepository
	affiliates   ports.AffiliateClickRepository
	referrals    ports.ReferralRepository
	availability Availability
	payments     Payments
	ids          ports.IDGenerator
	logger       *slog.Logger
}

type Dependencies struct {
	Storefront   ports.StorefrontRepository
	Businesses   ports.BusinessChargeRepository
	Orders       ports.OrderRepository
	Bookings     ports.BookingRepository
	Promotions   ports.PromotionRepository
	Affiliates   ports.AffiliateClickRepository
	Referrals    ports.ReferralRepository
	Availability Availability
	Payments     Payments
	IDs          ports.IDGenerator
	Logger       *slog.Logger
}

func NewService(deps Dependencies) Service {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return Service{
		storefront:   deps.Storefront,
		businesses:   deps.Businesses,
		orders:       deps.Orders,
		bookings:     deps.Bookings,
		promotions:   deps.Promotions,
		affiliates:   deps.Affiliates,
		referrals:    deps.Referrals,
		availability: deps.Availability,
		payments:     deps.Payments,
		ids:          deps.IDs,
		logger:       logger,
	}
}

type PlaceStandardOrderCommand struct {
	StoreHandle        string
	DesignHandle       string
	SizeBandID         common.ID
	CustomerName       string
	CustomerPhone      string
	CustomerEmail      string
	Method             money.PaymentMethod
	PromoCode          string
	AffiliateCode      string
	AffiliateClickID   common.ID
	AffiliateVisitorID string
	ReferralCode       string
}

type PlaceStandardOrderResult struct {
	OrderID          common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
	DiscountMinor    int64
}

// PlaceStandardOrder records a standard order against a listed size band and
// raises the full payment for it through the money rails. The order stays draft
// until its payment is confirmed by webhook (which advances it to its first
// stage). The account-free customer tracks it by the returned order reference.
func (s Service) PlaceStandardOrder(ctx context.Context, cmd PlaceStandardOrderCommand) (PlaceStandardOrderResult, error) {
	name := strings.TrimSpace(cmd.CustomerName)
	email := strings.TrimSpace(cmd.CustomerEmail)
	if name == "" || email == "" || cmd.SizeBandID == "" {
		return PlaceStandardOrderResult{}, ErrInvalidInput
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return PlaceStandardOrderResult{}, ErrInvalidInput
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return PlaceStandardOrderResult{}, ErrStoreNotFound
		}
		return PlaceStandardOrderResult{}, err
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
	customerID := s.ids.NewID()
	sizeBandID := cmd.SizeBandID
	if err := s.orders.CreateOnlineOrder(ctx, scope, ports.CreateOnlineOrderInput{
		OrderID:          orderID,
		BusinessID:       store.BusinessID,
		CustomerID:       customerID,
		DesignID:         designID,
		SizeBandID:       &sizeBandID,
		CustomerName:     name,
		CustomerPhone:    strings.TrimSpace(cmd.CustomerPhone),
		CustomerEmail:    email,
		AgreedTotalMinor: price,
	}); err != nil {
		return PlaceStandardOrderResult{}, err
	}

	promotion, err := s.reservePromotion(ctx, scope, promotionCheckoutInput{
		code:          cmd.PromoCode,
		orderID:       orderID,
		customerID:    customerID,
		designID:      designID,
		subtotalMinor: price,
		commissionBps: charge.CommissionBps,
	})
	if err != nil {
		s.discardDraft(ctx, scope, orderID, customerID)
		return PlaceStandardOrderResult{}, err
	}
	chargeAmount := price
	if promotion.discountMinor > 0 {
		chargeAmount = promotion.payableMinor
		if err := s.orders.SetDraftOrderAgreedTotal(ctx, scope, orderID, chargeAmount); err != nil {
			s.voidPromotionReservation(ctx, scope, orderID)
			s.discardDraft(ctx, scope, orderID, customerID)
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
	})
	if err != nil {
		// The draft order is committed but no payment was raised, so it could
		// never be confirmed. Roll it back so checkout stays all-or-nothing and
		// no un-payable draft (or its customer) is left to accumulate.
		s.voidPromotionReservation(ctx, scope, orderID)
		s.discardDraft(ctx, scope, orderID, customerID)
		return PlaceStandardOrderResult{}, err
	}

	return PlaceStandardOrderResult{
		OrderID:          orderID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      chargeAmount,
		DiscountMinor:    promotion.discountMinor,
	}, nil
}

// discardDraft compensates a checkout whose payment could not be raised by
// removing the just-created draft order. A failure here cannot be surfaced to
// the customer (the charge error is what they need), so it is logged loudly:
// the residue is a harmless never-confirmable draft, not lost money.
func (s Service) discardDraft(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) {
	if err := s.orders.DiscardDraftOrder(ctx, scope, orderID, customerID); err != nil {
		s.logger.ErrorContext(ctx, "checkout: failed to discard orphaned draft order after charge failure",
			"business_id", scope.BusinessID.String(), "order_id", orderID.String(), "error", err)
	}
}

// resolvePricedDesign loads an active design by its public handle, verifies it
// belongs to the resolved store, and returns its price for the chosen band.
func (s Service) resolvePricedDesign(ctx context.Context, businessID common.ID, designHandle string, bandID common.ID) (common.ID, int64, error) {
	design, err := s.storefront.GetActiveDesignByHandle(ctx, strings.TrimSpace(designHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return "", 0, ErrDesignUnavailable
		}
		return "", 0, err
	}
	// Handles are unguessable, but never trust one to span tenants.
	if design.Design.BusinessID != businessID {
		return "", 0, ErrDesignUnavailable
	}
	price, ok := priceForBand(design.Prices, bandID)
	if !ok {
		return "", 0, ErrBandUnavailable
	}
	return design.Design.ID, price, nil
}

func priceForBand(prices []catalogue.BandPrice, bandID common.ID) (int64, bool) {
	for _, price := range prices {
		if price.SizeBandID == bandID {
			return price.PriceMinor, true
		}
	}
	return 0, false
}

type PlaceHomeVisitBookingCommand struct {
	StoreHandle        string
	DesignHandle       string
	CustomerName       string
	CustomerPhone      string
	CustomerEmail      string
	Method             money.PaymentMethod
	PromoCode          string
	AffiliateCode      string
	AffiliateClickID   common.ID
	AffiliateVisitorID string
	ReferralCode       string
	SlotStart          time.Time
	Address            string
}

type PlaceHomeVisitBookingResult struct {
	OrderID          common.ID
	BookingID        common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
}

// PlaceHomeVisitBooking books a home visit against one of the business's open
// availability slots: it holds the slot atomically, records a draft bespoke
// order for the visit, and raises the booking deposit. The slot stays held and
// the order draft until the deposit webhook confirms both; a failed or
// un-raiseable deposit releases the slot. This is an additive flow — the
// existing custom-order endpoint is untouched.
func (s Service) PlaceHomeVisitBooking(ctx context.Context, cmd PlaceHomeVisitBookingCommand) (PlaceHomeVisitBookingResult, error) {
	customer := customerDetails{
		name:  strings.TrimSpace(cmd.CustomerName),
		phone: strings.TrimSpace(cmd.CustomerPhone),
		email: strings.TrimSpace(cmd.CustomerEmail),
	}
	if customer.name == "" || customer.email == "" || cmd.SlotStart.IsZero() {
		return PlaceHomeVisitBookingResult{}, ErrInvalidInput
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return PlaceHomeVisitBookingResult{}, ErrInvalidInput
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return PlaceHomeVisitBookingResult{}, ErrStoreNotFound
		}
		return PlaceHomeVisitBookingResult{}, err
	}
	scope := common.TenantScope{BusinessID: store.BusinessID}

	design, err := s.resolveCustomDesign(ctx, store, cmd.DesignHandle, order.SizeModeHomeVisit)
	if err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}

	charge, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}
	if !charge.Verified || charge.SubaccountRef == "" {
		return PlaceHomeVisitBookingResult{}, ErrNotVerified
	}

	slot, err := s.availability.ResolveOpenSlot(ctx, scope, cmd.SlotStart)
	if err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}

	return s.holdAndCharge(ctx, scope, store, design, slot, customer, cmd)
}

func (s Service) holdAndCharge(ctx context.Context, scope common.TenantScope, store ports.Storefront, design catalogue.Design, slot booking.Slot, customer customerDetails, cmd PlaceHomeVisitBookingCommand) (PlaceHomeVisitBookingResult, error) {
	deposit := money.ResolveDeposit(design.DepositOverrideMinor, &store.DefaultDepositMinor)

	orderID := s.ids.NewID()
	customerID := s.ids.NewID()
	bookingID := s.ids.NewID()

	if err := s.orders.CreateCustomOrder(ctx, scope, ports.CreateCustomOrderInput{
		OrderID:       orderID,
		BusinessID:    store.BusinessID,
		CustomerID:    customerID,
		DesignID:      design.ID,
		SizeMode:      string(order.SizeModeHomeVisit),
		CustomerName:  customer.name,
		CustomerPhone: customer.phone,
		CustomerEmail: customer.email,
	}); err != nil {
		return PlaceHomeVisitBookingResult{}, err
	}

	if err := s.bookings.HoldSlot(ctx, scope, ports.HoldSlotInput{
		BookingID:  bookingID,
		BusinessID: store.BusinessID,
		CustomerID: customerID,
		OrderID:    orderID,
		SlotStart:  slot.Start,
		SlotEnd:    slot.End,
		Address:    strings.TrimSpace(cmd.Address),
	}); err != nil {
		s.discardBooking(ctx, scope, bookingID, orderID, customerID)
		return PlaceHomeVisitBookingResult{}, err
	}
	s.reserveAffiliateAttribution(ctx, scope, affiliateCheckoutInput{
		code:       cmd.AffiliateCode,
		clickID:    cmd.AffiliateClickID,
		visitorID:  cmd.AffiliateVisitorID,
		orderID:    orderID,
		grossMinor: deposit,
	})
	s.reserveReferralAttribution(ctx, scope, referralCheckoutInput{
		code:              cmd.ReferralCode,
		orderID:           orderID,
		refereeCustomerID: customerID,
		grossMinor:        deposit,
	})

	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	chargeResult, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:         scope,
		OrderID:       &orderID,
		BookingID:     &bookingID,
		Purpose:       money.PaymentPurposeBookingDeposit,
		AmountMinor:   deposit,
		Method:        method,
		CustomerEmail: customer.email,
	})
	if err != nil {
		s.discardBooking(ctx, scope, bookingID, orderID, customerID)
		return PlaceHomeVisitBookingResult{}, err
	}

	return PlaceHomeVisitBookingResult{
		OrderID:          orderID,
		BookingID:        bookingID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      deposit,
	}, nil
}

func (s Service) discardBooking(ctx context.Context, scope common.TenantScope, bookingID, orderID, customerID common.ID) {
	if err := s.bookings.DiscardHeldBooking(ctx, scope, bookingID, orderID, customerID); err != nil {
		s.logger.ErrorContext(ctx, "checkout: failed to discard held booking after a failed deposit",
			"business_id", scope.BusinessID.String(), "booking_id", bookingID.String(), "order_id", orderID.String(), "error", err)
	}
}

type PlaceCustomOrderCommand struct {
	StoreHandle        string
	DesignHandle       string
	SizeMode           string
	CustomerName       string
	CustomerPhone      string
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
}

type PlaceCustomOrderResult struct {
	OrderID          common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
	DiscountMinor    int64
}

type customerDetails struct {
	name  string
	phone string
	email string
}

// PlaceCustomOrder records a custom (bespoke) order through one of the three
// measurement routes. Self-measure and home-visit raise a deposit over the money
// rails and stay draft until the deposit webhook confirms them at the first
// bespoke stage; come-to-shop is arranged in person and is confirmed at once
// with no online payment. The account-free customer tracks it by the returned id.
func (s Service) PlaceCustomOrder(ctx context.Context, cmd PlaceCustomOrderCommand) (PlaceCustomOrderResult, error) {
	customer := customerDetails{
		name:  strings.TrimSpace(cmd.CustomerName),
		phone: strings.TrimSpace(cmd.CustomerPhone),
		email: strings.TrimSpace(cmd.CustomerEmail),
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
func (s Service) resolveCustomDesign(ctx context.Context, store ports.Storefront, designHandle string, mode order.SizeMode) (catalogue.Design, error) {
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

func (s Service) placeComeToShop(ctx context.Context, scope common.TenantScope, businessID, designID common.ID, customer customerDetails) (PlaceCustomOrderResult, error) {
	orderID := s.ids.NewID()
	if err := s.orders.CreateCustomOrderConfirmed(ctx, scope, ports.CreateCustomOrderConfirmedInput{
		OrderID:       orderID,
		BusinessID:    businessID,
		CustomerID:    s.ids.NewID(),
		DesignID:      designID,
		SizeMode:      string(order.SizeModeComeToShop),
		CustomerName:  customer.name,
		CustomerPhone: customer.phone,
		CustomerEmail: customer.email,
	}); err != nil {
		return PlaceCustomOrderResult{}, err
	}
	return PlaceCustomOrderResult{OrderID: orderID}, nil
}

func (s Service) placeDepositCustomOrder(ctx context.Context, scope common.TenantScope, store ports.Storefront, design catalogue.Design, mode order.SizeMode, customer customerDetails, cmd PlaceCustomOrderCommand) (PlaceCustomOrderResult, error) {
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
	customerID := s.ids.NewID()
	input := ports.CreateCustomOrderInput{
		OrderID:       orderID,
		BusinessID:    store.BusinessID,
		CustomerID:    customerID,
		DesignID:      design.ID,
		SizeMode:      string(mode),
		CustomerName:  customer.name,
		CustomerPhone: customer.phone,
		CustomerEmail: customer.email,
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
		designID:      design.ID,
		subtotalMinor: deposit,
		commissionBps: charge.CommissionBps,
	})
	if err != nil {
		s.discardCustomDraft(ctx, scope, orderID, customerID)
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
	})
	if err != nil {
		// No deposit could be raised, so the draft custom order could never be
		// confirmed: compensate it (and its measurement + customer) away.
		s.voidPromotionReservation(ctx, scope, orderID)
		s.discardCustomDraft(ctx, scope, orderID, customerID)
		return PlaceCustomOrderResult{}, err
	}

	return PlaceCustomOrderResult{
		OrderID:          orderID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      chargeAmount,
		DiscountMinor:    promotion.discountMinor,
	}, nil
}

type promotionCheckoutInput struct {
	code          string
	orderID       common.ID
	customerID    common.ID
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

func (s Service) discardCustomDraft(ctx context.Context, scope common.TenantScope, orderID, customerID common.ID) {
	if err := s.orders.DiscardCustomDraftOrder(ctx, scope, orderID, customerID); err != nil {
		s.logger.ErrorContext(ctx, "checkout: failed to discard orphaned custom draft order after charge failure",
			"business_id", scope.BusinessID.String(), "order_id", orderID.String(), "error", err)
	}
}

// cleanMeasurements trims self-measure values and rejects the set unless every
// field carries a non-blank value. The self-measure route exists to capture
// usable measurements, so a present-but-empty value is no better than a missing
// one; the trimmed values are what get stored.
func cleanMeasurements(raw map[string]string) (map[string]string, error) {
	if len(raw) == 0 {
		return nil, ErrInvalidMeasurements
	}
	cleaned := make(map[string]string, len(raw))
	for field, value := range raw {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return nil, ErrInvalidMeasurements
		}
		cleaned[field] = trimmed
	}
	return cleaned, nil
}
