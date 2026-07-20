package customerauth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

// §5.3.2 "Received": the customer acknowledges physical receipt of an archived
// (final-stage) order and it disappears from their Archived tab.

func TestMarkOrderReceivedStampsFinalStageOrder(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{markResult: ports.MarkReceivedResult{Found: true, FinalStage: true}}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	if err := service.MarkOrderReceived(context.Background(), "customer-1", "order-1"); err != nil {
		t.Fatalf("mark received: %v", err)
	}
	if repo.markedOrder != "order-1" {
		t.Fatalf("expected order-1 stamped, got %q", repo.markedOrder)
	}
	want := time.Date(2026, 6, 20, 20, 0, 0, 0, time.UTC)
	if !repo.markedAt.Equal(want) {
		t.Fatalf("expected the service clock's time stamped, got %v", repo.markedAt)
	}
}

func TestMarkOrderReceivedRejectsNonFinalStage(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{markResult: ports.MarkReceivedResult{Found: true, FinalStage: false}}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	err := service.MarkOrderReceived(context.Background(), "customer-1", "order-1")
	if !errors.Is(err, ErrOrderNotInFinalStage) {
		t.Fatalf("expected ErrOrderNotInFinalStage, got %v", err)
	}
}

func TestMarkOrderReceivedIsIdempotent(t *testing.T) {
	t.Parallel()

	// Already stamped: a repeat tap on "Received" is a no-op, not an error.
	repo := &fakeRepo{markResult: ports.MarkReceivedResult{Found: true, FinalStage: true, AlreadyReceived: true}}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	if err := service.MarkOrderReceived(context.Background(), "customer-1", "order-1"); err != nil {
		t.Fatalf("re-marking must be a no-op, got %v", err)
	}
}

func TestMarkOrderReceivedHidesOtherCustomersOrders(t *testing.T) {
	t.Parallel()

	// The repository reports found=false for another customer's order too, so
	// the caller can never tell "exists but not yours" from "does not exist".
	repo := &fakeRepo{markResult: ports.MarkReceivedResult{Found: false}}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	err := service.MarkOrderReceived(context.Background(), "customer-1", "order-9")
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestMarkBasketReceivedReturnsNewlyStampedCount(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{basketCount: 3}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	marked, err := service.MarkBasketReceived(context.Background(), "customer-1", "group-1")
	if err != nil {
		t.Fatalf("mark basket received: %v", err)
	}
	if marked != 3 {
		t.Fatalf("expected 3 newly stamped, got %d", marked)
	}
	if repo.markedBasketID != "group-1" {
		t.Fatalf("expected basket group-1, got %q", repo.markedBasketID)
	}
}

func TestMarkBasketReceivedRepeatStampsNothing(t *testing.T) {
	t.Parallel()

	// Idempotent: every order in the basket is already stamped (or not yet
	// final), so the repeat call reports 0 and succeeds.
	repo := &fakeRepo{basketCount: 0}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	marked, err := service.MarkBasketReceived(context.Background(), "customer-1", "group-1")
	if err != nil {
		t.Fatalf("repeat basket mark must succeed, got %v", err)
	}
	if marked != 0 {
		t.Fatalf("expected 0 newly stamped on repeat, got %d", marked)
	}
}

func TestMarkReceivedRejectsZeroIDs(t *testing.T) {
	t.Parallel()

	repo := &fakeRepo{markResult: ports.MarkReceivedResult{Found: true, FinalStage: true}}
	service := newTestService(repo, &fakeDelivery{}, &fakeEmailDelivery{})

	if err := service.MarkOrderReceived(context.Background(), "", "order-1"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("empty customer must be not-found, got %v", err)
	}
	if err := service.MarkOrderReceived(context.Background(), "customer-1", ""); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("empty order must be not-found, got %v", err)
	}
	if _, err := service.MarkBasketReceived(context.Background(), "customer-1", ""); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("empty basket must be not-found, got %v", err)
	}
	if repo.markedOrder != "" || repo.markedBasketID != "" {
		t.Fatal("a zero id must never reach the repository")
	}
}
