import type { CheckoutQuote } from "./api";

export type CheckoutTaxLine = {
  label: "Tax fee";
  amountMinor: number;
};

// The explicit pass-down flag controls visibility independently of the rounded
// amount. Fall back to the amount while API and storefront deployments overlap.
export function checkoutTaxLine(
  quote: CheckoutQuote | null,
): CheckoutTaxLine | null {
  if (!quote || !(quote.tax_passed_down ?? quote.tax_minor > 0)) {
    return null;
  }
  return { label: "Tax fee", amountMinor: quote.tax_minor };
}
