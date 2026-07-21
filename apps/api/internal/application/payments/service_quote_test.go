package paymentsapp

import (
	"context"
	"errors"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

type fakeVATRates struct {
	rateBps int
	err     error
}

func (f *fakeVATRates) VATRateBps(context.Context) (int, error) {
	return f.rateBps, f.err
}

func quoteTestService(businesses *fakeChargeRepo, vatRates VATRateReader, fallbackBps int) (Service, *fakeProvider, *fakePaymentRepo) {
	provider := &fakeProvider{verifySig: true, initResult: ports.InitializeTransactionResult{AuthorizationURL: "https://pay/x"}}
	payments := &fakePaymentRepo{}
	return NewService(Dependencies{
		Provider:   provider,
		Payments:   payments,
		Businesses: businesses,
		IDs:        &sequenceIDs{ids: []common.ID{"ref-1", "pay-1"}},
		VATRates:   vatRates,
		VATRateBps: fallbackBps,
	}), provider, payments
}

// §4.6 worked example end to end through InitiateCharge: a GHS 50 design on a
// Free-tier store with all three fees passed down charges the customer 52.83,
// routes 1.80 (fee 1.50 + tax 0.30) to Xtiitch as the split transaction_charge,
// and still settles the order by its own 50.00 only.
func TestInitiateChargeFullPassDownWorkedExample(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Name: "Ama", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
		FeePassXtiitchFee: true, FeePassTax: true, FeePassPaystackFee: true,
	}}
	service, provider, payments := quoteTestService(businesses, &fakeVATRates{rateBps: 2000}, 0)

	result, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeStandardFull,
		AmountMinor:   5000,
		Method:        money.PaymentMethodMomo,
		CustomerEmail: "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if provider.initInput.AmountMinor != 5283 {
		t.Fatalf("customer must be charged 52.83 (5283), got %d", provider.initInput.AmountMinor)
	}
	if provider.initInput.CommissionMinor != 180 {
		t.Fatalf("xtiitch share (fee 1.50 + tax 0.30) must route as 180, got %d", provider.initInput.CommissionMinor)
	}
	if result.Quote.TransactionFeeMinor != 253 || result.Quote.TaxLineMinor != 30 || result.Quote.StoreNetMinor != 5000 {
		t.Fatalf("unexpected quote: %+v", result.Quote)
	}
	created := payments.created[0]
	if created.SettleAmountMinor != 5000 {
		t.Fatalf("the order settles by its own amount only, got %d", created.SettleAmountMinor)
	}
	if created.CommissionMinor != 180 || created.AmountMinor != 5283 {
		t.Fatalf("unexpected payment record: %+v", created)
	}
}

// §4.6 worked example, absorb mode (the default): the customer pays only the
// 50.00, the store's share silently bears Paystack's 0.98 and Xtiitch's 1.80.
func TestInitiateChargeAbsorbMode(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Name: "Ama", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}
	service, provider, payments := quoteTestService(businesses, &fakeVATRates{rateBps: 2000}, 0)

	result, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:         common.TenantScope{BusinessID: "business-1"},
		Purpose:       money.PaymentPurposeStandardFull,
		AmountMinor:   5000,
		Method:        money.PaymentMethodMomo,
		CustomerEmail: "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}
	if provider.initInput.AmountMinor != 5000 {
		t.Fatalf("absorb mode charges only the items total, got %d", provider.initInput.AmountMinor)
	}
	if result.Quote.StoreNetMinor != 4722 || result.Quote.PaystackFeeMinor != 98 {
		t.Fatalf("store must net 47.22 with Paystack taking 0.98, got %+v", result.Quote)
	}
	if result.Quote.TransactionFeeMinor != 0 || result.Quote.TaxLineMinor != 0 {
		t.Fatalf("absorb mode shows no fee lines to the customer, got %+v", result.Quote)
	}
	if payments.created[0].CommissionMinor != 180 {
		t.Fatalf("xtiitch still takes fee + tax = 180, got %d", payments.created[0].CommissionMinor)
	}
}

// §4.1: the VAT rate is read LIVE at charge time. A fake reader returning 2000
// applies 20% tax on the fee even with a zero fallback; a failing reader falls
// back to the configured seed.
func TestQuoteStoreSaleReadsLiveVATRate(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
	}}

	live, _, _ := quoteTestService(businesses, &fakeVATRates{rateBps: 2000}, 0)
	quote, err := live.QuoteStoreSale(context.Background(), QuoteStoreSaleCommand{
		Scope:            common.TenantScope{BusinessID: "business-1"},
		LineAmountsMinor: []int64{5000},
	})
	if err != nil {
		t.Fatalf("quote: %v", err)
	}
	if quote.TaxMinor != 30 {
		t.Fatalf("expected 20%% VAT on the 1.50 fee = 0.30, got %d", quote.TaxMinor)
	}

	fallback, _, _ := quoteTestService(businesses, &fakeVATRates{err: errors.New("db down")}, 2000)
	quote, err = fallback.QuoteStoreSale(context.Background(), QuoteStoreSaleCommand{
		Scope:            common.TenantScope{BusinessID: "business-1"},
		LineAmountsMinor: []int64{5000},
	})
	if err != nil {
		t.Fatalf("quote: %v", err)
	}
	if quote.TaxMinor != 30 {
		t.Fatalf("a failing reader must fall back to the seeded 20%%, got tax %d", quote.TaxMinor)
	}
}

