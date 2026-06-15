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

export function priceLabel(prices: BandPrice[]): string {
  if (prices.length === 0) {
    return "Price on request";
  }
  const lowest = Math.min(...prices.map((p) => p.price_minor));
  return prices.length > 1 ? `From ${formatGHS(lowest)}` : formatGHS(lowest);
}
