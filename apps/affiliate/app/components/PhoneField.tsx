import { useState } from "react";

function groups(value: string, sizes: number[]): string {
  const parts: string[] = [];
  let cursor = 0;
  for (const size of sizes) {
    const part = value.slice(cursor, cursor + size);
    if (part) parts.push(part);
    cursor += size;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.join(" ");
}

// Ghana mobile numbers are the common case and get a real mask. Anything else
// keeps its leading "+" and its digits untouched.
//
// Grouping a foreign number on a Ghanaian mask corrupts it: +44 7700 900123
// used to render as "447 700 9001 23", and because the mask dropped the "+",
// the normaliser could no longer tell it was international and submitted a
// bare "447700900123". Affiliates outside Ghana can apply, so their number has
// to survive being typed.
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  const international = value.trim().startsWith("+");
  if (!digits) return international ? "+" : "";

  if (digits.startsWith("233")) {
    return `+233 ${groups(digits.slice(3, 12), [2, 3, 4])}`.trim();
  }
  if (digits.startsWith("0") && !international) {
    return groups(digits.slice(0, 10), [3, 3, 4]);
  }
  // Non-Ghanaian: no country-specific grouping rules we can trust, so present
  // the digits as entered behind the "+" the user typed.
  return international ? `+${digits}` : digits;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("233")) return `+${digits}`;
  if (digits.startsWith("0") && !value.trim().startsWith("+")) {
    return `+233${digits.slice(1)}`;
  }
  return value.trim().startsWith("+") ? `+${digits}` : digits;
}

export function PhoneField() {
  const [displayValue, setDisplayValue] = useState("");

  return (
    <label>
      Phone number
      <input type="hidden" name="phone" value={normalizePhone(displayValue)} />
      <input
        type="tel"
        inputMode="tel"
        placeholder="+233 20 000 0000"
        autoComplete="tel"
        value={displayValue}
        onChange={(event) => setDisplayValue(formatPhone(event.target.value))}
        aria-label="Phone number"
      />
    </label>
  );
}
