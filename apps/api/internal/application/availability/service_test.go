package availabilityapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeAvailRepo struct {
	windows   []booking.Window
	taken     []time.Time
	blackouts []time.Time
}

func (r fakeAvailRepo) ReplaceWindows(context.Context, common.TenantScope, []ports.AvailabilityWindow) error {
	return nil
}

func (r fakeAvailRepo) ListWindows(context.Context, common.TenantScope) ([]booking.Window, string, error) {
	return r.windows, "UTC", nil
}

func (r fakeAvailRepo) ListTakenSlots(context.Context, common.TenantScope, time.Time, time.Time) ([]time.Time, error) {
	return r.taken, nil
}

func (r fakeAvailRepo) ListBlackouts(context.Context, common.TenantScope, time.Time, time.Time) ([]time.Time, error) {
	return r.blackouts, nil
}

func (fakeAvailRepo) AddBlackout(context.Context, common.TenantScope, time.Time) error    { return nil }
func (fakeAvailRepo) RemoveBlackout(context.Context, common.TenantScope, time.Time) error { return nil }

type fakeIDs struct{}

func (fakeIDs) NewID() common.ID { return "window-id" }

type fakeStorefrontRepo struct {
	store ports.Storefront
	err   error
}

func (r fakeStorefrontRepo) ResolveStore(context.Context, string) (ports.Storefront, error) {
	if r.err != nil {
		return ports.Storefront{}, r.err
	}
	return r.store, nil
}

func (fakeStorefrontRepo) ListActiveDesigns(context.Context, common.ID) ([]ports.StorefrontDesign, error) {
	return nil, nil
}

func (fakeStorefrontRepo) GetActiveDesignByHandle(context.Context, string) (ports.StorefrontDesign, error) {
	return ports.StorefrontDesign{}, nil
}

func (fakeStorefrontRepo) ListActiveCollections(context.Context, common.ID) ([]catalogue.Collection, error) {
	return nil, nil
}

func (fakeStorefrontRepo) GetActiveCollectionByHandle(context.Context, string) (ports.StorefrontCollection, error) {
	return ports.StorefrontCollection{}, nil
}

func (fakeStorefrontRepo) SearchActiveDesigns(context.Context, common.ID, string) ([]ports.StorefrontDesign, error) {
	return nil, nil
}

func (fakeStorefrontRepo) ListPublicShops(context.Context) ([]ports.PublicShop, error) {
	return nil, nil
}

