package money

// PaystackFeeRateBps is Paystack's transaction fee for the XCreativs account:
// 1.95% (195 bps), always charged on the FULL amount the customer actually pays
// — not on the base price (§4.2, §4.6). It is a named constant rather than
// config so every quote and charge models the same rate.
const PaystackFeeRateBps = 195

// PassDownFlags are the store owner's three fee pass-down tick boxes (§4.4).
// An unticked fee is absorbed: it comes out of the store's share in the
// background and is never shown to the customer.
type PassDownFlags struct {
	// XtiitchFee passes the platform's per-design sales fee to the customer
	// (inside the combined "Transaction fee" line).
	XtiitchFee bool
	// Tax passes the VAT on the Xtiitch fee to the customer (its own line).
	Tax bool
	// PaystackFee passes Paystack's 1.95% to the customer (gross-up rule, §4.6).
	PaystackFee bool
}

// StoreSaleQuote is the full fee breakdown for one store basket (§4.2–§4.6),
// computed identically at checkout-initiation and for the read-only
// checkout-quote endpoint, so the storefront renders exactly what is charged.
// All amounts are GHS minor units (pesewas).
type StoreSaleQuote struct {
	// ItemsTotalMinor is the basket total before fees: the per-design amounts
	// plus any uncommissioned lines (e.g. a delivery fee).
	ItemsTotalMinor int64
	// VATRateBps is the live admin-configured VAT rate used for this quote (or
	// the environment fallback when platform settings cannot be read). Exposing
	// it lets checkout disclose the exact rate behind TaxLineMinor.
	VATRateBps int
	// XtiitchFeeMinor is the summed per-design fee at the store's plan rate,
	// each capped at GHS 50 (§4.2/§4.3) — or the promotion-negotiated override
	// when one replaces it.
	XtiitchFeeMinor int64
	// TaxMinor is the VAT on the commission actually charged: the summed
	// per-design VAT on each design's Xtiitch fee (§4.3) or, when a promotion
	// override reprices the fee, VAT on the override total — the same
	// vat × commission rule in both paths, so the tax line can never silently
	// differ or drop between a plain and a promoted checkout.
	TaxMinor int64
	// PaystackFeeMinor is the modeled 1.95% Paystack deduction on the total
	// charge (informational; never displayed raw — §4.5).
	PaystackFeeMinor int64
	// TransactionFeeMinor is the customer-facing combined "Transaction fee"
	// line: the Paystack fee and/or the Xtiitch fee, but ONLY the parts the
	// owner passes down (§4.4/§4.5). Zero when neither is passed.
	TransactionFeeMinor int64
	// TaxLineMinor is the customer-facing "Tax fee" amount. It can be zero
	// even when tax is passed down if the computed tax rounds below one pesewa.
	TaxLineMinor int64
	// TaxPassedDown preserves the store setting independently of the rounded
	// amount so checkout can distinguish a zero-value passed line from an
	// absorbed tax line.
	TaxPassedDown bool
	// TotalChargeMinor is what the customer actually pays.
	TotalChargeMinor int64
	// StoreNetMinor is what the store nets after Paystack's deduction and
	// Xtiitch's share (§4.6 "Store finally receives").
	StoreNetMinor int64
}

// PlatformShareMinor is Xtiitch's total share of a store sale: the summed fees
// plus the summed taxes collected with them for remittance (§4.2/§4.3). It is
// the flat transaction_charge routed to the main account in the split.
func (q StoreSaleQuote) PlatformShareMinor() int64 {
	return q.XtiitchFeeMinor + q.TaxMinor
}

// StoreSaleQuoteInput prices one store basket. LineAmountsMinor carries one
// amount per design (the commission base — each gets its own GHS 50 cap, §4.3);
// UncostedMinor carries basket amounts that are NOT commissioned (a delivery
// fee). CommissionOverrideMinor, when set, replaces the computed Xtiitch fee
// (a promotion-negotiated fee) and is taxed instead of the per-design fees.
type StoreSaleQuoteInput struct {
	LineAmountsMinor        []int64
	UncostedMinor           int64
	CommissionBps           int
	VATBps                  int
	PaystackBps             int
	CommissionOverrideMinor *int64
	PassDown                PassDownFlags
}

