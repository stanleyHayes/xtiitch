package availabilityapp

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/booking"
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
