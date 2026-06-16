// Package bookingapp manages a business's home-visit bookings after they are
// made: listing the visit queue, cancelling, and rescheduling.
package bookingapp

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// Availability is the slice of the availability use case rescheduling needs:
// confirm the new slot is currently open before moving the booking onto it.
type Availability interface {
	ResolveOpenSlot(ctx context.Context, scope common.TenantScope, slotStart time.Time) (booking.Slot, error)
}

type Service struct {
	bookings     ports.BookingRepository
	availability Availability
	ids          ports.IDGenerator
}

type Dependencies struct {
	Bookings     ports.BookingRepository
	Availability Availability
	IDs          ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{bookings: deps.Bookings, availability: deps.Availability, ids: deps.IDs}
}

// ListBookings returns the business's visit queue.
func (s Service) ListBookings(ctx context.Context, scope common.TenantScope) ([]ports.BookingSummary, error) {
	return s.bookings.ListBookings(ctx, scope)
}

// CancelBooking cancels a visit and frees its slot.
func (s Service) CancelBooking(ctx context.Context, scope common.TenantScope, bookingID common.ID) error {
	return s.bookings.CancelBooking(ctx, scope, bookingID)
}

// RescheduleBooking moves a booked visit to a new open slot. The new slot is
// validated against current availability, then the move is applied atomically
// (the new-slot insert hits the no-double-book index, so a taken target fails).
func (s Service) RescheduleBooking(ctx context.Context, scope common.TenantScope, bookingID common.ID, newSlotStart time.Time) error {
	slot, err := s.availability.ResolveOpenSlot(ctx, scope, newSlotStart)
	if err != nil {
		return err
	}
	return s.bookings.RescheduleBooking(ctx, scope, ports.RescheduleBookingInput{
		OldBookingID: bookingID,
		NewBookingID: s.ids.NewID(),
		SlotStart:    slot.Start,
		SlotEnd:      slot.End,
	})
}
