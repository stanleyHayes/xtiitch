import { tokens } from "../../theme";

const sixDigitHex = /^#[0-9a-f]{6}$/i;

// Public store colours originate in merchant settings, so keep every consumer
// on one validated value. Invalid or legacy values fall back to the Xtiitch
// accent instead of leaking into MUI's colour helpers.
export function resolveStoreBrand(value?: string): string {
  const candidate = value?.trim() ?? "";
  return sixDigitHex.test(candidate) ? candidate : tokens.burgundy;
}

export function readableBrandText(hex: string): string {
  const value = resolveStoreBrand(hex).slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? tokens.ink : tokens.white;
}
