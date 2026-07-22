package customerauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

func TestCloseOrderUsesCustomerIdentityAndCurrentTime(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{closeFound: true}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})
	if err := service.CloseOrder(context.Background(), "customer-1", "order-1"); err != nil {
		t.Fatalf("close order: %v", err)
	}
	if repo.closedOrderID != "order-1" {
		t.Fatalf("closed order = %q, want order-1", repo.closedOrderID)
	}
	want := time.Date(2026, 6, 20, 20, 0, 0, 0, time.UTC)
	if !repo.closedAt.Equal(want) {
		t.Fatalf("closed at = %s, want %s", repo.closedAt, want)
	}
}

func TestCloseOrderHidesMissingAndNonDraftOrders(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{closeFound: false}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})
	if err := service.CloseOrder(context.Background(), "customer-1", "order-1"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
}
