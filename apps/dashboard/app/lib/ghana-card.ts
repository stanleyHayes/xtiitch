// §2.3: the Ghana Card number (ID PIN) is format-locked to GHA-XXXXXXXXX-X —
// "GHA-", 9 digits, "-", 1 digit — so the owner cannot enter arbitrary numbers
// or the wrong format. The field auto-formats as they type and the value is
// validated against the full pattern before submit.

export const GHANA_CARD_PATTERN = /^GHA-[0-9]{9}-[0-9]$/;

const GHANA_CARD_DIGITS = 10;

// Rebuild the typed/pasted value into the locked format. Anything the owner
// types — "gha1234567890", "GHA 123 456 789 0", a partial "GHA-123" — comes
// out as the canonical dashed, uppercased form (or as far as they have got).
export function formatGhanaCardNumber(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Drop a typed/pasted "GHA" prefix (or however much of it is there) — the
  // formatter owns the prefix so a caret can never strand a doubled "GHAGHA-".
  const afterPrefix = cleaned.replace(/^G(?:H(?:A)?)?/, "");
  const digits = afterPrefix.replace(/\D/g, "").slice(0, GHANA_CARD_DIGITS);
  if (!cleaned && !digits) {
    return "";
  }
  const head = digits.slice(0, 9);
  const tail = digits.slice(9);
  return `GHA-${head}${tail ? `-${tail}` : ""}`;
}

// Full-pattern validation for the pre-submit check; partial input fails.
export function isValidGhanaCardNumber(value: string): boolean {
  return GHANA_CARD_PATTERN.test(value.trim());
}
