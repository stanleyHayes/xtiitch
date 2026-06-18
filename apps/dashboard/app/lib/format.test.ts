import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGHS, priceLabel } from "./format";

test("formatGHS formats pesewas as Ghana cedis", () => {
  assert.equal(formatGHS(12345), "GH\u20B5123.45");
});

test("priceLabel handles empty, single and ranged price bands", () => {
  assert.equal(priceLabel([]), "Price on request");
  assert.equal(
    priceLabel([{ size_band_id: "s", label: "Small", price_minor: 15000 }]),
    "GH\u20B5150.00",
  );
  assert.equal(
    priceLabel([
      { size_band_id: "m", label: "Medium", price_minor: 24000 },
      { size_band_id: "s", label: "Small", price_minor: 18000 },
    ]),
    "From GH\u20B5180.00",
  );
});
