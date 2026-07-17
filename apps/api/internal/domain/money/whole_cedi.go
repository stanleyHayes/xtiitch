package money

// PesewasPerCedi is the number of minor units in one Ghana cedi.
const PesewasPerCedi int64 = 100

// RoundToWholeCedi rounds a pesewa amount to a whole cedi, halves up.
//
// Every subscription figure Xtiitch bills or displays is a whole cedi: "GHS only.
// Whole cedis in all display and billing" (Pricing Book §7), "Charm-priced in
// whole cedis — no pesewa decimals anywhere" (§1), "All amounts GHS, rounded to
// the nearest whole cedi (0.5 rounds up)" (footer). The master price table is
// charm-priced to the cedi throughout.
//
// The rule is only violated by figures we COMPUTE rather than read: a prorated
// upgrade difference or a percentage discount can land on any pesewa. Those are
// the callers; the stored figures are already whole.
//
// Halves up matches the book's stated rounding and, for a proration or a
// discounted charge, rounds in Xtiitch's favour by at most one pesewa.
//
// Negative inputs are not expected (callers guard for them) but round
// symmetrically away from zero rather than doing something surprising.
func RoundToWholeCedi(amountMinor int64) int64 {
	if amountMinor < 0 {
		return -RoundToWholeCedi(-amountMinor)
	}
	return (amountMinor + PesewasPerCedi/2) / PesewasPerCedi * PesewasPerCedi
}

// CeilToWholeCedi rounds a pesewa amount UP to the next whole cedi.
//
// For a charge that must not be rounded DOWN to zero: a proration for a genuine
// upgrade of a few hours should bill one cedi, not nothing. Anything already on a
// cedi boundary is unchanged.
func CeilToWholeCedi(amountMinor int64) int64 {
	if amountMinor <= 0 {
		return 0
	}
	return (amountMinor + PesewasPerCedi - 1) / PesewasPerCedi * PesewasPerCedi
}