func TestDefineAvailabilityRejectsOverlap(t *testing.T) {
	t.Parallel()

	svc := NewService(Dependencies{Availability: fakeAvailRepo{}, IDs: fakeIDs{}})
	scope := common.TenantScope{BusinessID: "b1"}

	// Two windows on the same weekday that overlap (09:00–11:00 and 10:00–12:00).
	if err := svc.DefineAvailability(context.Background(), DefineAvailabilityCommand{
		Scope:     scope,
		ActorRole: business.UserRoleOwner,
		Windows: []WindowInput{
			{Weekday: 2, StartMinute: 540, EndMinute: 660, SlotMinutes: 60},
			{Weekday: 2, StartMinute: 600, EndMinute: 720, SlotMinutes: 30},
		},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected overlapping windows rejected, got %v", err)
	}

	// Adjacent (non-overlapping) windows on the same weekday are allowed.
	if err := svc.DefineAvailability(context.Background(), DefineAvailabilityCommand{
		Scope:     scope,
		ActorRole: business.UserRoleAdmin,
		Windows: []WindowInput{
			{Weekday: 2, StartMinute: 540, EndMinute: 600, SlotMinutes: 60},
			{Weekday: 2, StartMinute: 600, EndMinute: 720, SlotMinutes: 60},
		},
	}); err != nil {
		t.Fatalf("adjacent windows should be allowed, got %v", err)
	}

	// An invalid window (end <= start) is rejected.
	if err := svc.DefineAvailability(context.Background(), DefineAvailabilityCommand{
		Scope:     scope,
		ActorRole: business.UserRoleOwner,
		Windows: []WindowInput{
			{Weekday: 1, StartMinute: 600, EndMinute: 600, SlotMinutes: 60},
		},
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid window rejected, got %v", err)
	}
}

func TestDefineAvailabilityRecurrenceValidation(t *testing.T) {
	t.Parallel()

	svc := NewService(Dependencies{Availability: fakeAvailRepo{}, IDs: fakeIDs{}})
	scope := common.TenantScope{BusinessID: "b1"}

	define := func(w WindowInput) error {
		return svc.DefineAvailability(context.Background(), DefineAvailabilityCommand{
			Scope:     scope,
			ActorRole: business.UserRoleOwner,
			Windows:   []WindowInput{w},
		})
	}

	// 'daily' and 'ongoing' ignore weekday/day_of_month and are accepted.
	if err := define(WindowInput{Recurrence: "daily", StartMinute: 540, EndMinute: 660, SlotMinutes: 60}); err != nil {
		t.Fatalf("daily window should be accepted, got %v", err)
	}
	if err := define(WindowInput{Recurrence: "ongoing", StartMinute: 540, EndMinute: 660, SlotMinutes: 60}); err != nil {
		t.Fatalf("ongoing window should be accepted, got %v", err)
	}

	// Empty recurrence defaults to weekly and still validates the weekday.
	if err := define(WindowInput{Weekday: 3, StartMinute: 540, EndMinute: 660, SlotMinutes: 60}); err != nil {
		t.Fatalf("empty recurrence should default to weekly and be accepted, got %v", err)
	}

	// 'monthly' requires day_of_month 1-31.
	if err := define(WindowInput{Recurrence: "monthly", DayOfMonth: 17, StartMinute: 540, EndMinute: 660, SlotMinutes: 60}); err != nil {
		t.Fatalf("monthly window with valid day_of_month should be accepted, got %v", err)
	}
	if err := define(WindowInput{
		Recurrence: "monthly", DayOfMonth: 0, StartMinute: 540, EndMinute: 660, SlotMinutes: 60,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("monthly window without day_of_month should be rejected, got %v", err)
	}
	if err := define(WindowInput{
		Recurrence: "monthly", DayOfMonth: 32, StartMinute: 540, EndMinute: 660, SlotMinutes: 60,
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("monthly window with out-of-range day_of_month should be rejected, got %v", err)
	}

	// An unknown recurrence value is rejected.
	if err := define(WindowInput{Recurrence: "yearly", StartMinute: 540, EndMinute: 660, SlotMinutes: 60}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("unknown recurrence should be rejected, got %v", err)
	}

	// 'date' requires a specific date; without one it is rejected.
	if err := define(WindowInput{Recurrence: "date", StartMinute: 540, EndMinute: 660, SlotMinutes: 60}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("date window without specific_date should be rejected, got %v", err)
	}
	if err := define(WindowInput{
		Recurrence:   "date",
		SpecificDate: time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC),
		StartMinute:  540, EndMinute: 660, SlotMinutes: 60,
	}); err != nil {
		t.Fatalf("date window with specific_date should be accepted, got %v", err)
	}
}

func TestListStoreAvailabilityDateWindowOnlyOnItsDate(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	scope := common.TenantScope{BusinessID: "b1"}
	now := time.Date(2026, 7, 1, 6, 0, 0, 0, time.UTC)
	target := time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC)
	windows := []booking.Window{{
		Recurrence:   booking.RecurrenceDate,
		SpecificDate: target,
		StartMinute:  9 * 60,
		EndMinute:    11 * 60,
		SlotMinutes:  60,
	}}
	svc := NewService(Dependencies{
		Availability: fakeAvailRepo{windows: windows},
		Storefront:   fakeStorefrontRepo{store: ports.Storefront{BusinessID: scope.BusinessID}},
		Now:          func() time.Time { return now },
	})

	slots, err := svc.ListStoreAvailability(ctx, "shop", now, now.AddDate(0, 0, 15))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slots) != 2 {
		t.Fatalf("expected two slots on the single target date, got %d: %+v", len(slots), slots)
	}
	for _, slot := range slots {
		if slot.Start.Year() != 2026 || slot.Start.Month() != 7 || slot.Start.Day() != 3 {
			t.Fatalf("date window produced a slot off its date: %s", slot.Start)
		}
	}
}

func TestListStoreAvailabilityBlackoutRemovesADay(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	scope := common.TenantScope{BusinessID: "b1"}
	now := time.Date(2026, 7, 1, 6, 0, 0, 0, time.UTC)
	firstWednesday := time.Date(2026, 7, 1, 9, 0, 0, 0, time.UTC)
	windows := []booking.Window{{
		Weekday:     int(firstWednesday.Weekday()),
		StartMinute: 9 * 60,
		EndMinute:   11 * 60,
		SlotMinutes: 60,
	}}

	// Without a blackout: three Wednesdays in the 15-day window (Jul 1, 8, 15),
	// two slots each.
	open := NewService(Dependencies{
		Availability: fakeAvailRepo{windows: windows},
		Storefront:   fakeStorefrontRepo{store: ports.Storefront{BusinessID: scope.BusinessID}},
		Now:          func() time.Time { return now },
	})
	base, err := open.ListStoreAvailability(ctx, "shop", now, now.AddDate(0, 0, 15))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(base) != 6 {
		t.Fatalf("expected six recurring slots across three Wednesdays, got %d", len(base))
	}

	// Blacking out the first Wednesday removes both of its slots.
	blocked := NewService(Dependencies{
		Availability: fakeAvailRepo{windows: windows, blackouts: []time.Time{
			time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		}},
		Storefront: fakeStorefrontRepo{store: ports.Storefront{BusinessID: scope.BusinessID}},
		Now:        func() time.Time { return now },
	})
	slots, err := blocked.ListStoreAvailability(ctx, "shop", now, now.AddDate(0, 0, 15))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slots) != 4 {
		t.Fatalf("expected four slots after blacking out one Wednesday, got %d: %+v", len(slots), slots)
	}
	for _, slot := range slots {
		if slot.Start.Day() == 1 {
			t.Fatalf("blacked-out day still produced a slot: %s", slot.Start)
		}
	}
}

