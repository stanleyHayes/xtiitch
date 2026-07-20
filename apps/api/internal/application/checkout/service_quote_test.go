package checkoutapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/order"
)

func quoteService(payments Payments, zones ports.DeliveryZoneRepository) Service {
	return NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses:    fakeCharge{ctx: verifiedCharge()},
		Payments:      payments,
		DeliveryZones: zones,
		IDs:           &seqIDs{ids: []common.ID{"id-1"}},
	})
}

// §4.5: the quote endpoint prices the same basket the cart-order charge would,
// through the same computation, so quote and charge never disagree.
func TestCheckoutQuotePricesLinesAndDelegates(t *testing.T) {
	t.Parallel()

	payments := &fakePayments{quote: money.StoreSaleQuote{
		ItemsTotalMinor:     50000,
		TransactionFeeMinor: 0,
		TaxLineMinor:        0,
		TotalChargeMinor:    50000,
	}}
	service := quoteService(payments, &fakeDeliveryZones{})

	result, err := service.CheckoutQuote(context.Background(), CheckoutQuoteCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1", Kind: CartLineMadeToWear},
		},
	})
	if err != nil {
		t.Fatalf("checkout quote: %v", err)
	}
	if !payments.quoteCalled {
		t.Fatal("expected the quote to be priced through the payments quote computation")
	}
	if len(payments.quoteCommand.LineAmountsMinor) != 1 || payments.quoteCommand.LineAmountsMinor[0] != 50000 {
		t.Fatalf("expected the band price as the per-design fee base, got %+v", payments.quoteCommand.LineAmountsMinor)
	}
	if payments.quoteCommand.UncostedMinor != 0 {
		t.Fatalf("no delivery chosen: expected no uncommissioned amount, got %d", payments.quoteCommand.UncostedMinor)
	}
	if len(result.Lines) != 1 || result.Lines[0].AmountMinor != 50000 || result.Lines[0].Kind != CartLineMadeToWear {
		t.Fatalf("unexpected quote lines: %+v", result.Lines)
	}
	if result.Quote.TotalChargeMinor != 50000 || result.Quote.TransactionFeeMinor != 0 {
		t.Fatalf("unexpected quote passthrough: %+v", result.Quote)
	}
}

// A chosen delivery zone rides the items total as an UNCOMMISSIONED amount,
// matching how the cart charge folds the fee into AmountMinor outside the
// per-design fee base.
func TestCheckoutQuotePricesDeliveryZoneUncommissioned(t *testing.T) {
	t.Parallel()

	payments := &fakePayments{}
	zones := &fakeDeliveryZones{zone: ports.DeliveryZone{ID: "zone-1", FeeMinor: 2500, Active: true}}
	service := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{
				BusinessID:            testBusinessID,
				OnlineOrderingEnabled: true,
				Settings:              ports.StoreSettings{DeliveryEnabled: true},
			},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses:    fakeCharge{ctx: verifiedCharge()},
		Payments:      payments,
		DeliveryZones: zones,
		IDs:           &seqIDs{ids: []common.ID{"id-1"}},
	})

	result, err := service.CheckoutQuote(context.Background(), CheckoutQuoteCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1", Kind: CartLineMadeToWear},
		},
		DeliveryZoneID: "zone-1",
	})
	if err != nil {
		t.Fatalf("checkout quote: %v", err)
	}
	if result.DeliveryFeeMinor != 2500 || payments.quoteCommand.UncostedMinor != 2500 {
		t.Fatalf("expected the zone fee quoted uncommissioned, got fee=%d uncosted=%d",
			result.DeliveryFeeMinor, payments.quoteCommand.UncostedMinor)
	}
}

func TestCheckoutQuoteRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	service := quoteService(&fakePayments{}, &fakeDeliveryZones{})

	if _, err := service.CheckoutQuote(context.Background(), CheckoutQuoteCommand{StoreHandle: "shop"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected an empty basket rejected, got %v", err)
	}
	if _, err := service.CheckoutQuote(context.Background(), CheckoutQuoteCommand{
		StoreHandle: "shop",
		Lines:       []CartLineCommand{{DesignHandle: "design", Kind: CartLineMadeToWear}},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected a made-to-wear line without a band rejected, got %v", err)
	}
	if _, err := service.CheckoutQuote(context.Background(), CheckoutQuoteCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", SizeBandID: "band-1", Kind: CartLineMadeToWear},
		},
		DeliveryZoneID: "zone-missing",
	}); !errors.Is(err, ErrDeliveryUnavailable) {
		t.Fatalf("expected an unknown delivery zone rejected, got %v", err)
	}
}

// The bespoke route prices at the deposit (like the cart), never the garment.
func TestCheckoutQuotePricesBespokeAtDeposit(t *testing.T) {
	t.Parallel()

	payments := &fakePayments{}
	service := NewService(Dependencies{
		Storefront: fakeStorefront{store: customStore(), design: customDesign()},
		Businesses: fakeCharge{ctx: verifiedCharge()},
		Payments:   payments,
		IDs:        &seqIDs{ids: []common.ID{"id-1"}},
	})

	result, err := service.CheckoutQuote(context.Background(), CheckoutQuoteCommand{
		StoreHandle: "shop",
		Lines: []CartLineCommand{
			{DesignHandle: "design", Kind: CartLineBespoke, SizeMode: order.SizeModeSelfMeasure},
		},
	})
	if err != nil {
		t.Fatalf("checkout quote: %v", err)
	}
	if len(result.Lines) != 1 || result.Lines[0].AmountMinor != 15000 {
		t.Fatalf("expected the bespoke line at the 15000 deposit, got %+v", result.Lines)
	}
	if payments.quoteCommand.LineAmountsMinor[0] != 15000 {
		t.Fatalf("expected the deposit as the fee base, got %+v", payments.quoteCommand.LineAmountsMinor)
	}
}
