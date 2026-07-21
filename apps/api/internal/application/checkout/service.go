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
)

var (
	ErrInvalidInput         = errors.New("invalid checkout input")
	ErrStoreNotFound        = errors.New("store not found")
	ErrDesignUnavailable    = errors.New("design unavailable")
	ErrBandUnavailable      = errors.New("size band not available for this design")
	ErrNotVerified          = errors.New("store cannot take payments yet")
	ErrOnlineOrderingOff    = errors.New("store does not offer online ordering")
	ErrInvalidSizeMode      = errors.New("invalid size mode for a custom order")
	ErrBespokeDisabled      = errors.New("bespoke orders are not enabled for this store")
	ErrMeasurementsDisabled = errors.New("self-measurement is not enabled for this store")
	ErrInvalidMeasurements  = errors.New("invalid or missing measurements")
	ErrPromotionUnavailable = errors.New("promotion unavailable for this order")
	ErrDeliveryUnavailable  = errors.New("delivery unavailable for this order")
)

// maxCartLines bounds a combined cart checkout (one DB round-trip per line + one
// group insert) to a realistic basket size.
const maxCartLines = 50

// deliveryChoice is the resolved delivery snapshot for a checkout: what to record
// on the order and the fee to add to the charge. A zero value means pickup / no
// delivery (no fee).
type deliveryChoice struct {
	method   string
	address  string
	feeMinor int64
	zoneID   *common.ID
}

// resolveDelivery validates a chosen delivery zone for a store. An empty zone id
// is pickup/no delivery (no fee). A zone is honoured only when the store has
// delivery enabled, the zone exists for the tenant and is active, and a
// destination address is given; otherwise ErrDeliveryUnavailable / ErrInvalidInput.
func (s Service) resolveDelivery(
	ctx context.Context,
	scope common.TenantScope,
	store ports.Storefront,
	zoneID common.ID,
	address string,
) (deliveryChoice, error) {
	if zoneID == "" {
		return deliveryChoice{}, nil
	}
	if !store.Settings.DeliveryEnabled {
		return deliveryChoice{}, ErrDeliveryUnavailable
	}
	address = strings.TrimSpace(address)
	if address == "" {
		return deliveryChoice{}, ErrInvalidInput
	}
	zone, err := s.deliveryZones.GetDeliveryZone(ctx, scope, zoneID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return deliveryChoice{}, ErrDeliveryUnavailable
		}
		return deliveryChoice{}, err
	}
	if !zone.Active {
		return deliveryChoice{}, ErrDeliveryUnavailable
	}
	id := zone.ID
	// "delivery" matches delivery.MethodDelivery and the orders.delivery_method
	// CHECK; kept as a literal to avoid importing the domain just for one string.
	return deliveryChoice{method: "delivery", address: address, feeMinor: zone.FeeMinor, zoneID: &id}, nil
}

// Payments is the slice of the payments use case the checkout needs.
type Payments interface {
	InitiateCharge(ctx context.Context, command paymentsapp.InitiateChargeCommand) (paymentsapp.ChargeResult, error)
	// QuoteStoreSale prices a store basket's fee breakdown WITHOUT charging it
	// (§4.5): the same computation the charge uses, for the read-only
	// checkout-quote endpoint.
	QuoteStoreSale(ctx context.Context, command paymentsapp.QuoteStoreSaleCommand) (money.StoreSaleQuote, error)
	// VerifyPayment settles a payment the webhook may have missed, against the
	// provider's ground truth, for the public payments/verify endpoint.
	VerifyPayment(ctx context.Context, command paymentsapp.VerifyPaymentCommand) (paymentsapp.VerifyPaymentResult, error)
}

// Availability is the slice of the availability use case the booking checkout
// needs: confirm a requested slot is currently open and return it.
type Availability interface {
	ResolveOpenSlot(ctx context.Context, scope common.TenantScope, slotStart time.Time) (booking.Slot, error)
}

