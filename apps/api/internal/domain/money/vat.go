package money

// GhanaStandardVATRateBps is Ghana's standard effective VAT rate as of 1 Jan 2026
// in basis points: 20% (2000 bps) — a unified 15% VAT + 2.5% NHIL + 2.5% GETFund
// levied on the same base (the 1% COVID-19 levy was abolished). The live admin
// platform setting is the runtime source; XTIITCH_SUBSCRIPTION_VAT_RATE_BPS is
// the fallback when that setting cannot be read.
const GhanaStandardVATRateBps = 2000

// VATBreakdown splits a subscription charge into its net (ex-VAT) and VAT
// components alongside the gross amount actually charged, all in GHS minor units
// (pesewas). It is the single source of truth for how VAT is applied to Xtiitch
// subscription fees (Pricing Book tax decision flag).
type VATBreakdown struct {
	// NetMinor is the amount excluding VAT.
	NetMinor int64
	// VATMinor is the VAT portion.
	VATMinor int64
	// GrossMinor is the amount actually charged (NetMinor + VATMinor).
	GrossMinor int64
	// RateBps is the rate applied (0 when VAT is disabled), for disclosure.
	RateBps int
	// Inclusive reports whether the input price already contained VAT.
	Inclusive bool
}

// ApplyVAT computes the VAT breakdown for a base subscription price in pesewas.
//
//   - rateBps <= 0 (VAT disabled) or baseMinor <= 0: gross == net == base, VAT 0,
//     so the default configuration is a no-op and current behaviour is preserved.
//   - inclusive == false (added-at-checkout): the listed price is the net; VAT is
//     added on top, so gross = base + round(base * rate). This is the default mode.
//   - inclusive == true: the listed price already contains VAT, so gross = base,
//     net = round(base / (1 + rate)), VAT = base - net.
//
// Rounding is to the nearest pesewa (half-up). The components always reconcile
// exactly: NetMinor + VATMinor == GrossMinor.
func ApplyVAT(baseMinor int64, rateBps int, inclusive bool) VATBreakdown {
	if rateBps <= 0 || baseMinor <= 0 {
		return VATBreakdown{
			NetMinor:   baseMinor,
			VATMinor:   0,
			GrossMinor: baseMinor,
			RateBps:    0,
			Inclusive:  inclusive,
		}
	}

	if inclusive {
		// The base already contains VAT: back out the net at nearest pesewa, then
		// VAT is the remainder so net + vat == base exactly.
		divisor := int64(10000 + rateBps)
		net := (baseMinor*10000 + divisor/2) / divisor
		return VATBreakdown{
			NetMinor:   net,
			VATMinor:   baseMinor - net,
			GrossMinor: baseMinor,
			RateBps:    rateBps,
			Inclusive:  true,
		}
	}

	// Added-at-checkout: VAT is charged on top of the listed net price.
	vat := (baseMinor*int64(rateBps) + 5000) / 10000
	return VATBreakdown{
		NetMinor:   baseMinor,
		VATMinor:   vat,
		GrossMinor: baseMinor + vat,
		RateBps:    rateBps,
		Inclusive:  false,
	}
}
