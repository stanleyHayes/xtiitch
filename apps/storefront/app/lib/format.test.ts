import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGHS, priceLabel } from "./format";

test("formatGHS formats pesewas as Ghana cedis", () => {
  assert.equal(formatGHS(5000), "GH\u20B550.00");
});

test("priceLabel reports the lowest available catalogue price", () => {
  assert.equal(priceLabel([]), "Price on request");
  assert.equal(
    priceLabel([
      { size_band_id: "xl", label: "XL", price_minor: 32000 },
      { size_band_id: "m", label: "Medium", price_minor: 28000 },
    ]),
    "From GH\u20B5280.00",
  );
});
