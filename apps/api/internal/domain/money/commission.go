package money

// Commission is the platform's split on a through-platform payment, in GHS
// pesewas. It is amount * basisPoints / 10000 (e.g. 300 bps = 3%), floored to a
// whole pesewa so the platform never rounds in its own favour. The business
// always nets at least amount - commission - provider fee.
//
// basisPoints below zero or amount below zero are treated as zero commission;
// callers must not pass negative money (all amounts are unsigned minor units).
func Commission(amountMinor int64, basisPoints int) int64 {
	if amountMinor <= 0 || basisPoints <= 0 {
		return 0
	}

	return amountMinor * int64(basisPoints) / 10000
}
