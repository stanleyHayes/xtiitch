import { StoreSettings, AvailabilityWindow } from "../shared/types";
import { AVAILABILITY_RECURRENCES } from "../shared/constants";
import { parseTimeToMinutes } from "../shared/utils";

export function enabledStoreSettings(settings: StoreSettings): number {
  return [
    settings.bespoke_enabled,
    settings.measurements_enabled,
    settings.customisation_enabled,
    settings.collections_enabled,
    settings.delivery_enabled,
    settings.dispatch_enabled,
  ].filter(Boolean).length;
}

export function parseAvailabilityWindows(form: FormData): AvailabilityWindow[] | null { // eslint-disable-line complexity -- form-data mapper with many conditional branches; refactor in follow-up
  const recurrences = form.getAll("recurrence");
  const weekdays = form.getAll("weekday");
  const daysOfMonth = form.getAll("day_of_month");
  const specificDates = form.getAll("specific_date");
  const starts = form.getAll("start");
  const ends = form.getAll("end");
  const slots = form.getAll("slot_minutes");
  const rows = Math.max(
    recurrences.length,
    weekdays.length,
    daysOfMonth.length,
    specificDates.length,
    starts.length,
    ends.length,
    slots.length,
  );
  const windows: AvailabilityWindow[] = [];

  for (let index = 0; index < rows; index += 1) {
    const startValue = String(starts[index] ?? "").trim();
    const endValue = String(ends[index] ?? "").trim();
    const slotValue = String(slots[index] ?? "").trim();
    if (!startValue && !endValue) {
      continue;
    }
    const recurrence =
      String(recurrences[index] ?? "weekly").trim() || "weekly";
    const weekday = Number.parseInt(String(weekdays[index] ?? "").trim(), 10);
    const dayOfMonth = Number.parseInt(
      String(daysOfMonth[index] ?? "").trim(),
      10,
    );
    const specificDate = String(specificDates[index] ?? "").trim();
    const startMinute = parseTimeToMinutes(startValue);
    const endMinute = parseTimeToMinutes(endValue);
    const slotMinutes = Number.parseInt(slotValue, 10);
    if (
      !AVAILABILITY_RECURRENCES.includes(recurrence) ||
      startMinute === null ||
      endMinute === null ||
      endMinute <= startMinute ||
      !Number.isInteger(slotMinutes) ||
      slotMinutes < 15 ||
      slotMinutes > 480
    ) {
      return null;
    }
    // Weekly needs a valid weekday; monthly needs a day-of-month. Daily/ongoing
    // ignore both.
    if (
      recurrence === "weekly" &&
      (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)
    ) {
      return null;
    }
    if (
      recurrence === "monthly" &&
      (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)
    ) {
      return null;
    }
    // A one-off "date" window needs a valid ISO date (YYYY-MM-DD).
    if (recurrence === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(specificDate)) {
      return null;
    }
    const safeWeekday =
      Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 0;
    windows.push({
      weekday: safeWeekday,
      start_minute: startMinute,
      end_minute: endMinute,
      slot_minutes: slotMinutes,
      recurrence,
      day_of_month: recurrence === "monthly" ? dayOfMonth : null,
      specific_date: recurrence === "date" ? specificDate : undefined,
    });
  }

  return windows;
}

export function extractMeasurementValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("measurement_")) {
      continue;
    }
    const fieldID = key.slice("measurement_".length);
    const entered = String(value ?? "").trim();
    if (fieldID && entered) {
      values[fieldID] = entered;
    }
  }
  return values;
}
