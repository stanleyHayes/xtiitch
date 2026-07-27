// Date/time input helpers shared by the bookings and availability forms.
// Inputs are plain text (YYYY-MM-DD, HH:MM); parsing is strict so a typo like
// 2026-02-31 is rejected instead of rolling over.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (value: number) => String(value).padStart(2, "0");

// Parse a YYYY-MM-DD input into a local-midnight Date, or null when invalid.
export function parseDateInput(value: string): Date | null {
  const match = DATE_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

// Parse an HH:MM input into minutes from midnight, or null when invalid.
export function parseTimeInput(value: string): number | null {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Minutes from midnight → HH:MM.
export function minutesToHHMM(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

// Combine a parsed local-midnight date with minutes-from-midnight and render
// an RFC3339 timestamp carrying the device's local UTC offset.
export function toLocalRfc3339(date: Date, minutes: number): string {
  const combined = new Date(date);
  combined.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const offsetMinutes = -combined.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return (
    `${combined.getFullYear()}-${pad(combined.getMonth() + 1)}-${pad(combined.getDate())}` +
    `T${pad(combined.getHours())}:${pad(combined.getMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// HH:MM for an ISO slot timestamp (slot_start/slot_end).
export function slotTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
