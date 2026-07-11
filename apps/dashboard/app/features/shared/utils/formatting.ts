import { periodOptions, dayMs } from "../constants";
import { isManagementSection, isStaffSection } from "../parsers";

export function uniqueDashboardWarnings(warnings: string[]): string[] {
  return [...new Set(warnings.filter(Boolean))];
}

export function safeDashboardReturn(value: string): string {
  if (value === "/dashboard" || value.startsWith("/dashboard?")) {
    return value;
  }

  if (value.startsWith("/dashboard/")) {
    const path = value.split(/[?#]/)[0] ?? "";
    const section = path.slice("/dashboard/".length);
    if (isManagementSection(section) || isStaffSection(section)) {
      return value;
    }
  }

  return "/dashboard/orders?orders=all";
}

export function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function shortDate(value: string): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function shortDateTime(value: string): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function datetimeLocalValue(value: string): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 16);
}

export function splitDateTimeInputValue(value = ""): {
  date: string;
  time: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) {
    const fallback = datetimeLocalValue(value);
    return fallback && fallback !== value
      ? splitDateTimeInputValue(fallback)
      : { date: "", time: "" };
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}

export function validCalendarDate(year: number, month: number, day: number): boolean {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function normaliseDateInput(value: string): string | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const year = Number.parseInt(iso[1] ?? "", 10);
    const month = Number.parseInt(iso[2] ?? "", 10);
    const day = Number.parseInt(iso[3] ?? "", 10);
    return validCalendarDate(year, month, day)
      ? `${iso[1]}-${iso[2]}-${iso[3]}`
      : null;
  }

  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!local) {
    return null;
  }
  const day = Number.parseInt(local[1] ?? "", 10);
  const month = Number.parseInt(local[2] ?? "", 10);
  const year = Number.parseInt(local[3] ?? "", 10);
  if (!validCalendarDate(year, month, day)) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normaliseTimeInput(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function composeDateTimeValue(dateValue: string, timeValue: string): string {
  const date = normaliseDateInput(dateValue);
  const time = normaliseTimeInput(timeValue);
  return date && time ? `${date}T${time}` : "";
}

export function splitDateParts(value: string): {
  year: string;
  month: string;
  day: string;
} {
  const normalised = normaliseDateInput(value);
  if (!normalised) {
    return { year: "", month: "", day: "" };
  }
  const [year = "", month = "", day = ""] = normalised.split("-");
  return { year, month, day };
}

export function splitTimeParts(value: string): {
  hour: string;
  minute: string;
  period: (typeof periodOptions)[number] | "";
} {
  const normalised = normaliseTimeInput(value);
  if (!normalised) {
    return { hour: "", minute: "", period: "" };
  }
  const [hourRaw = "0", minute = ""] = normalised.split(":");
  const hours = Number.parseInt(hourRaw, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return {
    hour: String(displayHour).padStart(2, "0"),
    minute,
    period,
  };
}

export function composeDateInputValue(
  year: string,
  month: string,
  day: string,
): string {
  return normaliseDateInput(`${year}-${month}-${day}`) ?? "";
}

export function composeTimeInputValue(
  hour: string,
  minute: string,
  period: string,
): string {
  if (!hour || !minute || !period) {
    return "";
  }
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  if (
    parsedHour < 1 ||
    parsedHour > 12 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return "";
  }
  const hours24 = period === "PM" ? (parsedHour % 12) + 12 : parsedHour % 12;
  return (
    normaliseTimeInput(
      `${String(hours24).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`,
    ) ?? ""
  );
}

export function dayOptionsFor(year: string, month: string): string[] {
  const parsedYear = Number.parseInt(year, 10);
  const parsedMonth = Number.parseInt(month, 10);
  const maxDay =
    Number.isInteger(parsedYear) &&
    Number.isInteger(parsedMonth) &&
    parsedMonth >= 1 &&
    parsedMonth <= 12
      ? new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate()
      : 31;
  return Array.from({ length: maxDay }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
}

export function yearOptionsFor(selectedYear: string): string[] {
  const current = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, index) =>
    String(current - 1 + index),
  );
  return selectedYear && !years.includes(selectedYear)
    ? [...years, selectedYear].sort((a, b) => Number(a) - Number(b))
    : years;
}

export function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

export function datetimeLocalToRFC3339(value: string): string | null {
  const entered = value.trim();
  if (!entered) {
    return null;
  }
  const withSeconds = entered.length === 16 ? `${entered}:00` : entered;
  const parsed = new Date(`${withSeconds}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function ageLabel(value: string, now = new Date()): string {
  const date = parseDate(value);
  if (!date) {
    return "Date missing";
  }
  const days = daysBetween(date, now);
  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "1 day";
  }
  return `${days} days`;
}

export function daysBetween(start: Date, end: Date): number {
  const startDay = startOfLocalDay(start);
  const endDay = startOfLocalDay(end);
  return Math.max(
    0,
    Math.floor((endDay.getTime() - startDay.getTime()) / dayMs),
  );
}

export function percentage(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return (value / total) * 100;
}

export function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}
