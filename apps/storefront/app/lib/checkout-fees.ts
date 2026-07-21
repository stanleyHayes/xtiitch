import type { CheckoutQuote } from "./api";

export type CheckoutTaxLine = {
  label: "Tax fee";
  amountMinor: number;
};

// The API's tax_minor is already the store-setting-aware customer charge:
// positive only when fee_pass_tax is enabled, zero when the store absorbs it.
// Checkout must not infer visibility from the global VAT rate.
export function checkoutTaxLine(
  quote: CheckoutQuote | null,
): CheckoutTaxLine | null {
  if (!quote || quote.tax_minor <= 0) {
    return null;
  }
  return { label: "Tax fee", amountMinor: quote.tax_minor };
}