// §4.3 bulk: three designs on Free tier, one over the GHS 50 cap, plus a
// delivery fee — per-design fees and taxes, ONE paystack fee on the total.
func TestQuoteStoreSaleBulkMultiDesign(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
		FeePassXtiitchFee: true, FeePassTax: true, FeePassPaystackFee: true,
	}}
	service, _, _ := quoteTestService(businesses, &fakeVATRates{rateBps: 2000}, 0)

	quote, err := service.QuoteStoreSale(context.Background(), QuoteStoreSaleCommand{
		Scope:            common.TenantScope{BusinessID: "business-1"},
		LineAmountsMinor: []int64{5000, 200000, 30000},
		UncostedMinor:    2500,
	})
	if err != nil {
		t.Fatalf("quote: %v", err)
	}
	if quote.ItemsTotalMinor != 237500 {
		t.Fatalf("items total = %d, want 237500 (designs + delivery)", quote.ItemsTotalMinor)
	}
	if quote.XtiitchFeeMinor != 6050 || quote.TaxMinor != 1210 {
		t.Fatalf("per-design capped fees 6050 / taxes 1210, got %d/%d", quote.XtiitchFeeMinor, quote.TaxMinor)
	}
	// ONE paystack fee on the grossed-up total, and the displayed lines plus the
	// items total reconcile to the grand total exactly.
	if quote.ItemsTotalMinor+quote.TransactionFeeMinor+quote.TaxLineMinor != quote.TotalChargeMinor {
		t.Fatalf("lines do not reconcile: %+v", quote)
	}
	if quote.StoreNetMinor != quote.TotalChargeMinor-quote.PaystackFeeMinor-7260 {
		t.Fatalf("store net must be total - paystack - (fees+taxes): %+v", quote)
	}
}

// Preview and charge share ONE quote path: for the same basket and the same
// commission override (a promotion), the read-only QuoteStoreSale and the
// charged InitiateCharge must produce the identical breakdown — the tax line
// included — so the storefront always renders exactly what is charged (§4.5).
func TestQuoteStoreSalePreviewMatchesChargeWithOverride(t *testing.T) {
	t.Parallel()

	businesses := &fakeChargeRepo{context: ports.BusinessChargeContext{
		BusinessID: "business-1", Verified: true, SubaccountRef: "sub_1", CommissionBps: 300,
		FeePassXtiitchFee: true, FeePassTax: true, FeePassPaystackFee: true,
	}}
	service, _, payments := quoteTestService(businesses, &fakeVATRates{rateBps: 2000}, 0)

	override := int64(900)
	preview, err := service.QuoteStoreSale(context.Background(), QuoteStoreSaleCommand{
		Scope:                   common.TenantScope{BusinessID: "business-1"},
		LineAmountsMinor:        []int64{25000, 15000},
		CommissionMinorOverride: &override,
	})
	if err != nil {
		t.Fatalf("preview quote: %v", err)
	}

	charged, err := service.InitiateCharge(context.Background(), InitiateChargeCommand{
		Scope:                   common.TenantScope{BusinessID: "business-1"},
		Purpose:                 money.PaymentPurposeCartFull,
		AmountMinor:             40000,
		LineAmountsMinor:        []int64{25000, 15000},
		CommissionMinorOverride: &override,
		Method:                  money.PaymentMethodMomo,
		CustomerEmail:           "buyer@example.com",
	})
	if err != nil {
		t.Fatalf("initiate charge: %v", err)
	}

	if charged.Quote != preview {
		t.Fatalf("preview and charge must quote identically:\npreview=%+v\ncharged=%+v", preview, charged.Quote)
	}
	// The VAT on the override commission is persisted with the charge (§3.2) so
	// the Money Desk splits fee from tax from stored figures only.
	if payments.created[0].XtiitchTaxMinor != int64(180) {
		t.Fatalf("expected the override VAT (180) persisted with the charge, got %+v", payments.created[0])
	}
}

func TestQuoteStoreSaleRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	service, _, _ := quoteTestService(&fakeChargeRepo{}, nil, 0)
	negative := int64(-5)
	cases := []QuoteStoreSaleCommand{
		{},
		{Scope: common.TenantScope{BusinessID: "b1"}, LineAmountsMinor: []int64{0}},
		{Scope: common.TenantScope{BusinessID: "b1"}, LineAmountsMinor: []int64{100}, UncostedMinor: -1},
		{Scope: common.TenantScope{BusinessID: "b1"}, LineAmountsMinor: []int64{100}, CommissionMinorOverride: &negative},
	}
	for _, cmd := range cases {
		if _, err := service.QuoteStoreSale(context.Background(), cmd); !errors.Is(err, ErrInvalidCharge) {
			t.Fatalf("expected invalid charge for %+v, got %v", cmd, err)
		}
	}
}
