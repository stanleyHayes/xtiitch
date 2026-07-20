package authapp

import (
	"context"
	"errors"
	"testing"
)

type fakeVATRates struct {
	rateBps int
	err     error
}

func (f *fakeVATRates) VATRateBps(context.Context) (int, error) {
	return f.rateBps, f.err
}

// §4.1 worked example through the service: with the live VAT rate at 20% the
// Starter quarterly renewal charges 147.00 + 29.40 + 3.51 = 179.91, so
// XCreativs nets package + VAT exactly after Paystack's 1.95%.
func TestSubscriptionChargeTotalWorkedExample(t *testing.T) {
	t.Parallel()

	service := NewService(Dependencies{VATRates: &fakeVATRates{rateBps: 2000}})
	if total := service.subscriptionChargeTotal(context.Background(), 14700); total != 17991 {
		t.Fatalf("subscription charge total = %d, want 17991 (147.00 + 29.40 + 3.51)", total)
	}
}

// The live reader wins over the configured seed; a failing reader falls back to
// the seed; no reader at all uses the seed.
func TestSubscriptionChargeTotalLiveRateAndFallback(t *testing.T) {
	t.Parallel()

	live := NewService(Dependencies{VATRates: &fakeVATRates{rateBps: 0}, VATRateBps: 2000})
	if total := live.subscriptionChargeTotal(context.Background(), 14700); total != 14992 {
		t.Fatalf("a live 0%% disables VAT even with a 20%% seed: total = %d, want 14992", total)
	}

	failing := NewService(Dependencies{VATRates: &fakeVATRates{err: errors.New("db down")}, VATRateBps: 2000})
	if total := failing.subscriptionChargeTotal(context.Background(), 14700); total != 17991 {
		t.Fatalf("a failing reader must fall back to the seeded 20%%: total = %d, want 17991", total)
	}

	seedOnly := NewService(Dependencies{VATRateBps: 2000})
	if total := seedOnly.subscriptionChargeTotal(context.Background(), 14700); total != 17991 {
		t.Fatalf("the seed applies with no reader: total = %d, want 17991", total)
	}
}
