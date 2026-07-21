export function parseMoneyMinor(
  value: FormDataEntryValue | null,
): number | null {
  const entered = String(value ?? "")
    .replaceAll(",", "")
    .trim();
  if (!entered) {
    return null;
  }
  const amount = Number.parseFloat(entered);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round(amount * 100);
}

// A bespoke deposit is never unset from the customer's perspective. The form
// may submit blank or zero (including an older saved design with no override),
// but both must persist the documented GHS 1 default.
export function parseDepositMinor(value: FormDataEntryValue | null): number {
  return parseMoneyMinor(value) ?? 100;
}

export function parseOptionalMoneyMinor(
  value: FormDataEntryValue | null,
): number | null {
  const entered = String(value ?? "")
    .replaceAll(",", "")
    .trim();
  if (!entered) {
    return 0;
  }
  const amount = Number.parseFloat(entered);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100);
}

export function parsePercentBps(
  value: FormDataEntryValue | null,
): number | null {
  const entered = String(value ?? "").trim();
  if (!entered) {
    return null;
  }
  const percent = Number.parseFloat(entered);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return null;
  }
  return Math.round(percent * 100);
}
