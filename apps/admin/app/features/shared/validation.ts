

export function readBoolean(form: FormData, name: string): boolean {
  return form
    .getAll(name)
    .map((value) => String(value))
    .includes("true");
}



export function readNumber(
  value: FormDataEntryValue | null,
  fallback: number,
): number {
  const parsed = Number(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}



export function readInt(value: FormDataEntryValue | null, fallback: number): number {
  return Math.trunc(readNumber(value, fallback));
}



export function readOptionalText(
  value: FormDataEntryValue | null,
): string | undefined {
  const raw = String(value ?? "").trim();
  return raw || undefined;
}



export function readOptionalInteger(
  value: FormDataEntryValue | null,
): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}



export function readGhsPesewas(value: FormDataEntryValue | null): number {
  return Math.round(readNumber(value, 0) * 100);
}



export function readOptionalGhsPesewas(
  value: FormDataEntryValue | null,
): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }
  return Math.round(readNumber(value, 0) * 100);
}



export function readOptionalDateTime(
  value: FormDataEntryValue | null,
): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}



export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}



export function ghanaPhoneDigits(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length === 10 && digits.startsWith("0")) {
    return `233${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `233${digits}`;
  }
  return digits;
}



export function moneyInputDefault(value?: number): string {
  return typeof value === "number" ? (value / 100).toFixed(2) : "";
}
