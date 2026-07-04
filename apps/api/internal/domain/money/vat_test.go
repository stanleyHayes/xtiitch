package money

import "testing"

func TestApplyVATDisabledIsNoOp(t *testing.T) {
	t.Parallel()

	for _, base := range []int64{0, 1, 5000, 120000} {
		got := ApplyVAT(base, 0, false)
		if got.GrossMinor != base || got.NetMinor != base || got.VATMinor != 0 {
			t.Fatalf("rate 0 must be a no-op for base %d, got %+v", base, got)
		}
		// A negative/zero rate with inclusive set is still a no-op.
		if inc := ApplyVAT(base, -100, true); inc.GrossMinor != base || inc.VATMinor != 0 {
			t.Fatalf("negative rate must be a no-op for base %d, got %+v", base, inc)
		}
	}
}

func TestApplyVATExclusiveAddsOnTop(t *testing.T) {
	t.Parallel()

	// GHS 50.00 (5000 pesewas) at Ghana's 20% standard rate.
	got := ApplyVAT(5000, GhanaStandardVATRateBps, false)
	if got.NetMinor != 5000 {
		t.Fatalf("exclusive net should equal the base, got %d", got.NetMinor)
	}
	if got.VATMinor != 1000 {
		t.Fatalf("expected VAT 1000, got %d", got.VATMinor)
	}
	if got.GrossMinor != 6000 {
		t.Fatalf("expected gross 6000, got %d", got.GrossMinor)
	}
	if got.NetMinor+got.VATMinor != got.GrossMinor {
		t.Fatalf("components must reconcile: %+v", got)
	}
}

func TestApplyVATInclusiveBacksOutVAT(t *testing.T) {
	t.Parallel()

	// GHS 60.00 gross at 20% inclusive: net 50.00, VAT 10.00.
	got := ApplyVAT(6000, GhanaStandardVATRateBps, true)
	if got.GrossMinor != 6000 {
		t.Fatalf("inclusive gross should equal the base, got %d", got.GrossMinor)
	}
	if got.NetMinor != 5000 {
		t.Fatalf("expected net 5000, got %d", got.NetMinor)
	}
	if got.VATMinor != 1000 {
		t.Fatalf("expected VAT 1000, got %d", got.VATMinor)
	}
	if got.NetMinor+got.VATMinor != got.GrossMinor {
		t.Fatalf("components must reconcile: %+v", got)
	}
}

func TestApplyVATRoundsToNearestPesewaAndReconciles(t *testing.T) {
	t.Parallel()

	// 333 pesewas at 20% exclusive: 66.6 -> 67 (half-up rounds .6 up).
	ex := ApplyVAT(333, 2000, false)
	if ex.VATMinor != 67 || ex.GrossMinor != 400 {
		t.Fatalf("expected vat 67 gross 400, got %+v", ex)
	}

	// Reconciliation must always hold across a spread of odd amounts/rates.
	for _, base := range []int64{1, 7, 99, 333, 12345, 999999} {
		for _, rate := range []int{150, 2000, 2190} {
			inc := ApplyVAT(base, rate, true)
			if inc.NetMinor+inc.VATMinor != inc.GrossMinor || inc.GrossMinor != base {
				t.Fatalf("inclusive reconcile failed base=%d rate=%d: %+v", base, rate, inc)
			}
			exx := ApplyVAT(base, rate, false)
			if exx.NetMinor+exx.VATMinor != exx.GrossMinor || exx.NetMinor != base {
				t.Fatalf("exclusive reconcile failed base=%d rate=%d: %+v", base, rate, exx)
			}
		}
	}
}
