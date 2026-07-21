package money

import "testing"

func TestGrossUp(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		netMinor  int64
		rateBps   int
		wantTotal int64
		wantFee   int64
	}{
		// §4.1/§4.6: 147.00 + 29.40 grossed up so XCreativs nets 176.40 after
		// Paystack takes 1.95% of the total: C = 176.40 / 0.9805 = 179.91.
		{"subscription worked example", 17640, 195, 17991, 351},
		// §4.6 store-sale worked example: 50.00 + 1.50 + 0.30 grossed up.
		{"store sale full pass-down", 5180, 195, 5283, 103},
		{"zero rate is a no-op", 5000, 0, 5000, 0},
		{"zero amount", 0, 195, 0, 0},
		{"a rate at or above 100% is refused as a no-op", 5000, 10000, 5000, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			total, fee := GrossUp(tc.netMinor, tc.rateBps)
			if total != tc.wantTotal || fee != tc.wantFee {
				t.Fatalf("GrossUp(%d, %d) = (%d, %d), want (%d, %d)",
					tc.netMinor, tc.rateBps, total, fee, tc.wantTotal, tc.wantFee)
			}
			// Invariant: after Paystack takes rateBps of the total (rounded
			// half-up), at least the protected net survives. Only meaningful
			// when the gross-up actually applied (0 < rate < 100%).
			if tc.rateBps > 0 && tc.rateBps < 10000 && total-Percentage(total, tc.rateBps) < tc.netMinor {
				t.Fatalf("GrossUp(%d, %d): %d does not protect the net after Paystack's cut",
					tc.netMinor, tc.rateBps, total)
			}
		})
	}
}

// §4.6 worked example — store sale, GHS 50 design, Free tier (3%), all three
// fees passed down: the customer pays 52.83 = 50.00 + Transaction fee 2.53
// (Paystack 1.03 + Xtiitch 1.50) + Tax 0.30; the store nets exactly 50.00 and
// Xtiitch receives 1.80 (keeps 1.50, remits 0.30).
func TestQuoteStoreSaleFullPassDownWorkedExample(t *testing.T) {
	t.Parallel()

	quote := QuoteStoreSale(StoreSaleQuoteInput{
		LineAmountsMinor: []int64{5000},
		CommissionBps:    300,
		VATBps:           2000,
		PaystackBps:      PaystackFeeRateBps,
		PassDown:         PassDownFlags{XtiitchFee: true, Tax: true, PaystackFee: true},
	})

	want := StoreSaleQuote{
		ItemsTotalMinor:     5000,
		VATRateBps:          2000,
		XtiitchFeeMinor:     150,
		TaxMinor:            30,
		PaystackFeeMinor:    103,
		TransactionFeeMinor: 253,
		TaxLineMinor:        30,
		TotalChargeMinor:    5283,
		StoreNetMinor:       5000,
	}
	if quote != want {
		t.Fatalf("full pass-down quote = %+v, want %+v", quote, want)
	}
	if quote.PlatformShareMinor() != 180 {
		t.Fatalf("xtiitch share = %d, want 180 (1.50 kept + 0.30 remit)", quote.PlatformShareMinor())
	}
}

// §4.6 worked example — same sale with the owner absorbing every fee (the
// default): the customer pays 50.00, Paystack takes 0.98, the store nets 47.22
// and Xtiitch still receives 1.80. No fee lines are shown to the customer.
func TestQuoteStoreSaleAbsorbWorkedExample(t *testing.T) {
	t.Parallel()

	quote := QuoteStoreSale(StoreSaleQuoteInput{
		LineAmountsMinor: []int64{5000},
		CommissionBps:    300,
		VATBps:           2000,
		PaystackBps:      PaystackFeeRateBps,
		PassDown:         PassDownFlags{},
	})

	want := StoreSaleQuote{
		ItemsTotalMinor:     5000,
		VATRateBps:          2000,
		XtiitchFeeMinor:     150,
		TaxMinor:            30,
		PaystackFeeMinor:    98,
		TransactionFeeMinor: 0,
		TaxLineMinor:        0,
		TotalChargeMinor:    5000,
		StoreNetMinor:       4722,
	}
	if quote != want {
		t.Fatalf("absorb quote = %+v, want %+v", quote, want)
	}
}

