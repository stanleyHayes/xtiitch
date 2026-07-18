import type { AvailabilitySlot } from "../../../src/api";

// Slot grouping + formatting for the home-visit picker. Ghana keeps UTC+0 all
// year (no DST), so plain UTC date math lands on the same civil days the web
// storefront computes with timeZone: "Africa/Accra" (visit-slot-utils.ts) —
// without depending on Hermes ICU timezone data.

export type VisitSlotGroup = {
  key: string; // "YYYY-MM-DD"
  label: string; // "Sat, 19 Jul"
  caption: string; // "Saturday"
  slots: AvailabilitySlot[];
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// The web loader asks for a 28-day window; the API clamps to the same maximum.
export function availabilityRangeForRequest(): { from: string; to: string } {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 28);
  return { from: from.toISOString(), to: to.toISOString() };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function dayLabel(date: Date): string {
  return `${WEEKDAY_SHORT[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}

function formatTime(date: Date): string {
  const hours = date.getUTCHours();
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${pad(date.getUTCMinutes())} ${suffix}`;
}

export function formatVisitTime(slot: AvailabilitySlot): string {
  const start = new Date(slot.slot_start);
  const end = new Date(slot.slot_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return slot.slot_start;
  }
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatVisitSlot(slot: AvailabilitySlot): string {
  const start = new Date(slot.slot_start);
  if (Number.isNaN(start.getTime())) {
    return slot.slot_start;
  }
  return `${dayLabel(start)}, ${formatVisitTime(slot)}`;
}

export function groupVisitSlots(slots: AvailabilitySlot[]): VisitSlotGroup[] {
  const groups = new Map<string, VisitSlotGroup>();
  [...slots]
    .sort(
      (a, b) =>
        new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime(),
    )
    .forEach((slot) => {
      const start = new Date(slot.slot_start);
      if (Number.isNaN(start.getTime())) {
        return;
      }
      const key = dayKey(start);
      const existing = groups.get(key);
      if (existing) {
        existing.slots.push(slot);
        return;
      }
      groups.set(key, {
        key,
        label: dayLabel(start),
        caption: WEEKDAY_LONG[start.getUTCDay()],
        slots: [slot],
      });
    });
  return [...groups.values()];
}
