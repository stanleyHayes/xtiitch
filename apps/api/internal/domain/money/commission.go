package money

// MaxCommissionMinor caps the platform's per-design sales fee at GHS 50
// (5000 pesewas), per §4.2: "Xtiitch takes its percentage (by the store's plan)
// off each single design purchased, capped at GHS 50 per design."
const MaxCommissionMinor int64 = 5000

// Commission is the platform's fee on ONE design's price, in GHS pesewas. It is
// amount * basisPoints / 10000 (e.g. 300 bps = 3%) rounded half-up to the
// nearest pesewa (the §4.7 rounding rule — 3% of GHS 50 is exactly GHS 1.50),
// then capped at MaxCommissionMinor. A bulk cart commissions each design
// separately (its own cap) and sums the capped fees (§4.3).
//
// basisPoints below zero or amount below zero are treated as zero commission;
// callers must not pass negative money (all amounts are unsigned minor units).
func Commission(amountMinor int64, basisPoints int) int64 {
	commission := Percentage(amountMinor, basisPoints)
	if commission > MaxCommissionMinor {
		return MaxCommissionMinor
	}
	return commission
}