// §4.4: the three tick boxes are independent — every one of the 8 combinations
// must price correctly. In every combination Xtiitch's share stays 180 (fee 150
// + tax 30) and the customer-facing lines carry only the passed parts.
func TestQuoteStoreSaleAllPassDownCombinations(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		passDown      PassDownFlags
		wantTotal     int64
		wantPaystack  int64
		wantTxFeeLine int64
		wantTaxLine   int64
		wantStoreNet  int64
	}{
		{"absorb all (default)", PassDownFlags{}, 5000, 98, 0, 0, 4722},
		{"pass xtiitch fee only", PassDownFlags{XtiitchFee: true}, 5150, 100, 150, 0, 4870},
		{"pass tax only", PassDownFlags{Tax: true}, 5030, 98, 0, 30, 4752},
		{"pass xtiitch fee + tax", PassDownFlags{XtiitchFee: true, Tax: true}, 5180, 101, 150, 30, 4899},
		{"pass paystack fee only", PassDownFlags{PaystackFee: true}, 5099, 99, 99, 0, 4820},
		{"pass xtiitch + paystack fees", PassDownFlags{XtiitchFee: true, PaystackFee: true}, 5252, 102, 252, 0, 4970},
		{"pass tax + paystack fee", PassDownFlags{Tax: true, PaystackFee: true}, 5130, 100, 100, 30, 4850},
		{"pass all three", PassDownFlags{XtiitchFee: true, Tax: true, PaystackFee: true}, 5283, 103, 253, 30, 5000},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			quote := QuoteStoreSale(StoreSaleQuoteInput{
				LineAmountsMinor: []int64{5000},
				CommissionBps:    300,
				VATBps:           2000,
				PaystackBps:      PaystackFeeRateBps,
				PassDown:         tc.passDown,
			})
			if quote.TotalChargeMinor != tc.wantTotal ||
				quote.PaystackFeeMinor != tc.wantPaystack ||
				quote.TransactionFeeMinor != tc.wantTxFeeLine ||
				quote.TaxLineMinor != tc.wantTaxLine ||
				quote.StoreNetMinor != tc.wantStoreNet {
				t.Fatalf("quote = %+v, want total=%d paystack=%d txFee=%d taxLine=%d storeNet=%d",
					quote, tc.wantTotal, tc.wantPaystack, tc.wantTxFeeLine, tc.wantTaxLine, tc.wantStoreNet)
			}
			// Invariant: the charge always reconciles — items + the displayed
			// lines equal the total, and Xtiitch's share is fee + tax.
			if quote.ItemsTotalMinor+quote.TransactionFeeMinor+quote.TaxLineMinor != quote.TotalChargeMinor {
				t.Fatalf("displayed lines do not add up to the total: %+v", quote)
			}
			if quote.PlatformShareMinor() != 180 {
				t.Fatalf("xtiitch share = %d, want 180", quote.PlatformShareMinor())
			}
		})
	}
}

// §4.3 bulk purchase: the Xtiitch fee is computed and capped PER DESIGN, the
// tax is 20% of EACH design's fee, and the Paystack fee is ONE charge on the
// total — never per item. Three designs at GHS 50 / GHS 2,000 / GHS 300 on a
// Free store, full pass-down.
func TestQuoteStoreSaleBulkPerDesignCaps(t *testing.T) {
	t.Parallel()

	quote := QuoteStoreSale(StoreSaleQuoteInput{
		LineAmountsMinor: []int64{5000, 200000, 30000},
		CommissionBps:    300,
		VATBps:           2000,
		PaystackBps:      PaystackFeeRateBps,
		PassDown:         PassDownFlags{XtiitchFee: true, Tax: true, PaystackFee: true},
	})

	// Fees: 1.50 + 50.00 (capped) + 9.00 = 60.50; taxes: 0.30 + 10.00 + 1.80 =
	// 12.10; ONE paystack fee on the grossed-up total.
	want := StoreSaleQuote{
		ItemsTotalMinor:     235000,
		VATRateBps:          2000,
		XtiitchFeeMinor:     6050,
		TaxMinor:            1210,
		PaystackFeeMinor:    4818,
		TransactionFeeMinor: 10868,
		TaxLineMinor:        1210,
		TotalChargeMinor:    247078,
		StoreNetMinor:       235000,
	}
	if quote != want {
		t.Fatalf("bulk quote = %+v, want %+v", quote, want)
	}
}

// §4.3/§4.4 with a promotion override: the override replaces the computed fee
// and VAT is charged on the override TOTAL — the same vat × commission rule as
// the per-design path. Whenever fee_pass_tax is ticked the "Tax (VAT)" line
// must be present: never dropped, never computed on a different base than the
// commission actually charged.
func TestQuoteStoreSaleOverrideKeepsTaxLine(t *testing.T) {
	t.Parallel()

	override := int64(900)
	quote := QuoteStoreSale(StoreSaleQuoteInput{
		LineAmountsMinor:        []int64{25000, 15000},
		CommissionBps:           300,
		VATBps:                  2000,
		PaystackBps:             PaystackFeeRateBps,
		CommissionOverrideMinor: &override,
		PassDown:                PassDownFlags{XtiitchFee: true, Tax: true, PaystackFee: true},
	})

	if quote.XtiitchFeeMinor != 900 {
		t.Fatalf("override must replace the per-design fees, got %d", quote.XtiitchFeeMinor)
	}
	if quote.TaxMinor != 180 || quote.TaxLineMinor != 180 {
		t.Fatalf("VAT must be 20%% of the override (180) and shown, got tax=%d line=%d", quote.TaxMinor, quote.TaxLineMinor)
	}
	// The displayed lines always reconcile to the grand total, and Xtiitch's
	// share is the override fee + its tax.
	if quote.ItemsTotalMinor+quote.TransactionFeeMinor+quote.TaxLineMinor != quote.TotalChargeMinor {
		t.Fatalf("displayed lines do not add up to the total: %+v", quote)
	}
	if quote.PlatformShareMinor() != 1080 {
		t.Fatalf("xtiitch share = %d, want 1080 (900 + 180)", quote.PlatformShareMinor())
	}
}

