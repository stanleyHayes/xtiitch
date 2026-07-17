package money_test

import (
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

func TestRoundToWholeCediRoundsHalvesUp(t *testing.T) {
	t.Parallel()

	cases := map[int64]int64{
		0:     0,
		1:     0,     // 0.01 -> 0
		49:    0,     // 0.49 -> 0
		50:    100,   // 0.50 rounds UP, per the book's stated rule
		51:    100,   // 0.51 -> 1
		100:   100,   // already whole
		11760: 11800, // 20% off GHS 147 = 117.60 -> 118
		13230: 13200, // 10% off GHS 147 = 132.30 -> 132
		29700: 29700, // a stored charm price is already whole
	}
	for in, want := range cases {
		if got := money.RoundToWholeCedi(in); got != want {
			t.Errorf("RoundToWholeCedi(%d) = %d, want %d", in, got, want)
		}
	}
}

func TestCeilToWholeCediNeverRoundsAChargeAwayToZero(t *testing.T) {
	t.Parallel()

	cases := map[int64]int64{
		0:    0,
		1:    100, // a charge of one pesewa is still a charge: bill a cedi
		99:   100,
		100:  100, // already whole
		101:  200,
		9783: 9800, // a prorated upgrade difference
	}
	for in, want := range cases {
		if got := money.CeilToWholeCedi(in); got != want {
			t.Errorf("CeilToWholeCedi(%d) = %d, want %d", in, got, want)
		}
	}
}

// Every result must land on a cedi boundary — that is the whole point ("no
// pesewa decimals anywhere", Pricing Book §1).
func TestWholeCediHelpersAlwaysLandOnACediBoundary(t *testing.T) {
	t.Parallel()

	for amount := int64(0); amount <= 1000; amount++ {
		if got := money.RoundToWholeCedi(amount); got%money.PesewasPerCedi != 0 {
			t.Fatalf("RoundToWholeCedi(%d) = %d, which is not a whole cedi", amount, got)
		}
		if got := money.CeilToWholeCedi(amount); got%money.PesewasPerCedi != 0 {
			t.Fatalf("CeilToWholeCedi(%d) = %d, which is not a whole cedi", amount, got)
		}
	}
}
