import type { SizeChartItem } from "../types";

export function parseSequence(value: FormDataEntryValue | null): number | null {
  const sequence = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(sequence) && sequence >= 0 ? sequence : null;
}

export function parseSizeChartJSON(value: FormDataEntryValue | null): SizeChartItem[] {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => ({
        name: String(item?.name ?? "").trim(),
        value: String(item?.value ?? "").trim(),
        unit: String(item?.unit ?? "").trim(),
      }))
      .filter(
        (item) => item.name !== "" && item.value !== "" && item.unit !== "",
      );
  } catch {
    return [];
  }
}

export function parseOptionalPositiveInt(
  value: FormDataEntryValue | null,
): number | null | undefined {
  const entered = String(value ?? "").trim();
  if (!entered) {
    return null;
  }
  const parsed = Number.parseInt(entered, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseImageURLs(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}