// An override equal to the computed per-design commission must price the tax
// line IDENTICALLY to the non-override path — the promoted and plain checkouts
// can never disagree about VAT.
func TestQuoteStoreSaleOverrideMatchesPerDesignTax(t *testing.T) {
	t.Parallel()

	input := StoreSaleQuoteInput{
		LineAmountsMinor: []int64{5000},
		CommissionBps:    300,
		VATBps:           2000,
		PaystackBps:      PaystackFeeRateBps,
		PassDown:         PassDownFlags{XtiitchFee: true, Tax: true, PaystackFee: true},
	}
	plain := QuoteStoreSale(input)

	override := plain.XtiitchFeeMinor
	input.CommissionOverrideMinor = &override
	promoted := QuoteStoreSale(input)

	if promoted != plain {
		t.Fatalf("an override equal to the computed fee must match the plain quote exactly:\nplain=%+v\npromoted=%+v", plain, promoted)
	}
}

// Even when the owner absorbs the fees (tax not passed down), the VAT on the
// override commission is still computed — it rides Xtiitch's share (the
// split's transaction_charge) and is persisted with the charge.
func TestQuoteStoreSaleOverrideAbsorbedStillComputesTax(t *testing.T) {
	t.Parallel()

	override := int64(900)
	quote := QuoteStoreSale(StoreSaleQuoteInput{
		LineAmountsMinor:        []int64{25000, 15000},
		CommissionBps:           300,
		VATBps:                  2000,
		PaystackBps:             PaystackFeeRateBps,
		CommissionOverrideMinor: &override,
		PassDown:                PassDownFlags{},
	})

	if quote.TaxMinor != 180 {
		t.Fatalf("absorbed VAT on the override must still be computed, got %d", quote.TaxMinor)
	}
	if quote.TaxLineMinor != 0 {
		t.Fatalf("absorbed tax is never a customer line, got %d", quote.TaxLineMinor)
	}
	if quote.PlatformShareMinor() != 1080 {
		t.Fatalf("xtiitch share = %d, want 1080 (900 + 180)", quote.PlatformShareMinor())
	}
}

// An uncommissioned basket line (a delivery fee) rides the items total and the
// gross-up but is never fee'd or taxed itself.
func TestQuoteStoreSaleUncostedDeliveryFee(t *testing.T) {
	t.Parallel()

	quote := QuoteStoreSale(StoreSaleQuoteInput{
		LineAmountsMinor: []int64{5000},
		UncostedMinor:    1000,
		CommissionBps:    300,
		VATBps:           2000,
		PaystackBps:      PaystackFeeRateBps,
		PassDown:         PassDownFlags{},
	})
	if quote.ItemsTotalMinor != 6000 {
		t.Fatalf("items total = %d, want 6000 (design + delivery)", quote.ItemsTotalMinor)
	}
	if quote.XtiitchFeeMinor != 150 || quote.TaxMinor != 30 {
		t.Fatalf("delivery must not be fee'd: fee=%d tax=%d, want 150/30", quote.XtiitchFeeMinor, quote.TaxMinor)
	}
}

// §4.1 worked example — Starter quarterly renewal: package 147.00 + Tax (VAT
// 20%) 29.40 + Transaction fee 3.51 = 179.91; Paystack deducts 3.51 and
// XCreativs nets 176.40 (keeps 147.00, remits 29.40).
func TestQuoteSubscriptionChargeWorkedExample(t *testing.T) {
	t.Parallel()

	quote := QuoteSubscriptionCharge(14700, 2000, false, PaystackFeeRateBps)
	want := SubscriptionQuote{
		PackageMinor:        14700,
		VATMinor:            2940,
		TransactionFeeMinor: 351,
		TotalChargeMinor:    17991,
	}
	if quote != want {
		t.Fatalf("subscription quote = %+v, want %+v", quote, want)
	}
	if net := quote.TotalChargeMinor - Percentage(quote.TotalChargeMinor, PaystackFeeRateBps); net != 17640 {
		t.Fatalf("xCreativs nets %d, want 17640 (147.00 + 29.40 intact)", net)
	}
}

// VAT disabled (rate 0) leaves only the grossed-up transaction fee; a zero
// paystack rate leaves package + VAT.
func TestQuoteSubscriptionChargeEdgeRates(t *testing.T) {
	t.Parallel()

	quote := QuoteSubscriptionCharge(14700, 0, false, PaystackFeeRateBps)
	if quote.VATMinor != 0 || quote.TotalChargeMinor != 14992 || quote.TransactionFeeMinor != 292 {
		t.Fatalf("VAT-disabled quote = %+v, want package 14700 + fee 292 = 14992", quote)
	}

	quote = QuoteSubscriptionCharge(14700, 2000, false, 0)
	if quote.TotalChargeMinor != 17640 || quote.TransactionFeeMinor != 0 {
		t.Fatalf("no-paystack-rate quote = %+v, want 17640 with no fee", quote)
	}
}
