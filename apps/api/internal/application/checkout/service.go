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
)

var (
	ErrInvalidInput      = errors.New("invalid checkout input")
	ErrStoreNotFound     = errors.New("store not found")
	ErrDesignUnavailable = errors.New("design unavailable")
	ErrBandUnavailable   = errors.New("size band not available for this design")
	ErrNotVerified       = errors.New("store cannot take payments yet")
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
