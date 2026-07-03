// Package availabilityapp manages a business's home-visit availability and
// derives the open slots customers can book.
package availabilityapp

import (
	"context"
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var (
	ErrInvalidInput  = errors.New("invalid availability input")
	ErrStoreNotFound = errors.New("store not found")
)

type Service struct {
	availability ports.AvailabilityRepository
	storefront   ports.StorefrontRepository
	ids          ports.IDGenerator
	now          func() time.Time
}

type Dependencies struct {
	Availability ports.AvailabilityRepository
	Storefront   ports.StorefrontRepository
	IDs          ports.IDGenerator
	Now          func() time.Time
}

func NewService(deps Dependencies) Service {
	now := deps.Now
	if now == nil {
		now = time.Now
	}
	return Service{availability: deps.Availability, storefront: deps.Storefront, ids: deps.IDs, now: now}
}

type WindowInput struct {
	Weekday     int
	StartMinute int
	EndMinute   int
	SlotMinutes int
	Recurrence  string
	DayOfMonth  int
}

type DefineAvailabilityCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Windows   []WindowInput
}

// DefineAvailability replaces the business's weekly home-visit windows. Windows
// are validated and may not overlap on the same weekday, so a slot start is
// always defined by exactly one window (no duplicate or ambiguous slots).
func (s Service) DefineAvailability(ctx context.Context, command DefineAvailabilityCommand) error {
	if err := authorizeAvailabilityManagement(command.ActorRole); err != nil {
		return err
	}

	// Normalise recurrence up front (empty -> 'weekly') so validation, overlap
	// detection, and persistence all see the same canonical value.
	windows := make([]WindowInput, len(command.Windows))
	copy(windows, command.Windows)
	for i := range windows {
		if windows[i].Recurrence == "" {
			windows[i].Recurrence = booking.RecurrenceWeekly
		}
	}

	for _, w := range windows {
		if w.StartMinute < 0 || w.EndMinute <= w.StartMinute || w.EndMinute > 1440 ||
			w.SlotMinutes < 15 || w.SlotMinutes > 480 {
			return ErrInvalidInput
		}
		switch w.Recurrence {
		case booking.RecurrenceWeekly:
			if w.Weekday < 0 || w.Weekday > 6 {
				return ErrInvalidInput
			}
		case booking.RecurrenceMonthly:
			if w.DayOfMonth < 1 || w.DayOfMonth > 31 {
				return ErrInvalidInput
			}
		case booking.RecurrenceDaily, booking.RecurrenceOngoing:
			// Every day: weekday/day_of_month are ignored.
		default:
			return ErrInvalidInput
		}
	}
	if windowsOverlap(windows) {
		return ErrInvalidInput
	}

	out := make([]ports.AvailabilityWindow, 0, len(windows))
	for _, w := range windows {
		out = append(out, ports.AvailabilityWindow{
			WindowID:    s.ids.NewID(),
			Weekday:     w.Weekday,
			StartMinute: w.StartMinute,
			EndMinute:   w.EndMinute,
			SlotMinutes: w.SlotMinutes,
			Recurrence:  w.Recurrence,
			DayOfMonth:  w.DayOfMonth,
		})
	}
	return s.availability.ReplaceWindows(ctx, command.Scope, out)
}

func authorizeAvailabilityManagement(role business.UserRole) error {
	if role == business.UserRoleOwner || role == business.UserRoleAdmin {
		return nil
	}
	return authdomain.ErrForbidden
}

func windowsOverlap(windows []WindowInput) bool {
	sorted := append([]WindowInput(nil), windows...)
	sort.Slice(sorted, func(i, j int) bool {
		ki, kj := windowDayKey(sorted[i]), windowDayKey(sorted[j])
		if ki != kj {
			return ki < kj
		}
		return sorted[i].StartMinute < sorted[j].StartMinute
	})
	for i := 1; i < len(sorted); i++ {
		if windowDayKey(sorted[i]) == windowDayKey(sorted[i-1]) && sorted[i].StartMinute < sorted[i-1].EndMinute {
			return true
		}
	}
	return false
}

// windowDayKey buckets windows by the set of calendar days they occupy, so
// overlap is only checked between windows that can actually collide: weekly
// windows share a bucket per weekday, monthly windows per day-of-month, and
// daily/ongoing windows share one "every day" bucket.
func windowDayKey(w WindowInput) string {
	switch w.Recurrence {
	case booking.RecurrenceMonthly:
		return "m" + strconv.Itoa(w.DayOfMonth)
	case booking.RecurrenceDaily, booking.RecurrenceOngoing:
		return "every"
	default: // weekly (and empty)
		return "w" + strconv.Itoa(w.Weekday)
	}
}

// ListWindows returns the business's configured windows for its own dashboard.
func (s Service) ListWindows(ctx context.Context, scope common.TenantScope) ([]booking.Window, error) {
	windows, _, err := s.availability.ListWindows(ctx, scope)
	return windows, err
}

// ListStoreAvailability resolves a public store by handle and returns its open
// home-visit slots in [from, to).
func (s Service) ListStoreAvailability(ctx context.Context, handle string, from, to time.Time) ([]booking.Slot, error) {
	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(handle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return nil, ErrStoreNotFound
		}
		return nil, err
	}
	return s.openSlots(ctx, common.TenantScope{BusinessID: store.BusinessID}, from, to)
}

// ResolveOpenSlot validates that slotStart is currently an offerable open slot
// for the business and returns it (with its end), for the booking checkout.
func (s Service) ResolveOpenSlot(ctx context.Context, scope common.TenantScope, slotStart time.Time) (booking.Slot, error) {
	windows, _, err := s.availability.ListWindows(ctx, scope)
	if err != nil {
		return booking.Slot{}, err
	}
	if len(windows) == 0 {
		return booking.Slot{}, ports.ErrNoAvailability
	}
	open, err := s.openSlots(ctx, scope, slotStart, slotStart.Add(24*time.Hour))
	if err != nil {
		return booking.Slot{}, err
	}
	for _, slot := range open {
		if slot.Start.Equal(slotStart) {
			return slot, nil
		}
	}
	return booking.Slot{}, ports.ErrSlotTaken
}

func (s Service) openSlots(ctx context.Context, scope common.TenantScope, from, to time.Time) ([]booking.Slot, error) {
	windows, timezone, err := s.availability.ListWindows(ctx, scope)
	if err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	candidate := booking.EnumerateSlots(windows, from, to, s.now(), booking.DefaultLeadMinutes, loc)

	taken, err := s.availability.ListTakenSlots(ctx, scope, from, to)
	if err != nil {
		return nil, err
	}
	takenAt := make(map[int64]bool, len(taken))
	for _, slot := range taken {
		takenAt[slot.UTC().Unix()] = true
	}

	open := make([]booking.Slot, 0, len(candidate))
	for _, slot := range candidate {
		if !takenAt[slot.Start.Unix()] {
			open = append(open, slot)
		}
	}
	return open, nil
}
