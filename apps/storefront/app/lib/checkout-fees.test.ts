import assert from "node:assert/strict";
import test from "node:test";
import type { CheckoutQuote } from "./api";
import { checkoutTaxLine } from "./checkout-fees";

function quote(taxMinor: number): CheckoutQuote {
  return {
    currency: "GHS",
    lines: [],
    delivery_fee_minor: 0,
    items_total_minor: 5000,
    vat_rate_bps: 2000,
    transaction_fee_minor: 0,
    tax_minor: taxMinor,
    total_minor: 5000 + taxMinor,
  };
}

test("passed-down VAT renders as the customer-facing Tax fee", () => {
  assert.deepEqual(checkoutTaxLine(quote(30)), {
    label: "Tax fee",
    amountMinor: 30,
  });
});

test("store-absorbed VAT renders no checkout line", () => {
  assert.equal(checkoutTaxLine(quote(0)), null);
  assert.equal(checkoutTaxLine(null), null);
});
