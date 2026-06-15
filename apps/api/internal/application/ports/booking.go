package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// AvailabilityRepository stores a business's recurring home-visit windows and
// reads what is already taken, all tenant-scoped.
type AvailabilityRepository interface {
	// ReplaceWindows replaces the business's entire weekly availability with the
	// given windows in one transaction.
	ReplaceWindows(ctx context.Context, scope common.TenantScope, windows []AvailabilityWindow) error
	// ListWindows returns the business's windows and its configured timezone.
	ListWindows(ctx context.Context, scope common.TenantScope) ([]booking.Window, string, error)
	// ListTakenSlots returns the slot start times already held or booked in the
	// range, so open slots can be derived by subtraction.
	ListTakenSlots(ctx context.Context, scope common.TenantScope, from, to time.Time) ([]time.Time, error)
}

type AvailabilityWindow struct {
	WindowID    common.ID
	Weekday     int
	StartMinute int
	EndMinute   int
	SlotMinutes int
}

// BookingRepository holds and releases home-visit slots, tenant-scoped.
type BookingRepository interface {
	// HoldSlot reserves a slot by inserting a held booking. It returns
	// ErrSlotTaken when the slot is already held/booked (enforced by a partial
	// unique index, so the check is race-proof).
	HoldSlot(ctx context.Context, scope common.TenantScope, input HoldSlotInput) error
	// DiscardHeldBooking compensates a booking checkout whose deposit could not be
	// raised: it removes the held booking, the still-draft order, and the customer.
	DiscardHeldBooking(ctx context.Context, scope common.TenantScope, bookingID, orderID, customerID common.ID) error
}

type HoldSlotInput struct {
	BookingID  common.ID
	BusinessID common.ID
	CustomerID common.ID
	OrderID    common.ID
	SlotStart  time.Time
	SlotEnd    time.Time
	Address    string
}
