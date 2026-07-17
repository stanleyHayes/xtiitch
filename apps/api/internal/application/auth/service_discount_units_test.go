package authapp

import "testing"

// A percentage discount's value is WHOLE PERCENT. The admin console used to scale
// it by 100 like a cedi amount, storing 20 as 2000; the charge maths reads the
// value as a percentage, so 2000 meant 2000% off -- clamped to the renewal, and
// every percentage code silently gave the plan away FREE. Pin the units.
func TestComputeDiscountOutcomeReadsPercentageAsWholePercent(t *testing.T) {
	t.Parallel()

	// 20% off the GHS 147 Starter quarterly renewal is 117.60 -> GHS 118.
	got := computeDiscountOutcome("percentage", 20, 14700)
	if got.ChargeMinor != 11800 {
		t.Fatalf("expected 20%% off 14700 to charge 11800, got %d", got.ChargeMinor)
	}
	if got.DiscountMinor != 14700-11800 {
		t.Fatalf("discount must reconcile to the renewal: %+v", got)
	}
	if got.FreePeriod {
		t.Fatal("a percentage discount is not a free period")
	}
}

// The bug's exact shape: a basis-points value must not read as a giveaway. It
// cannot be stored any more (validation caps at 100), so this pins the maths.
func TestComputeDiscountOutcomeDoesNotTreatOneHundredAsFree(t *testing.T) {
	t.Parallel()

	if got := computeDiscountOutcome("percentage", 100, 14700); got.ChargeMinor != 0 {
		t.Fatalf("100%% off must charge nothing, got %d", got.ChargeMinor)
	}
	// 99% off still collects something -- it must not round away to free.
	got := computeDiscountOutcome("percentage", 99, 14700)
	if got.ChargeMinor <= 0 {
		t.Fatalf("99%% off must still collect something, got %d", got.ChargeMinor)
	}
}

// Every charge a discount produces is a whole cedi ("no pesewa decimals
// anywhere", Pricing Book §1/§7), and charge + discount always reconciles to the
// renewal figure exactly.
func TestComputeDiscountOutcomeAlwaysChargesWholeCedisAndReconciles(t *testing.T) {
	t.Parallel()

	const renewal int64 = 14700
	for percent := 1; percent <= 100; percent++ {
		got := computeDiscountOutcome("percentage", percent, renewal)
		if got.ChargeMinor%100 != 0 {
			t.Fatalf("%d%% off charged %d, which is not a whole cedi", percent, got.ChargeMinor)
		}
		if got.ChargeMinor+got.DiscountMinor != renewal {
			t.Fatalf("%d%%: charge+discount = %d, want %d", percent, got.ChargeMinor+got.DiscountMinor, renewal)
		}
	}
	// A fixed code entered as GHS 12.50 (1250 pesewas) must not bill GHS 134.50.
	fixed := computeDiscountOutcome("fixed", 1250, renewal)
	if fixed.ChargeMinor%100 != 0 {
		t.Fatalf("a fixed discount charged %d, which is not a whole cedi", fixed.ChargeMinor)
	}
	if fixed.ChargeMinor+fixed.DiscountMinor != renewal {
		t.Fatalf("fixed: charge+discount = %d, want %d", fixed.ChargeMinor+fixed.DiscountMinor, renewal)
	}
	// A fixed code larger than the renewal collects nothing, never a negative.
	if over := computeDiscountOutcome("fixed", 999999, renewal); over.ChargeMinor != 0 {
		t.Fatalf("an oversized fixed discount must charge nothing, got %d", over.ChargeMinor)
	}
}
