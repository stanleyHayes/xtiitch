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

export type StoreFeatureSwitch = {
  name: string;
  label: string;
  helper: string;
  checked: boolean;
};

// The storefront request-path toggles rendered by StoreSettingsPanel. Kept here
// (rather than inline) so the panel component stays within its line budget.
export function storeFeatureSwitches(
  settings: StoreSettings,
): StoreFeatureSwitch[] {
  return [
    {
      name: "bespoke_enabled",
      label: "Bespoke orders",
      helper: "Let customers request custom work from eligible designs.",
      checked: settings.bespoke_enabled,
    },
    {
      name: "measurements_enabled",
      label: "Measurements",
      helper: "Show measurement-led ordering and fitting flows.",
      checked: settings.measurements_enabled,
    },
    {
      name: "customisation_enabled",
      label: "Customisation",
      helper: "Allow customers to ask for alterations to catalogue pieces.",
      checked: settings.customisation_enabled,
    },
    {
      name: "collections_enabled",
      label: "Collections",
      helper: "Organise designs into public storefront collections.",
      checked: settings.collections_enabled,
    },
    {
      name: "delivery_enabled",
      label: "Delivery",
      helper: "Show delivery as a fulfilment option where available.",
      checked: settings.delivery_enabled,
    },
    {
      name: "dispatch_enabled",
      label: "Dispatch desk",
      helper: "Let the team manage pickup and delivery handovers.",
      checked: settings.dispatch_enabled,
    },
    // §4.4: the three pass-down controls. Ticked, the fee is added to the
    // customer's checkout; unticked (the default), it comes out of the store's
    // share. At checkout the Xtiitch fee and the Paystack fee appear as ONE
    // combined "Transaction fee" line; the tax is always its own line (§4.5).
    {
      name: "fee_pass_xtiitch_fee",
      label: "Pass down the Xtiitch fee",
      helper:
        "Ticked: added to the customer's checkout inside the combined “Transaction fee” line. Unticked: deducted from your share.",
      checked: settings.fee_pass_xtiitch_fee,
    },
    {
      name: "fee_pass_tax",
      label: "Pass down the Tax (VAT)",
      helper:
        "Ticked: shown as its own Tax (VAT) line on the customer's checkout. Unticked: deducted from your share.",
      checked: settings.fee_pass_tax,
    },
    {
      name: "fee_pass_paystack_fee",
      label: "Pass down the Transaction fee (Paystack)",
      helper:
        "Ticked: added to the customer's checkout inside the combined “Transaction fee” line. Unticked: borne by your share.",
      checked: settings.fee_pass_paystack_fee,
    },
  ];
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
