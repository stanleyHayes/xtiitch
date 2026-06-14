package common

import "testing"

func TestNewGHSMoneyRejectsNegativeAmounts(t *testing.T) {
	t.Parallel()

	if _, err := NewGHSMoney(-1); err == nil {
		t.Fatal("expected negative money to be rejected")
	}
}

func TestMoneyAddRejectsCurrencyMismatch(t *testing.T) {
	t.Parallel()

	left := Money{Currency: CurrencyGHS, MinorUnit: 100}
	right := Money{Currency: "USD", MinorUnit: 100}

	if _, err := left.Add(right); err != ErrCurrencyMismatch {
		t.Fatalf("expected currency mismatch, got %v", err)
	}
}

func TestMoneyAddSumsMinorUnits(t *testing.T) {
	t.Parallel()

	left, err := NewGHSMoney(150)
	if err != nil {
		t.Fatalf("new left money: %v", err)
	}

	right, err := NewGHSMoney(250)
	if err != nil {
		t.Fatalf("new right money: %v", err)
	}

	total, err := left.Add(right)
	if err != nil {
		t.Fatalf("add money: %v", err)
	}

	if total.MinorUnit != 400 {
		t.Fatalf("expected 400 pesewas, got %d", total.MinorUnit)
	}
}