// QuoteStoreSale computes the §4.2–§4.6 store-sale breakdown. Fee and tax are
// computed PER DESIGN (each capped, each taxed, half-up at every step); the
// Paystack fee is one charge on the total. When a promotion sets a commission
// override, the override replaces the per-design fees and VAT is charged on
// the override TOTAL — the same vat × commission rule applied to the
// commission actually charged, so the tax line is present and consistent with
// and without a promotion. When the Paystack fee is passed down, the total is
// grossed up (§4.6) so the items total and the passed lines survive Paystack's
// cut exactly; the store still bears the fee at split level (bearer stays
// "subaccount") and the checkout lines compensate it (§4.8 note).
func QuoteStoreSale(input StoreSaleQuoteInput) StoreSaleQuote {
	itemsTotal := input.UncostedMinor
	var fee int64
	var tax int64
	if input.CommissionOverrideMinor != nil {
		// Promotion-negotiated fee: VAT on the override total (the commission
		// actually charged), never dropped.
		fee = *input.CommissionOverrideMinor
		tax = Percentage(fee, input.VATBps)
	}
	for _, lineMinor := range input.LineAmountsMinor {
		itemsTotal += lineMinor
		if input.CommissionOverrideMinor == nil {
			lineFee := Commission(lineMinor, input.CommissionBps)
			fee += lineFee
			tax += Percentage(lineFee, input.VATBps)
		}
	}

	// Only the passed parts ride the customer's checkout lines; the rest is
	// deducted from the store's share in the background (§4.4).
	var passedFee, passedTax int64
	if input.PassDown.XtiitchFee {
		passedFee = fee
	}
	if input.PassDown.Tax {
		passedTax = tax
	}

	charge := itemsTotal + passedFee + passedTax
	var paystackFee int64
	if input.PaystackBps > 0 {
		if input.PassDown.PaystackFee {
			// §4.6 gross-up: C = (amounts that must arrive intact) / (1 - rate).
			charge, paystackFee = GrossUp(charge, input.PaystackBps)
		} else {
			paystackFee = Percentage(charge, input.PaystackBps)
		}
	}

	transactionFee := passedFee
	if input.PassDown.PaystackFee {
		transactionFee += paystackFee
	}

	return StoreSaleQuote{
		ItemsTotalMinor:     itemsTotal,
		VATRateBps:          max(input.VATBps, 0),
		XtiitchFeeMinor:     fee,
		TaxMinor:            tax,
		PaystackFeeMinor:    paystackFee,
		TransactionFeeMinor: transactionFee,
		TaxLineMinor:        passedTax,
		TaxPassedDown:       input.PassDown.Tax,
		TotalChargeMinor:    charge,
		StoreNetMinor:       charge - paystackFee - fee - tax,
	}
}

// GrossUp computes the §4.6 gross-up: the total charge C such that after
// Paystack takes rateBps of C, netMinor arrives intact. C = net / (1 - rate),
// rounded half-up to the nearest pesewa (§4.7); the fee line is C - net. A
// non-positive rate or amount is a no-op; a rate at or above 100% is rejected
// as a no-op rather than dividing by zero.
func GrossUp(netMinor int64, rateBps int) (totalMinor int64, feeMinor int64) {
	if netMinor <= 0 || rateBps <= 0 {
		return netMinor, 0
	}
	if rateBps >= 10000 {
		return netMinor, 0
	}
	total := divRoundHalfUp(netMinor*10000, int64(10000-rateBps))
	return total, total - netMinor
}

// SubscriptionQuote is the §4.1 subscription checkout breakdown: the package
// price, the Tax (VAT) line on it, and the "Transaction fee" line grossed up so
// XCreativs nets package + VAT exactly after Paystack takes 1.95% of the total.
// All amounts are GHS minor units (pesewas).
type SubscriptionQuote struct {
	PackageMinor        int64
	VATMinor            int64
	TransactionFeeMinor int64
	TotalChargeMinor    int64
}

// QuoteSubscriptionCharge prices a subscription charge (activation, first
// purchase, upgrade proration, recurring renewal): package + VAT on the package
// + a Transaction fee grossed up over package + VAT (§4.1 worked example:
// 147.00 + 29.40 + 3.51 = 179.91, and XCreativs nets 176.40). The VAT treatment
// (added-at-checkout vs inclusive) follows the same flag as money.ApplyVAT.
func QuoteSubscriptionCharge(packageMinor int64, vatBps int, vatInclusive bool, paystackBps int) SubscriptionQuote {
	vat := ApplyVAT(packageMinor, vatBps, vatInclusive)
	total, fee := GrossUp(vat.GrossMinor, paystackBps)
	return SubscriptionQuote{
		PackageMinor:        vat.NetMinor,
		VATMinor:            vat.VATMinor,
		TransactionFeeMinor: fee,
		TotalChargeMinor:    total,
	}
}
