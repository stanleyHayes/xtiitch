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
		{"floors fractional pesewa down", 10133, 300, 303},
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
