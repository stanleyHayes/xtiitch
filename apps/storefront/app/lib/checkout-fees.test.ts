import assert from "node:assert/strict";
import test from "node:test";
import type { CheckoutQuote } from "./api";
import { checkoutTaxLine } from "./checkout-fees";

function quote(taxMinor: number, taxPassedDown: boolean): CheckoutQuote {
  return {
    currency: "GHS",
    lines: [],
    delivery_fee_minor: 0,
    items_total_minor: 5000,
    vat_rate_bps: 2000,
    transaction_fee_minor: 0,
    tax_minor: taxMinor,
    tax_passed_down: taxPassedDown,
    total_minor: 5000 + taxMinor,
  };
}

test("passed-down VAT renders as the customer-facing Tax fee", () => {
  assert.deepEqual(checkoutTaxLine(quote(30, true)), {
    label: "Tax fee",
    amountMinor: 30,
  });
});

test("store-absorbed VAT renders no checkout line", () => {
  assert.equal(checkoutTaxLine(quote(30, false)), null);
  assert.equal(checkoutTaxLine(null), null);
});

test("passed-down VAT remains visible when its amount rounds to zero", () => {
  assert.deepEqual(checkoutTaxLine(quote(0, true)), {
    label: "Tax fee",
    amountMinor: 0,
  });
});
