package money

// Percentage computes amountMinor * bps / 10000 rounded HALF-UP to the nearest
// pesewa. This is the §4.7 rounding rule applied to every computed fee, tax and
// split amount: Paystack works in two decimal places, so a computed fee that
// runs to a fraction of a pesewa rounds to the nearest one — 1.255 → 1.26
// (a trailing 5 rounds UP, never down), 1.243 → 1.24. It replaced the old
// floor-to-a-pesewa behaviour, which systematically under-charged.
//
// Non-positive amounts or rates yield zero; callers must not pass negative
// money (all amounts are unsigned minor units).
func Percentage(amountMinor int64, bps int) int64 {
	if amountMinor <= 0 || bps <= 0 {
		return 0
	}
	return (amountMinor*int64(bps) + 5000) / 10000
}

// divRoundHalfUp divides a positive numerator by a positive denominator with
// half-up rounding — the same §4.7 rule applied to a division (the §4.6
// gross-up) rather than to a percentage.
func divRoundHalfUp(numerator int64, denominator int64) int64 {
	if numerator <= 0 || denominator <= 0 {
		return 0
	}
	return (numerator + denominator/2) / denominator
}
