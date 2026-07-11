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

// Recurrence controls which calendar days a Window repeats on. 'weekly' is the
// original (and default) behaviour; 'daily' and 'ongoing' match every day (the
// 'ongoing' label just means "no planned end" for the owner); 'monthly' matches
// a single day-of-month; 'date' matches exactly one calendar date (SpecificDate)
// so an owner can open hours for a single day.
const (
	RecurrenceDaily   = "daily"
	RecurrenceWeekly  = "weekly"
	RecurrenceMonthly = "monthly"
	RecurrenceOngoing = "ongoing"
	RecurrenceDate    = "date"
)

// Window is a business's recurring home-visit availability: from StartMinute to
// EndMinute (minutes from midnight, business-local), split into SlotMinutes-long
// slots, repeating on the days selected by Recurrence. For 'weekly' the day is
// Weekday (0-6); for 'monthly' it is DayOfMonth (1-31); 'daily'/'ongoing' repeat
// every day and ignore both; 'date' matches only SpecificDate. An empty
// Recurrence is treated as 'weekly' so rows predating recurrence support keep
// their original behaviour.
type Window struct {
	Weekday      int
	StartMinute  int
	EndMinute    int
	SlotMinutes  int
	Recurrence   string
	DayOfMonth   int       // 0 = unset; only meaningful for 'monthly'
	SpecificDate time.Time // zero = unset; only meaningful for 'date'
}

// matchesDay reports whether the window is active on the given business-local
// day, per its recurrence.
func (w Window) matchesDay(day time.Time) bool {
	switch w.Recurrence {
	case RecurrenceDaily, RecurrenceOngoing:
		return true
	case RecurrenceMonthly:
		return day.Day() == w.DayOfMonth
	case RecurrenceDate:
		return sameCalendarDay(day, w.SpecificDate)
	default: // weekly (and empty, for backward compatibility)
		return int(day.Weekday()) == w.Weekday
	}
}

// sameCalendarDay compares two times by their calendar date only, ignoring the
// clock time and location. SpecificDate comes from a DATE column (UTC midnight)
// while day is business-local midnight, so a component-wise compare is correct.
func sameCalendarDay(a, b time.Time) bool {
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
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
//
//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func EnumerateSlots(windows []Window, from, to, now time.Time, leadMinutes int, loc *time.Location) []Slot {
	if loc == nil {
		loc = time.UTC
	}
	earliest := now.Add(time.Duration(leadMinutes) * time.Minute)

	localFrom := from.In(loc)
	day := time.Date(localFrom.Year(), localFrom.Month(), localFrom.Day(), 0, 0, 0, 0, loc)

	var slots []Slot
	for ; day.Before(to); day = day.AddDate(0, 0, 1) {
		for _, window := range windows {
			if window.SlotMinutes <= 0 || !window.matchesDay(day) {
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
