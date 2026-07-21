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
		{"override below floor clamps up", ptr(50), nil, DepositFloorMinor},
		{"store default below floor clamps up", nil, ptr(50), DepositFloorMinor},
		{"zero override resolves to the GHS 1 floor", ptr(0), nil, 100},
		{"zero store default resolves to the GHS 1 floor", nil, ptr(0), 100},
		{"floor itself is allowed", ptr(100), nil, 100},
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
	// 0 means "unset / use the GHS 1 default" — never an error.
	if err := ValidateDepositConfig(0); err != nil {
		t.Fatalf("expected zero (unset) to be accepted, got %v", err)
	}
	if err := ValidateDepositConfig(-1); !errors.Is(err, ErrDepositBelowFloor) {
		t.Fatalf("expected a negative deposit to be rejected, got %v", err)
	}
	// No upper cap.
	if err := ValidateDepositConfig(100000000); err != nil {
		t.Fatalf("expected no upper cap, got %v", err)
	}
}
