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

// CheckoutQuoteCommand prices a store basket for the read-only checkout-quote
// endpoint (§4.5). It mirrors the cart-order payload minus the customer
// details: the same lines, the same optional delivery zone.
type CheckoutQuoteCommand struct {
	StoreHandle string
	Lines       []CartLineCommand
	// DeliveryZoneID, when set, prices the chosen delivery zone's fee into the
	// items total (uncommissioned, like the charge path). Empty means pickup.
	DeliveryZoneID common.ID
}

// CheckoutQuoteLine is one priced basket line.
type CheckoutQuoteLine struct {
	DesignHandle string
	Kind         CartLineKind
	AmountMinor  int64
}

// CheckoutQuoteResult is the full §4.2–§4.6 breakdown the storefront renders
// before the customer pays: the priced lines, and the quote's fee lines and
// totals (all GHS minor units).
type CheckoutQuoteResult struct {
	Lines            []CheckoutQuoteLine
	DeliveryFeeMinor int64
	Quote            money.StoreSaleQuote
}

// CheckoutQuote computes the fee/tax/pass-down breakdown for a store basket
// without recording anything, so the storefront can show the items total, the
// combined "Transaction fee" line, the "Tax fee" line and the grand total
// BEFORE the customer pays (§4.5). It prices lines exactly as PlaceCartOrder
// does and quotes through the same computation InitiateCharge charges, so the
// displayed breakdown always matches what is charged. When the owner absorbs
// every fee (all three tick boxes unticked, the default) the quote carries no
// fee lines at all — just the items total.
//
//nolint:funlen,gocognit,gocyclo // mirrors PlaceCartOrder's per-line pricing
func (s Service) CheckoutQuote(ctx context.Context, cmd CheckoutQuoteCommand) (CheckoutQuoteResult, error) {
	if len(cmd.Lines) == 0 || len(cmd.Lines) > maxCartLines {
		return CheckoutQuoteResult{}, ErrInvalidInput
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return CheckoutQuoteResult{}, ErrStoreNotFound
		}
		return CheckoutQuoteResult{}, err
	}
	if !store.OnlineOrderingEnabled {
		return CheckoutQuoteResult{}, ErrOnlineOrderingOff
	}
	scope := common.TenantScope{BusinessID: store.BusinessID}

	lines := make([]CheckoutQuoteLine, 0, len(cmd.Lines))
	lineAmounts := make([]int64, 0, len(cmd.Lines))
	hasMadeToWear := false
	for _, line := range cmd.Lines {
		if strings.TrimSpace(line.DesignHandle) == "" {
			return CheckoutQuoteResult{}, ErrInvalidInput
		}
		switch line.Kind.normalized() {
		case CartLineMadeToWear:
			if line.SizeBandID == "" {
				return CheckoutQuoteResult{}, ErrInvalidInput
			}
			_, price, err := s.resolvePricedDesign(ctx, store.BusinessID, line.DesignHandle, line.SizeBandID)
			if err != nil {
				return CheckoutQuoteResult{}, err
			}
			hasMadeToWear = true
			lines = append(lines, CheckoutQuoteLine{
				DesignHandle: strings.TrimSpace(line.DesignHandle),
				Kind:         CartLineMadeToWear,
				AmountMinor:  price,
			})
			lineAmounts = append(lineAmounts, price)
		case CartLineBespoke:
			if line.SizeMode != order.SizeModeSelfMeasure {
				return CheckoutQuoteResult{}, ErrInvalidSizeMode
			}
			design, err := s.resolveCustomDesign(ctx, store, line.DesignHandle, line.SizeMode)
			if err != nil {
				return CheckoutQuoteResult{}, err
			}
			deposit := money.ResolveDeposit(design.DepositOverrideMinor, &store.DefaultDepositMinor)
			lines = append(lines, CheckoutQuoteLine{
				DesignHandle: strings.TrimSpace(line.DesignHandle),
				Kind:         CartLineBespoke,
				AmountMinor:  deposit,
			})
			lineAmounts = append(lineAmounts, deposit)
		default:
			return CheckoutQuoteResult{}, ErrInvalidInput
		}
	}

	// A delivery fee rides the items total but is never commissioned — matching
	// the charge path, which folds it into AmountMinor outside LineAmountsMinor.
	// A quote needs no destination address, so the zone is priced directly.
	var deliveryFee int64
	if cmd.DeliveryZoneID != "" {
		if !hasMadeToWear {
			return CheckoutQuoteResult{}, ErrDeliveryUnavailable
		}
		deliveryFee, err = s.quoteDeliveryFeeMinor(ctx, scope, store, cmd.DeliveryZoneID)
		if err != nil {
			return CheckoutQuoteResult{}, err
		}
	}

	quote, err := s.payments.QuoteStoreSale(ctx, paymentsapp.QuoteStoreSaleCommand{
		Scope:            scope,
		LineAmountsMinor: lineAmounts,
		UncostedMinor:    deliveryFee,
	})
	if err != nil {
		return CheckoutQuoteResult{}, err
	}

	return CheckoutQuoteResult{
		Lines:            lines,
		DeliveryFeeMinor: deliveryFee,
		Quote:            quote,
	}, nil
}

// quoteDeliveryFeeMinor prices a chosen delivery zone for a quote: the store
// must offer delivery and the zone must exist for the tenant and be active.
// Unlike resolveDelivery it needs no destination address (nothing is booked).
func (s Service) quoteDeliveryFeeMinor(
	ctx context.Context,
	scope common.TenantScope,
	store ports.Storefront,
	zoneID common.ID,
) (int64, error) {
	if !store.Settings.DeliveryEnabled {
		return 0, ErrDeliveryUnavailable
	}
	zone, err := s.deliveryZones.GetDeliveryZone(ctx, scope, zoneID)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return 0, ErrDeliveryUnavailable
		}
		return 0, err
	}
	if !zone.Active {
		return 0, ErrDeliveryUnavailable
	}
	return zone.FeeMinor, nil
}
