package checkoutapp

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
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
)

// Payments is the slice of the payments use case the checkout needs.
type Payments interface {
	InitiateCharge(ctx context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error)
}

type Service struct {
	storefront ports.StorefrontRepository
	businesses ports.BusinessChargeRepository
	orders     ports.OrderRepository
	payments   Payments
	ids        ports.IDGenerator
	logger     *slog.Logger
}

type Dependencies struct {
	Storefront ports.StorefrontRepository
	Businesses ports.BusinessChargeRepository
	Orders     ports.OrderRepository
	Payments   Payments
	IDs        ports.IDGenerator
	Logger     *slog.Logger
}

func NewService(deps Dependencies) Service {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return Service{
		storefront: deps.Storefront,
		businesses: deps.Businesses,
		orders:     deps.Orders,
		payments:   deps.Payments,
		ids:        deps.IDs,
		logger:     logger,
	}
}

type PlaceStandardOrderCommand struct {
	StoreHandle   string
	DesignHandle  string
	SizeBandID    common.ID
	CustomerName  string
	CustomerPhone string
	CustomerEmail string
	Method        money.PaymentMethod
}

type PlaceStandardOrderResult struct {
	OrderID          common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
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

	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	chargeResult, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:         scope,
		OrderID:       &orderID,
		Purpose:       money.PaymentPurposeStandardFull,
		AmountMinor:   price,
		Method:        method,
		CustomerEmail: email,
	})
	if err != nil {
		// The draft order is committed but no payment was raised, so it could
		// never be confirmed. Roll it back so checkout stays all-or-nothing and
		// no un-payable draft (or its customer) is left to accumulate.
		s.discardDraft(ctx, scope, orderID, customerID)
		return PlaceStandardOrderResult{}, err
	}

	return PlaceStandardOrderResult{
		OrderID:          orderID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      price,
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

type PlaceCustomOrderCommand struct {
	StoreHandle   string
	DesignHandle  string
	SizeMode      string
	CustomerName  string
	CustomerPhone string
	CustomerEmail string
	Method        money.PaymentMethod
	// Measurements maps the business's measurement field ids to entered values;
	// only used (and required) for the self-measure route.
	Measurements map[string]string
}

type PlaceCustomOrderResult struct {
	OrderID          common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
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

	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	chargeResult, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:         scope,
		OrderID:       &orderID,
		Purpose:       money.PaymentPurposeDeposit,
		AmountMinor:   deposit,
		Method:        method,
		CustomerEmail: customer.email,
	})
	if err != nil {
		// No deposit could be raised, so the draft custom order could never be
		// confirmed: compensate it (and its measurement + customer) away.
		s.discardCustomDraft(ctx, scope, orderID, customerID)
		return PlaceCustomOrderResult{}, err
	}

	return PlaceCustomOrderResult{
		OrderID:          orderID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      deposit,
	}, nil
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
