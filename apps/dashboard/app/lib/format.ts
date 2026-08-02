import type { BandPrice } from "./api";

const ghs = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
});

// Money is stored as GHS pesewas (minor units); never divide before formatting
// elsewhere.
export function formatGHS(minor: number): string {
  return ghs.format(minor / 100);
}

// countLabel writes "1 window" and "2 windows" rather than "1 windows".
//
// The plural is the caller's to supply, not something to derive: English is
// irregular often enough ("captures" is fine, "boxes" and "people" are not)
// that guessing an -s is how the wrong word ships. Defaulting to singular + "s"
// keeps the common case a single argument.
export function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function priceLabel(prices: BandPrice[]): string {
  if (prices.length === 0) {
    return "Price on request";
  }
  const lowest = Math.min(...prices.map((p) => p.price_minor));
  return prices.length > 1 ? `From ${formatGHS(lowest)}` : formatGHS(lowest);
}
