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
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeAvailRepo struct {
	windows []booking.Window
	taken   []time.Time
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

type fakeIDs struct{}

func (fakeIDs) NewID() common.ID { return "window-id" }

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

	taken := NewService(Dependencies{Availability: fakeAvailRepo{windows: windows, taken: []time.Time{slot10}}, Now: func() time.Time { return now }})
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
