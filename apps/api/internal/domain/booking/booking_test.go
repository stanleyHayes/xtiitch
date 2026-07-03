package booking

import (
	"testing"
	"time"
)

func TestStatusValid(t *testing.T) {
	t.Parallel()
	for _, s := range []Status{StatusHeld, StatusBooked, StatusCompleted, StatusCancelled, StatusRescheduled} {
		if !s.Valid() {
			t.Fatalf("%q should be valid", s)
		}
	}
	if Status("pending").Valid() {
		t.Fatal("unknown status should be invalid")
	}
}

func TestEnumerateSlots(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)
	from := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 0, 1)
	weekday := int(from.Weekday())
	// 09:00–11:00 in one-hour slots on the from-day's weekday.
	windows := []Window{{Weekday: weekday, StartMinute: 540, EndMinute: 660, SlotMinutes: 60}}

	// No lead time: both the 09:00 and 10:00 slots are offerable.
	all := EnumerateSlots(windows, from, to, now, 0, time.UTC)
	if len(all) != 2 {
		t.Fatalf("expected 2 slots without lead time, got %d: %+v", len(all), all)
	}
	if !all[0].Start.Equal(time.Date(2026, 6, 15, 9, 0, 0, 0, time.UTC)) ||
		!all[0].End.Equal(time.Date(2026, 6, 15, 10, 0, 0, 0, time.UTC)) {
		t.Fatalf("unexpected first slot: %+v", all[0])
	}

	// Lead time of 120 min (now 08:00 -> earliest 10:00) drops the 09:00 slot.
	led := EnumerateSlots(windows, from, to, now, 120, time.UTC)
	if len(led) != 1 || !led[0].Start.Equal(time.Date(2026, 6, 15, 10, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected only the 10:00 slot with a 2h lead, got %+v", led)
	}

	// Half-hour slots subdivide the window into four.
	half := EnumerateSlots([]Window{{Weekday: weekday, StartMinute: 540, EndMinute: 660, SlotMinutes: 30}}, from, to, now, 0, time.UTC)
	if len(half) != 4 {
		t.Fatalf("expected 4 half-hour slots, got %d", len(half))
	}

	// A window on a different weekday yields nothing in this one-day range.
	other := EnumerateSlots([]Window{{Weekday: (weekday + 1) % 7, StartMinute: 540, EndMinute: 660, SlotMinutes: 60}}, from, to, now, 0, time.UTC)
	if len(other) != 0 {
		t.Fatalf("expected no slots for a different weekday, got %d", len(other))
	}

	if got := EnumerateSlots(nil, from, to, now, 0, time.UTC); len(got) != 0 {
		t.Fatalf("expected no slots with no windows, got %d", len(got))
	}
}

func TestEnumerateSlotsDaily(t *testing.T) {
	t.Parallel()

	from := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	now := from
	to := from.AddDate(0, 0, 3) // three-day range: 15th, 16th, 17th

	// A 'daily' window matches every day regardless of weekday/day_of_month.
	windows := []Window{{
		Recurrence:  RecurrenceDaily,
		StartMinute: 540, // 09:00–11:00 in one-hour slots
		EndMinute:   660,
		SlotMinutes: 60,
	}}

	slots := EnumerateSlots(windows, from, to, now, 0, time.UTC)
	if len(slots) != 6 {
		t.Fatalf("expected 6 daily slots (2/day over 3 days), got %d: %+v", len(slots), slots)
	}
	for i, day := range []int{15, 15, 16, 16, 17, 17} {
		if slots[i].Start.Day() != day {
			t.Fatalf("slot %d expected on the %dth, got %s", i, day, slots[i].Start)
		}
	}

	// 'ongoing' behaves identically to 'daily' for enumeration.
	ongoing := EnumerateSlots([]Window{{
		Recurrence:  RecurrenceOngoing,
		StartMinute: 540,
		EndMinute:   660,
		SlotMinutes: 60,
	}}, from, to, now, 0, time.UTC)
	if len(ongoing) != 6 {
		t.Fatalf("expected 6 ongoing slots (2/day over 3 days), got %d", len(ongoing))
	}
}

func TestEnumerateSlotsMonthly(t *testing.T) {
	t.Parallel()

	from := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	now := from
	to := from.AddDate(0, 0, 5) // 15th..19th inclusive of days scanned

	// A 'monthly' window matches only on its day-of-month (the 17th here).
	windows := []Window{{
		Recurrence:  RecurrenceMonthly,
		DayOfMonth:  17,
		Weekday:     0, // ignored for monthly
		StartMinute: 540,
		EndMinute:   660,
		SlotMinutes: 60,
	}}

	slots := EnumerateSlots(windows, from, to, now, 0, time.UTC)
	if len(slots) != 2 {
		t.Fatalf("expected 2 slots only on the matching day-of-month, got %d: %+v", len(slots), slots)
	}
	for _, slot := range slots {
		if slot.Start.Day() != 17 {
			t.Fatalf("monthly slot should fall on the 17th, got %s", slot.Start)
		}
	}

	// No match in a range that excludes the 17th.
	early := EnumerateSlots(windows, from, from.AddDate(0, 0, 2), now, 0, time.UTC)
	if len(early) != 0 {
		t.Fatalf("expected no monthly slots before the matching day, got %d", len(early))
	}
}
