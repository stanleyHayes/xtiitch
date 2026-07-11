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

// MarketplaceStoreLines is one shop's slice of a unified marketplace basket: its
// handle and the cart lines bought from it.
type MarketplaceStoreLines struct {
	StoreHandle string
	Lines       []CartLineCommand
}

type PlaceMarketplaceOrderCommand struct {
	Stores           []MarketplaceStoreLines
	CustomerName     string
	CustomerPhone    string
	CustomerWhatsApp string
	CustomerEmail    string
	Method           money.PaymentMethod
}

type PlaceMarketplaceOrderResult struct {
	Reference        string
	AuthorizationURL string
	AmountMinor      int64
}

// builtStoreGroup is one shop's committed checkout group plus the settlement
// figures the combined split charge needs.
type builtStoreGroup struct {
	scope         common.TenantScope
	subaccountRef string
	groupID       common.ID
	anchorOrderID common.ID
	netMinor      int64
	commission    int64
}

// PlaceMarketplaceOrder records a unified basket that spans SEVERAL shops and
// raises ONE combined Paystack split charge for it (§4 / P0.4 "pay once"): each
// shop gets its own checkout group and its net settles to its own subaccount,
// the platform its summed commission. It is pickup-only (delivery stays on the
// per-store checkout). Groups are created store by store; any failure discards
// every group already committed, so the whole basket is all-or-nothing. A
// single-shop basket must use PlaceCartOrder.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) PlaceMarketplaceOrder(ctx context.Context, cmd PlaceMarketplaceOrderCommand) (PlaceMarketplaceOrderResult, error) {
	name := strings.TrimSpace(cmd.CustomerName)
	email := strings.TrimSpace(cmd.CustomerEmail)
	if name == "" || email == "" || len(cmd.Stores) < 2 {
		return PlaceMarketplaceOrderResult{}, ErrInvalidInput
	}
	if cmd.Method != "" && !cmd.Method.Valid() {
		return PlaceMarketplaceOrderResult{}, ErrInvalidInput
	}
	totalLines := 0
	seenHandles := make(map[string]struct{}, len(cmd.Stores))
	for _, st := range cmd.Stores {
		handle := strings.ToLower(strings.TrimSpace(st.StoreHandle))
		if handle == "" || len(st.Lines) == 0 {
			return PlaceMarketplaceOrderResult{}, ErrInvalidInput
		}
		// Reject the same shop twice: duplicate handles would build two checkout
		// groups and a Paystack split with a repeated subaccount (a provider error /
		// double net-credit). Each shop must appear at most once per basket.
		if _, dup := seenHandles[handle]; dup {
			return PlaceMarketplaceOrderResult{}, ErrInvalidInput
		}
		seenHandles[handle] = struct{}{}
		totalLines += len(st.Lines)
	}
	if totalLines > maxCartLines {
		return PlaceMarketplaceOrderResult{}, ErrInvalidInput
	}

	phone := strings.TrimSpace(cmd.CustomerPhone)
	whatsapp := strings.TrimSpace(cmd.CustomerWhatsApp)
	customerID, customerCreated := s.resolveCustomerByPhone(ctx, phone)
	cleanupCustomerID := common.ID("")
	if customerCreated {
		cleanupCustomerID = customerID
	}

	var built []builtStoreGroup
	// compensate discards every group already committed. The customer (created
	// once, shared across shops) is cleaned up with the first group only.
	compensate := func() {
		for i, b := range built {
			cid := common.ID("")
			if i == 0 {
				cid = cleanupCustomerID
			}
			s.discardGroup(ctx, b.scope, b.groupID, cid)
		}
	}

	for _, st := range cmd.Stores {
		group, err := s.buildMarketplaceStoreGroup(ctx, st, customerID, name, phone, whatsapp, email)
		if err != nil {
			compensate()
			return PlaceMarketplaceOrderResult{}, err
		}
		built = append(built, group)
	}

	method := cmd.Method
	if method == "" {
		method = money.PaymentMethodMomo
	}
	stores := make([]paymentsapp.MarketplaceStoreCharge, 0, len(built))
	var total int64
	for _, b := range built {
		stores = append(stores, paymentsapp.MarketplaceStoreCharge{
			BusinessID:      b.scope.BusinessID,
			SubaccountRef:   b.subaccountRef,
			CheckoutGroupID: b.groupID,
			AnchorOrderID:   b.anchorOrderID,
			NetMinor:        b.netMinor,
			CommissionMinor: b.commission,
		})
		total += b.netMinor + b.commission
	}

	chargeResult, err := s.payments.InitiateMarketplaceCharge(ctx, paymentsapp.InitiateMarketplaceChargeCommand{
		CustomerEmail: email,
		Method:        method,
		Stores:        stores,
	})
	if err != nil {
		compensate()
		return PlaceMarketplaceOrderResult{}, err
	}

	return PlaceMarketplaceOrderResult{
		Reference:        chargeResult.Reference,
		AuthorizationURL: chargeResult.AuthorizationURL,
		AmountMinor:      total,
	}, nil
}

