package money

import (
	"errors"
	"testing"
)

func ptr(v int64) *int64 { return &v }

func TestResolveDeposit(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		override *int64
		store    *int64
		want     int64
	}{
		{"nothing set uses floor", nil, nil, DepositFloorMinor},
		{"store default used when no override", nil, ptr(25000), 25000},
		{"override takes precedence over store default", ptr(15000), ptr(25000), 15000},
		{"override below floor clamps up", ptr(5000), nil, DepositFloorMinor},
		{"store default below floor clamps up", nil, ptr(5000), DepositFloorMinor},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := ResolveDeposit(tc.override, tc.store); got != tc.want {
				t.Fatalf("ResolveDeposit(%v, %v) = %d, want %d", tc.override, tc.store, got, tc.want)
			}
		})
	}
}

func TestValidateDepositConfig(t *testing.T) {
	t.Parallel()

	if err := ValidateDepositConfig(DepositFloorMinor); err != nil {
		t.Fatalf("expected floor to be valid, got %v", err)
	}
	if err := ValidateDepositConfig(DepositFloorMinor - 1); !errors.Is(err, ErrDepositBelowFloor) {
		t.Fatalf("expected below-floor rejection, got %v", err)
	}
}
