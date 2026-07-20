package checkoutapp

import (
	"context"
	"errors"
	"strings"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

// CartLineKind identifies how one cart line should become an order. Made-to-wear
// lines use a listed size band; bespoke lines collect a self-measure deposit.
type CartLineKind string

const (
	CartLineMadeToWear CartLineKind = "made_to_wear"
	CartLineBespoke    CartLineKind = "bespoke"
)

func (kind CartLineKind) normalized() CartLineKind {
	switch kind {
	case "", CartLineMadeToWear:
		return CartLineMadeToWear
	case CartLineBespoke:
		return CartLineBespoke
	default:
		return kind
	}
}

// CartLineCommand is one piece in a combined cart checkout. Made-to-wear lines
// require a listed design and chosen size band. Bespoke lines require the
// self-measure route and measurement values; their amount is the design/store
// deposit and the remaining balance can still be negotiated later.
type CartLineCommand struct {
	DesignHandle string
	SizeBandID   common.ID
	Kind         CartLineKind
	SizeMode     order.SizeMode
	Measurements map[string]string
	// Note is the customer's free-text instruction for this line ('' if none).
	Note string
}

type PlaceCartOrderCommand struct {
	StoreHandle      string
	Lines            []CartLineCommand
	CustomerName     string
	CustomerPhone    string
	CustomerWhatsApp string
	CustomerEmail    string
	Method           money.PaymentMethod
	// DeliveryZoneID + DeliveryAddress are set when the customer chose delivery.
	// An empty zone id means pickup (no fee).
	DeliveryZoneID  common.ID
	DeliveryAddress string
	// CallbackURL is where the payment provider returns the customer after they
	// pay this basket (§5.2: back to the cart, or home when no baskets remain).
	// Optional; validated by cleanCallbackURL.
	CallbackURL string
}

type PlaceCartOrderResult struct {
	GroupID          common.ID
	OrderID          common.ID
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
	// Quote is the §4.2–§4.6 fee breakdown behind the combined charge, so the
	// checkout response renders exactly what the customer pays.
	Quote money.StoreSaleQuote
}

// PlaceCartOrder records several cart lines for one customer and raises a single
// combined Paystack charge for their total. Made-to-wear lines become standard
// draft orders; bespoke self-measure lines become custom draft orders whose
// agreed total is the paid deposit. All orders share a checkout group, and the
// one payment's webhook confirms every order in the group (each settled by its
// own line total). The whole checkout is all-or-nothing: if the charge cannot be
// raised, every draft and the customer created for them are rolled back.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) PlaceCartOrder(ctx context.Context, cmd PlaceCartOrderCommand) (PlaceCartOrderResult, error) {
	name := strings.TrimSpace(cmd.CustomerName)
	email := strings.TrimSpace(cmd.CustomerEmail)
	// Bound the cart: each line is a DB round-trip + a row in one group insert, so
	// cap it to a sane basket size rather than letting a client submit thousands.
	if name == "" || email == "" || len(cmd.Lines) == 0 || len(cmd.Lines) > maxCartLines {
		return PlaceCartOrderResult{}, ErrInvalidInput
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return PlaceCartOrderResult{}, ErrInvalidInput
	}
	callbackURL, err := cleanCallbackURL(cmd.CallbackURL)
	if err != nil {
		return PlaceCartOrderResult{}, err
	}
	hasMadeToWear := false
	for _, line := range cmd.Lines {
		if strings.TrimSpace(line.DesignHandle) == "" {
			return PlaceCartOrderResult{}, ErrInvalidInput
		}
		switch line.Kind.normalized() {
		case CartLineMadeToWear:
			if line.SizeBandID == "" {
				return PlaceCartOrderResult{}, ErrInvalidInput
			}
			hasMadeToWear = true
		case CartLineBespoke:
			if line.SizeMode != order.SizeModeSelfMeasure {
				return PlaceCartOrderResult{}, ErrInvalidSizeMode
			}
			if _, err := cleanMeasurements(line.Measurements); err != nil {
				return PlaceCartOrderResult{}, err
			}
		default:
			return PlaceCartOrderResult{}, ErrInvalidInput
		}
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return PlaceCartOrderResult{}, ErrStoreNotFound
		}
		return PlaceCartOrderResult{}, err
	}
	if !store.OnlineOrderingEnabled {
		return PlaceCartOrderResult{}, ErrOnlineOrderingOff
	}
	scope := common.TenantScope{BusinessID: store.BusinessID}

	charge, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return PlaceCartOrderResult{}, err
	}
	if !charge.Verified || charge.SubaccountRef == "" {
		return PlaceCartOrderResult{}, ErrNotVerified
	}

	deliv, err := s.resolveDelivery(ctx, scope, store, cmd.DeliveryZoneID, cmd.DeliveryAddress)
	if err != nil {
		return PlaceCartOrderResult{}, err
	}
	if deliv.method != "" && !hasMadeToWear {
		return PlaceCartOrderResult{}, ErrDeliveryUnavailable
	}

	groupID := s.ids.NewID()
	customerID, customerCreated, err := s.resolveCustomerByPhone(ctx, cmd.CustomerPhone)
	if err != nil {
		return PlaceCartOrderResult{}, err
	}
	cleanupCustomerID := common.ID("")
	if customerCreated {
		cleanupCustomerID = customerID
	}
	phone := strings.TrimSpace(cmd.CustomerPhone)
	whatsapp := strings.TrimSpace(cmd.CustomerWhatsApp)

	standardInputs := make([]ports.CreateOnlineOrderInput, 0, len(cmd.Lines))
	customInputs := make([]ports.CreateCustomOrderInput, 0, len(cmd.Lines))
	orderIDs := make([]common.ID, 0, len(cmd.Lines))
	// lineAmounts is one amount per design (garment price or bespoke deposit),
	// EXCLUDING the delivery fee. It drives the per-design commission cap: the
	// Xtiitch fee is charged and capped at GHS 50 per design, then summed — so a
	// bulk cart is not capped once on the whole total (Pricing Book §3 / P0.6a).
	lineAmounts := make([]int64, 0, len(cmd.Lines))
	var total int64
	for _, line := range cmd.Lines {
		orderID := s.ids.NewID()
		orderIDs = append(orderIDs, orderID)
		switch line.Kind.normalized() {
		case CartLineMadeToWear:
			designID, price, err := s.resolvePricedDesign(ctx, store.BusinessID, line.DesignHandle, line.SizeBandID)
			if err != nil {
				s.discardGroup(ctx, scope, groupID, cleanupCustomerID)
				return PlaceCartOrderResult{}, err
			}
			bandID := line.SizeBandID
			input := ports.CreateOnlineOrderInput{
				OrderID:          orderID,
				BusinessID:       store.BusinessID,
				CustomerID:       customerID,
				DesignID:         designID,
				SizeBandID:       &bandID,
				CustomerName:     name,
				CustomerPhone:    phone,
				CustomerWhatsApp: whatsapp,
				CustomerEmail:    email,
				AgreedTotalMinor: price,
				CheckoutGroupID:  &groupID,
				Note:             strings.TrimSpace(line.Note),
			}
			// Delivery method + destination ride every standard order in the
			// group so each ready-made piece segments correctly when fulfilled.
			// The fee + zone, and the fee added to agreed_total, ride the first
			// standard line only: the cart pays one delivery fee.
			if deliv.method != "" {
				input.DeliveryMethod = deliv.method
				input.DeliveryAddress = deliv.address
				if len(standardInputs) == 0 {
					input.AgreedTotalMinor += deliv.feeMinor
					input.DeliveryFeeMinor = deliv.feeMinor
					input.DeliveryZoneID = deliv.zoneID
				}
			}
			standardInputs = append(standardInputs, input)
			total += price
			lineAmounts = append(lineAmounts, price)
		case CartLineBespoke:
			design, err := s.resolveCustomDesign(ctx, store, line.DesignHandle, line.SizeMode)
			if err != nil {
				s.discardGroup(ctx, scope, groupID, cleanupCustomerID)
				return PlaceCartOrderResult{}, err
			}
			measurements, err := cleanMeasurements(line.Measurements)
			if err != nil {
				s.discardGroup(ctx, scope, groupID, cleanupCustomerID)
				return PlaceCartOrderResult{}, err
			}
			deposit := money.ResolveDeposit(design.DepositOverrideMinor, &store.DefaultDepositMinor)
			input := ports.CreateCustomOrderInput{
				OrderID:          orderID,
				BusinessID:       store.BusinessID,
				CustomerID:       customerID,
				DesignID:         design.ID,
				SizeMode:         string(line.SizeMode),
				CustomerName:     name,
				CustomerPhone:    phone,
				CustomerWhatsApp: whatsapp,
				CustomerEmail:    email,
				AgreedTotalMinor: &deposit,
				CheckoutGroupID:  &groupID,
				MeasurementID:    s.ids.NewID(),
				Measurements:     measurements,
				Note:             strings.TrimSpace(line.Note),
			}
			customInputs = append(customInputs, input)
			total += deposit
			lineAmounts = append(lineAmounts, deposit)
		}
	}
	total += deliv.feeMinor
	if total <= 0 {
		return PlaceCartOrderResult{}, ErrInvalidInput
	}

	if len(standardInputs) > 0 {
		if err := s.orders.CreateOnlineOrderGroup(ctx, scope, standardInputs); err != nil {
			s.discardGroup(ctx, scope, groupID, cleanupCustomerID)
			return PlaceCartOrderResult{}, err
		}
	}
	for _, input := range customInputs {
		if err := s.orders.CreateCustomOrder(ctx, scope, input); err != nil {
			if errors.Is(err, ports.ErrUnknownMeasurementField) {
				s.discardGroup(ctx, scope, groupID, cleanupCustomerID)
				return PlaceCartOrderResult{}, ErrInvalidMeasurements
			}
			s.discardGroup(ctx, scope, groupID, cleanupCustomerID)
			return PlaceCartOrderResult{}, err
		}
	}
	anchorOrderID := orderIDs[0]
	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	chargeResult, err := s.payments.InitiateCharge(ctx, paymentsapp.InitiateChargeCommand{
		Scope:            scope,
		OrderID:          &anchorOrderID,
		Purpose:          money.PaymentPurposeCartFull,
		AmountMinor:      total,
		LineAmountsMinor: lineAmounts,
		Method:           method,
		CustomerEmail:    email,
		CallbackURL:      callbackURL,
	})
	if err != nil {
		// The group is committed but no payment was raised, so it could never be
		// confirmed. Roll the whole group back so checkout stays all-or-nothing.
		s.discardGroup(ctx, scope, groupID, cleanupCustomerID)
		return PlaceCartOrderResult{}, err
	}

	return PlaceCartOrderResult{
		GroupID:          groupID,
		OrderID:          anchorOrderID,
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      total,
		Quote:            chargeResult.Quote,
	}, nil
}
