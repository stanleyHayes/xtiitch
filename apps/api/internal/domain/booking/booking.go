// Package booking models home-visit appointments: a business's recurring
// availability and the lifecycle of a booked slot (Technical Specification 4.12).
package booking

import "time"

type Status string

const (
	StatusHeld        Status = "held"
	StatusBooked      Status = "booked"
	StatusCompleted   Status = "completed"
	StatusCancelled   Status = "cancelled"
	StatusRescheduled Status = "rescheduled"
)

func (s Status) Valid() bool {
	switch s {
	case StatusHeld, StatusBooked, StatusCompleted, StatusCancelled, StatusRescheduled:
		return true
	default:
		return false
	}
}

// Engineering decisions the spec leaves open, centralised so they are easy to
// tune: the default slot length, how far ahead a slot must be to be offerable,
// and how long an unpaid hold survives before it is swept.
const (
	DefaultSlotMinutes = 60
	DefaultLeadMinutes = 120
	HoldTTLMinutes     = 30
)

// Window is a business's recurring weekly availability: on Weekday, from
// StartMinute to EndMinute (minutes from midnight, business-local), split into
// SlotMinutes-long slots.
type Window struct {
	Weekday     int
	StartMinute int
	EndMinute   int
	SlotMinutes int
}

// Slot is one bookable appointment range, in UTC.
type Slot struct {
	Start time.Time
	End   time.Time
}

// EnumerateSlots derives the bookable slots in [from, to) from a business's
// recurring windows, interpreting weekday and minute-of-day in loc (the business
// timezone) and dropping any slot earlier than now + leadMinutes. It is a pure
// function: callers subtract already-held/booked slots separately. Ghana sits at
// UTC+0 with no DST today, so loc is effectively UTC, but it is threaded so a
// different timezone never silently breaks slot times.
func EnumerateSlots(windows []Window, from, to, now time.Time, leadMinutes int, loc *time.Location) []Slot {
	if loc == nil {
		loc = time.UTC
	}
	earliest := now.Add(time.Duration(leadMinutes) * time.Minute)

	localFrom := from.In(loc)
	day := time.Date(localFrom.Year(), localFrom.Month(), localFrom.Day(), 0, 0, 0, 0, loc)

	var slots []Slot
	for ; day.Before(to); day = day.AddDate(0, 0, 1) {
		weekday := int(day.Weekday())
		for _, window := range windows {
			if window.Weekday != weekday || window.SlotMinutes <= 0 {
				continue
			}
			for minute := window.StartMinute; minute+window.SlotMinutes <= window.EndMinute; minute += window.SlotMinutes {
				start := day.Add(time.Duration(minute) * time.Minute)
				if start.Before(from) || !start.Before(to) || start.Before(earliest) {
					continue
				}
				slots = append(slots, Slot{
					Start: start.UTC(),
					End:   start.Add(time.Duration(window.SlotMinutes) * time.Minute).UTC(),
				})
			}
		}
	}
	return slots
}
