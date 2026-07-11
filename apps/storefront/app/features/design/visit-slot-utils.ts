import type { AvailabilitySlot } from "../../lib/api";

export function formatVisitSlot(slot: AvailabilitySlot): string {
  const start = new Date(slot.slot_start);
  const end = new Date(slot.slot_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return slot.slot_start;
  }
  const day = new Intl.DateTimeFormat("en-GH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Africa/Accra",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-GH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });
  return `${day}, ${time.format(start)} - ${time.format(end)}`;
}

export function formatVisitTime(slot: AvailabilitySlot): string {
  const start = new Date(slot.slot_start);
  const end = new Date(slot.slot_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return slot.slot_start;
  }
  const time = new Intl.DateTimeFormat("en-GH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });
  return `${time.format(start)} - ${time.format(end)}`;
}

export function visitDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Accra",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatVisitDay(date: Date): { label: string; caption: string } {
  return {
    label: new Intl.DateTimeFormat("en-GH", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "Africa/Accra",
    }).format(date),
    caption: new Intl.DateTimeFormat("en-GH", {
      weekday: "long",
      timeZone: "Africa/Accra",
    }).format(date),
  };
}

export type VisitSlotGroup = {
  key: string;
  label: string;
  caption: string;
  slots: AvailabilitySlot[];
};

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
      const key = visitDayKey(start);
      const existing = groups.get(key);
      if (existing) {
        existing.slots.push(slot);
        return;
      }
      const { label, caption } = formatVisitDay(start);
      groups.set(key, { key, label, caption, slots: [slot] });
    });
  return [...groups.values()];
}

export const VISIT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

// Splits an "Africa/Accra" day key ("YYYY-MM-DD") into civil-date parts.
// Month is 0-based to line up with Date's month indexing.
export function visitDayKeyParts(key: string): {
  year: number;
  month: number;
  day: number;
} {
  const parts = key.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return { year, month: month - 1, day };
}

export function makeVisitDayKey(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month + 1)}-${padDatePart(day)}`;
}

// A month index that flattens {year, month} into a single sortable number so
// prev/next paging is a simple increment.
export function visitMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function visitMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GH", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Accra",
  }).format(new Date(Date.UTC(year, month, 1, 12)));
}

// Builds the Sun-Sat week rows for a month using plain Date math. Ghana runs at
// UTC+0 with no DST, so noon-UTC anchors line up with the Accra day keys the
// loader slots are bucketed by. Padding cells are null.
export function buildVisitMonthWeeks(
  year: number,
  month: number,
): (string | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month, 1, 12)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let pad = 0; pad < firstWeekday; pad += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(makeVisitDayKey(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}
