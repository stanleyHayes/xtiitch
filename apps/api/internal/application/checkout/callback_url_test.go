package checkoutapp

import (
	"context"
	"errors"
	"strings"
	"testing"

	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §5.2 callback_url: after paying one store basket the customer is redirected
// back to the cart (or home when no baskets remain). The URL is forwarded to
// the payment provider verbatim, so it is validated before it ever leaves.

func TestCleanCallbackURLAcceptsHTTPS(t *testing.T) {
	t.Parallel()

	got, err := CleanCallbackURL("  https://store.xtiitch.com/cart?paid=1 ")
	if err != nil {
		t.Fatalf("unexpected rejection: %v", err)
	}
	if got != "https://store.xtiitch.com/cart?paid=1" {
		t.Fatalf("expected the trimmed URL returned verbatim, got %q", got)
	}
}

func TestCleanCallbackURLAcceptsLoopbackHTTP(t *testing.T) {
	t.Parallel()

	for _, raw := range []string{
		"http://localhost:3000/cart",
		"http://127.0.0.1:8080/cart",
		"http://[::1]:3000/cart",
		"http://store.localhost/cart",
	} {
		if _, err := CleanCallbackURL(raw); err != nil {
			t.Fatalf("%s: loopback http must be accepted for dev, got %v", raw, err)
		}
	}
}

func TestCleanCallbackURLEmptyStaysEmpty(t *testing.T) {
	t.Parallel()

	got, err := CleanCallbackURL("   ")
	if err != nil || got != "" {
		t.Fatalf("an absent callback must stay absent, got %q / %v", got, err)
	}
}

func TestCleanCallbackURLRejectsUnsafeValues(t *testing.T) {
	t.Parallel()

	for _, raw := range []string{
		"store.xtiitch.com/cart",               // not absolute
		"/cart",                                // relative
		"http://store.xtiitch.com/cart",        // plain http off-loopback
		"ftp://store.xtiitch.com/cart",         // wrong scheme
		"javascript:alert(1)",                  // script scheme
		"https://" + strings.Repeat("a", 2100), // over the length cap
	} {
		if _, err := CleanCallbackURL(raw); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("%q: expected ErrInvalidInput, got %v", raw, err)
		}
	}
}

func TestPlaceStandardOrderPassesCallbackURLToCharge(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := newTestService(orders, payments)

	command := placeCommand()
	command.CallbackURL = "https://store.xtiitch.com/cart"
	if _, err := svc.PlaceStandardOrder(context.Background(), command); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payments.command.CallbackURL != "https://store.xtiitch.com/cart" {
		t.Fatalf("expected the callback threaded to the charge, got %+v", payments.command)
	}
}

func TestPlaceStandardOrderRejectsInvalidCallbackURLBeforeWriting(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := newTestService(orders, payments)

	command := placeCommand()
	command.CallbackURL = "http://store.xtiitch.com/cart"
	if _, err := svc.PlaceStandardOrder(context.Background(), command); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	if payments.called {
		t.Fatal("an invalid callback must never reach the payment provider")
	}
	if orders.created.OrderID != "" {
		t.Fatal("an invalid callback must fail before any order is written")
	}
}

func TestPlaceCartOrderPassesCallbackURLToCharge(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{result: paymentsapp.ChargeResult{Reference: "xt_ref", AuthorizationURL: "https://pay"}}
	svc := NewService(Dependencies{
		Storefront: fakeStorefront{
			store: ports.Storefront{BusinessID: testBusinessID, OnlineOrderingEnabled: true},
			design: ports.StorefrontDesign{
				Design: catalogue.Design{ID: "design-1", BusinessID: testBusinessID},
				Prices: []catalogue.BandPrice{{SizeBandID: "band-1", PriceMinor: 50000}},
			},
		},
		Businesses: fakeCharge{ctx: ports.BusinessChargeContext{
			BusinessID: testBusinessID, Verified: true, SubaccountRef: "acct_1",
		}},
		Orders:   orders,
		Payments: payments,
		IDs:      &seqIDs{ids: []common.ID{"group-1", "customer-1", "order-a"}},
	})

	_, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle:  "shop",
		Lines:        []CartLineCommand{{DesignHandle: "design", SizeBandID: "band-1"}},
		CustomerName: "Ama", CustomerEmail: "ama@example.com", CustomerPhone: "+233 24 000 0000",
		CallbackURL: "https://kbdesigns.xtiitch.com/cart",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payments.command.CallbackURL != "https://kbdesigns.xtiitch.com/cart" {
		t.Fatalf("expected the cart callback threaded to the charge, got %+v", payments.command)
	}
}

func TestPlaceCartOrderRejectsInvalidCallbackURL(t *testing.T) {
	t.Parallel()

	orders := &fakeOrders{}
	payments := &fakePayments{}
	svc := newTestService(orders, payments)

	_, err := svc.PlaceCartOrder(context.Background(), PlaceCartOrderCommand{
		StoreHandle:  "shop",
		Lines:        []CartLineCommand{{DesignHandle: "design", SizeBandID: "band-1"}},
		CustomerName: "Ama", CustomerEmail: "ama@example.com",
		CallbackURL: "javascript:alert(1)",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	if payments.called {
		t.Fatal("an invalid callback must never reach the payment provider")
	}
}