type Service struct {
	storefront    ports.StorefrontRepository
	businesses    ports.BusinessChargeRepository
	orders        ports.OrderRepository
	bookings      ports.BookingRepository
	promotions    ports.PromotionRepository
	affiliates    ports.AffiliateClickRepository
	referrals     ports.ReferralRepository
	deliveryZones ports.DeliveryZoneRepository
	availability  Availability
	payments      Payments
	ids           ports.IDGenerator
	logger        *slog.Logger
}

type Dependencies struct {
	Storefront    ports.StorefrontRepository
	Businesses    ports.BusinessChargeRepository
	Orders        ports.OrderRepository
	Bookings      ports.BookingRepository
	Promotions    ports.PromotionRepository
	Affiliates    ports.AffiliateClickRepository
	Referrals     ports.ReferralRepository
	DeliveryZones ports.DeliveryZoneRepository
	Availability  Availability
	Payments      Payments
	IDs           ports.IDGenerator
	Logger        *slog.Logger
}

func NewService(deps Dependencies) Service {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return Service{
		storefront:    deps.Storefront,
		businesses:    deps.Businesses,
		orders:        deps.Orders,
		bookings:      deps.Bookings,
		promotions:    deps.Promotions,
		affiliates:    deps.Affiliates,
		referrals:     deps.Referrals,
		deliveryZones: deps.DeliveryZones,
		availability:  deps.Availability,
		payments:      deps.Payments,
		ids:           deps.IDs,
		logger:        logger,
	}
}

func (s Service) discardGroup(ctx context.Context, scope common.TenantScope, groupID, customerID common.ID) {
	if err := s.orders.DiscardDraftOrderGroup(ctx, scope, groupID, customerID); err != nil {
		s.logger.ErrorContext(ctx, "checkout: failed to discard orphaned cart order group",
			"business_id", scope.BusinessID.String(), "group_id", groupID.String(), "error", err)
	}
}

// StoreDeliveryZones lists the active delivery zones a storefront offers at
// checkout. It returns an empty list (not an error) when the store does not
// exist or has delivery turned off, so the public checkout simply shows pickup
// only.
func (s Service) StoreDeliveryZones(ctx context.Context, storeHandle string) ([]ports.DeliveryZone, error) {
	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(storeHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return []ports.DeliveryZone{}, nil
		}
		return nil, err
	}
	if !store.Settings.DeliveryEnabled {
		return []ports.DeliveryZone{}, nil
	}
	return s.deliveryZones.ListActiveDeliveryZones(ctx, common.TenantScope{BusinessID: store.BusinessID})
}

// resolveCustomerByPhone links a returning guest (by phone) to their existing
// customer record so repeat orders aggregate under one identity. It returns the
// resolved-or-new customer id and whether it was freshly created — only a
// freshly-created customer is cleaned up if the checkout rolls back (an existing
// customer is shared across orders). A phone no Ghana form can parse comes back
// as ErrInvalidInput (the repository refuses to store it) so checkout answers
// 400 invalid_order instead of silently minting a fragmented identity.
func (s Service) resolveCustomerByPhone(ctx context.Context, phone string) (common.ID, bool, error) {
	// Atomic resolve-or-create under an advisory lock on the phone, so two
	// simultaneous first-time orders from the same number share one identity
	// instead of racing to mint duplicate customers. On any other error, fall
	// back to a fresh id (best-effort, preserving the previous non-atomic
	// behaviour).
	id, created, err := s.orders.ResolveOrCreateCustomerByPhone(ctx, strings.TrimSpace(phone), s.ids.NewID())
	if err == nil {
		return id, created, nil
	}
	if errors.Is(err, common.ErrInvalidPhone) {
		return "", false, ErrInvalidInput
	}
	return s.ids.NewID(), true, nil
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
func (s Service) resolvePricedDesign(
	ctx context.Context,
	businessID common.ID,
	designHandle string,
	bandID common.ID,
) (common.ID, int64, error) {
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

type customerDetails struct {
	name     string
	phone    string
	whatsapp string
	email    string
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
