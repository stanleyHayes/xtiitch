package bookingapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeBookingRepo struct {
	rescheduled ports.RescheduleBookingInput
	cancelled   common.ID
}

func (r *fakeBookingRepo) HoldSlot(context.Context, common.TenantScope, ports.HoldSlotInput) error {
	return nil
}

func (r *fakeBookingRepo) DiscardHeldBooking(context.Context, common.TenantScope, common.ID, common.ID, common.ID) error {
	return nil
}

func (r *fakeBookingRepo) ListBookings(context.Context, common.TenantScope) ([]ports.BookingSummary, error) {
	return nil, nil
}

func (r *fakeBookingRepo) CancelBooking(_ context.Context, _ common.TenantScope, bookingID common.ID) error {
	r.cancelled = bookingID
	return nil
}

func (r *fakeBookingRepo) RescheduleBooking(_ context.Context, _ common.TenantScope, input ports.RescheduleBookingInput) error {
	r.rescheduled = input
	return nil
}

type fakeAvailability struct {
	slot booking.Slot
	err  error
}

func (f fakeAvailability) ResolveOpenSlot(context.Context, common.TenantScope, time.Time) (booking.Slot, error) {
	return f.slot, f.err
}

type fixedIDs struct{ id common.ID }

func (f fixedIDs) NewID() common.ID { return f.id }

func TestRescheduleBookingValidatesSlotBeforeMoving(t *testing.T) {
	t.Parallel()

	scope := common.TenantScope{BusinessID: "b1"}
	when := time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC)

	// A taken/invalid slot propagates and never touches the repository.
	repo := &fakeBookingRepo{}
	svc := NewService(Dependencies{Bookings: repo, Availability: fakeAvailability{err: ports.ErrSlotTaken}, IDs: fixedIDs{id: "new-1"}})
	if err := svc.RescheduleBooking(context.Background(), RescheduleBookingCommand{
		Scope:        scope,
		ActorRole:    business.UserRoleStaff,
		BookingID:    "old-1",
		NewSlotStart: when,
	}); !errors.Is(err, ports.ErrSlotTaken) {
		t.Fatalf("expected ErrSlotTaken, got %v", err)
	}
	if repo.rescheduled.OldBookingID != "" {
		t.Fatal("the repository must not be called when the new slot is unavailable")
	}

	// A resolved slot is moved with a fresh booking id and the slot's bounds.
	repo2 := &fakeBookingRepo{}
	slot := booking.Slot{Start: when, End: when.Add(time.Hour)}
	svc2 := NewService(Dependencies{Bookings: repo2, Availability: fakeAvailability{slot: slot}, IDs: fixedIDs{id: "new-1"}})
	if err := svc2.RescheduleBooking(context.Background(), RescheduleBookingCommand{
		Scope:        scope,
		ActorRole:    business.UserRoleAdmin,
		BookingID:    "old-1",
		NewSlotStart: when,
	}); err != nil {
		t.Fatalf("reschedule: %v", err)
	}
	if repo2.rescheduled.OldBookingID != "old-1" || repo2.rescheduled.NewBookingID != "new-1" ||
		!repo2.rescheduled.SlotStart.Equal(slot.Start) || !repo2.rescheduled.SlotEnd.Equal(slot.End) {
		t.Fatalf("unexpected reschedule input: %+v", repo2.rescheduled)
	}
}

func TestCancelBookingPassesThrough(t *testing.T) {
	t.Parallel()

	repo := &fakeBookingRepo{}
	svc := NewService(Dependencies{Bookings: repo, Availability: fakeAvailability{}, IDs: fixedIDs{}})
	if err := svc.CancelBooking(context.Background(), CancelBookingCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRoleStaff,
		BookingID: "book-1",
	}); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if repo.cancelled != "book-1" {
		t.Fatalf("expected cancel for book-1, got %q", repo.cancelled)
	}
}

func TestBookingOperationsRequireKnownBusinessRole(t *testing.T) {
	t.Parallel()

	repo := &fakeBookingRepo{}
	svc := NewService(Dependencies{Bookings: repo, Availability: fakeAvailability{}, IDs: fixedIDs{}})
	err := svc.CancelBooking(context.Background(), CancelBookingCommand{
		Scope:     common.TenantScope{BusinessID: "b1"},
		ActorRole: business.UserRole("viewer"),
		BookingID: "book-1",
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected forbidden role, got %v", err)
	}
	if repo.cancelled != "" {
		t.Fatalf("repository must not be called for forbidden role, got %q", repo.cancelled)
	}

	err = svc.RescheduleBooking(context.Background(), RescheduleBookingCommand{
		Scope:        common.TenantScope{},
		ActorRole:    business.UserRoleOwner,
		BookingID:    "book-1",
		NewSlotStart: time.Now(),
	})
	if !errors.Is(err, authdomain.ErrInvalidInput) {
		t.Fatalf("expected missing tenant scope to be invalid, got %v", err)
	}
}
