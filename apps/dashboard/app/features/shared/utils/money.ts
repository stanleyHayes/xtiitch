export function parseMoneyMinor(value: FormDataEntryValue | null): number | null {
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

export function parsePercentBps(value: FormDataEntryValue | null): number | null {
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