func TestDefineAvailabilityRequiresOwnerOrAdmin(t *testing.T) {
	t.Parallel()

	svc := NewService(Dependencies{Availability: fakeAvailRepo{}, IDs: fakeIDs{}})
	scope := common.TenantScope{BusinessID: "b1"}

	err := svc.DefineAvailability(context.Background(), DefineAvailabilityCommand{
		Scope:     scope,
		ActorRole: business.UserRoleStaff,
		Windows: []WindowInput{
			{Weekday: 2, StartMinute: 540, EndMinute: 660, SlotMinutes: 60},
		},
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("expected staff to be forbidden from defining availability, got %v", err)
	}
}

func TestResolveOpenSlot(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	scope := common.TenantScope{BusinessID: "b1"}
	now := time.Date(2026, 7, 1, 6, 0, 0, 0, time.UTC) // lead 120m -> earliest 08:00
	slot10 := time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)
	weekday := int(slot10.Weekday())
	windows := []booking.Window{{Weekday: weekday, StartMinute: 540, EndMinute: 660, SlotMinutes: 60}}

	open := NewService(Dependencies{Availability: fakeAvailRepo{windows: windows}, Now: func() time.Time { return now }})
	slot, err := open.ResolveOpenSlot(ctx, scope, slot10)
	if err != nil || !slot.Start.Equal(slot10) || !slot.End.Equal(slot10.Add(time.Hour)) {
		t.Fatalf("expected the 10:00 slot to resolve, got %+v err=%v", slot, err)
	}

	taken := NewService(Dependencies{
		Availability: fakeAvailRepo{windows: windows, taken: []time.Time{slot10}},
		Now:          func() time.Time { return now },
	})
	if _, err := taken.ResolveOpenSlot(ctx, scope, slot10); !errors.Is(err, ports.ErrSlotTaken) {
		t.Fatalf("a taken slot should resolve to ErrSlotTaken, got %v", err)
	}

	empty := NewService(Dependencies{Availability: fakeAvailRepo{}, Now: func() time.Time { return now }})
	if _, err := empty.ResolveOpenSlot(ctx, scope, slot10); !errors.Is(err, ports.ErrNoAvailability) {
		t.Fatalf("no windows should resolve to ErrNoAvailability, got %v", err)
	}

	// A slot inside the lead window (now 09:30 -> earliest 11:30) is not offerable.
	soon := NewService(Dependencies{Availability: fakeAvailRepo{windows: windows}, Now: func() time.Time {
		return time.Date(2026, 7, 1, 9, 30, 0, 0, time.UTC)
	}})
	if _, err := soon.ResolveOpenSlot(ctx, scope, slot10); !errors.Is(err, ports.ErrSlotTaken) {
		t.Fatalf("a slot inside the lead window should not resolve, got %v", err)
	}
}

func TestListStoreAvailabilityReturnsRecurringOpenSlots(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	scope := common.TenantScope{BusinessID: "b1"}
	now := time.Date(2026, 7, 1, 6, 0, 0, 0, time.UTC)
	firstWednesday := time.Date(2026, 7, 1, 9, 0, 0, 0, time.UTC)
	secondWednesday := firstWednesday.AddDate(0, 0, 7)
	windows := []booking.Window{{
		Weekday:     int(firstWednesday.Weekday()),
		StartMinute: 9 * 60,
		EndMinute:   11 * 60,
		SlotMinutes: 60,
	}}
	svc := NewService(Dependencies{
		Availability: fakeAvailRepo{windows: windows, taken: []time.Time{secondWednesday}},
		Storefront:   fakeStorefrontRepo{store: ports.Storefront{BusinessID: scope.BusinessID}},
		Now:          func() time.Time { return now },
	})

	slots, err := svc.ListStoreAvailability(ctx, "shop", now, now.AddDate(0, 0, 15))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slots) != 5 {
		t.Fatalf("expected five open recurring slots after one taken slot is removed, got %d: %+v", len(slots), slots)
	}
	if !slots[0].Start.Equal(firstWednesday) || !slots[1].Start.Equal(firstWednesday.Add(time.Hour)) {
		t.Fatalf("first week's slots were not enumerated correctly: %+v", slots[:2])
	}
	for _, slot := range slots {
		if slot.Start.Equal(secondWednesday) {
			t.Fatalf("taken recurring slot %s should not be returned: %+v", secondWednesday, slots)
		}
	}
}
