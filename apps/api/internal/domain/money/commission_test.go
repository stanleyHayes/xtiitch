package money

import "testing"

func TestCommission(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		amountMinor int64
		basisPoints int
		want        int64
	}{
		{"free plan 3 percent of GHS 200", 20000, 300, 600},
		{"standard plan 1 percent of GHS 200", 20000, 100, 200},
		{"growth plan half percent of GHS 200", 20000, 50, 100},
		{"rounds a fractional pesewa to the nearest", 10133, 300, 304},
		{"rounds a trailing 5 half up", 10150, 300, 305},
		{"caps the platform fee at GHS 50", 2000000, 300, 5000},
		{"just under the GHS 50 cap is uncapped", 166000, 300, 4980},
		{"zero amount", 0, 300, 0},
		{"zero rate", 20000, 0, 0},
		{"negative rate treated as zero", 20000, -5, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := Commission(tc.amountMinor, tc.basisPoints); got != tc.want {
				t.Fatalf("Commission(%d, %d) = %d, want %d", tc.amountMinor, tc.basisPoints, got, tc.want)
			}
		})
	}
}

// §4.7: every computed fee, tax and split amount rounds half-up to the nearest
// pesewa — 1.255 → 1.26 (a trailing 5 rounds up), 1.243 → 1.24.
func TestPercentageRoundsHalfUp(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		amountMinor int64
		bps         int
		want        int64
	}{
		{"§4.7: 1.243 rounds down to 1.24", 1243, 1000, 124},
		{"§4.7: 1.255 rounds up to 1.26", 1255, 1000, 126},
		{"§4.7: 3% of GHS 50 is exactly 1.50", 5000, 300, 150},
		{"20% VAT of GHS 147 is exactly 29.40", 14700, 2000, 2940},
		{"1.95% of GHS 50 rounds 0.975 up to 0.98", 5000, 195, 98},
		{"zero amount", 0, 195, 0},
		{"zero rate", 5000, 0, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := Percentage(tc.amountMinor, tc.bps); got != tc.want {
				t.Fatalf("Percentage(%d, %d) = %d, want %d", tc.amountMinor, tc.bps, got, tc.want)
			}
		})
	}
}