// buildMarketplaceStoreGroup validates one shop's lines, creates its checkout
// group (pickup only), and returns its settlement figures (net + commission).
// The commission is per-design and capped, summed — mirroring the single-store
// cart. The caller compensates by discarding the group on any later failure.
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) buildMarketplaceStoreGroup(
	ctx context.Context,
	st MarketplaceStoreLines,
	customerID common.ID,
	name, phone, whatsapp, email string,
) (builtStoreGroup, error) {
	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(st.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return builtStoreGroup{}, ErrStoreNotFound
		}
		return builtStoreGroup{}, err
	}
	if !store.OnlineOrderingEnabled {
		return builtStoreGroup{}, ErrOnlineOrderingOff
	}
	scope := common.TenantScope{BusinessID: store.BusinessID}
	charge, err := s.businesses.GetChargeContext(ctx, scope)
	if err != nil {
		return builtStoreGroup{}, err
	}
	if !charge.Verified || charge.SubaccountRef == "" {
		return builtStoreGroup{}, ErrNotVerified
	}

	groupID := s.ids.NewID()
	standardInputs := make([]ports.CreateOnlineOrderInput, 0, len(st.Lines))
	customInputs := make([]ports.CreateCustomOrderInput, 0, len(st.Lines))
	var anchorOrderID common.ID
	var total, commission int64
	for _, line := range st.Lines {
		orderID := s.ids.NewID()
		if anchorOrderID == "" {
			anchorOrderID = orderID
		}
		switch line.Kind.normalized() {
		case CartLineMadeToWear:
			if line.SizeBandID == "" {
				return builtStoreGroup{}, ErrInvalidInput
			}
			designID, price, err := s.resolvePricedDesign(ctx, store.BusinessID, line.DesignHandle, line.SizeBandID)
			if err != nil {
				return builtStoreGroup{}, err
			}
			bandID := line.SizeBandID
			standardInputs = append(standardInputs, ports.CreateOnlineOrderInput{
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
			})
			total += price
			commission += money.Commission(price, charge.CommissionBps)
		case CartLineBespoke:
			if line.SizeMode != order.SizeModeSelfMeasure {
				return builtStoreGroup{}, ErrInvalidSizeMode
			}
			measurements, err := cleanMeasurements(line.Measurements)
			if err != nil {
				return builtStoreGroup{}, err
			}
			design, err := s.resolveCustomDesign(ctx, store, line.DesignHandle, line.SizeMode)
			if err != nil {
				return builtStoreGroup{}, err
			}
			deposit := money.ResolveDeposit(design.DepositOverrideMinor, &store.DefaultDepositMinor)
			customInputs = append(customInputs, ports.CreateCustomOrderInput{
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
			})
			total += deposit
			commission += money.Commission(deposit, charge.CommissionBps)
		default:
			return builtStoreGroup{}, ErrInvalidInput
		}
	}
	if total <= 0 {
		return builtStoreGroup{}, ErrInvalidInput
	}

	if len(standardInputs) > 0 {
		if err := s.orders.CreateOnlineOrderGroup(ctx, scope, standardInputs); err != nil {
			s.discardGroup(ctx, scope, groupID, "")
			return builtStoreGroup{}, err
		}
	}
	for _, input := range customInputs {
		if err := s.orders.CreateCustomOrder(ctx, scope, input); err != nil {
			s.discardGroup(ctx, scope, groupID, "")
			if errors.Is(err, ports.ErrUnknownMeasurementField) {
				return builtStoreGroup{}, ErrInvalidMeasurements
			}
			return builtStoreGroup{}, err
		}
	}

	// Apply this shop's fee choice, consistent with single-store checkout: when the
	// merchant passes the fee to the buyer they net the FULL goods total and the
	// buyer pays the commission on top (storeTotal = net + commission); otherwise the
	// merchant absorbs it (net = goods - commission, buyer pays only the goods).
	netMinor := total - commission
	if charge.FeePassToBuyer {
		netMinor = total
	}
	return builtStoreGroup{
		scope:         scope,
		subaccountRef: charge.SubaccountRef,
		groupID:       groupID,
		anchorOrderID: anchorOrderID,
		netMinor:      netMinor,
		commission:    commission,
	}, nil
}
