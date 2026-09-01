import assert from "node:assert/strict";
import { test } from "node:test";
import { countLabel, formatGHS, priceLabel } from "./format";

test("formatGHS formats pesewas as Ghana cedis", () => {
  assert.equal(formatGHS(12345), "GH\u20B5123.45");
});

// The dashboard header read "1 windows · 0 handovers".
test("countLabel keeps the singular at one", () => {
  assert.equal(countLabel(1, "window"), "1 window");
  assert.equal(countLabel(2, "window"), "2 windows");
  assert.equal(countLabel(1, "handover"), "1 handover");
  assert.equal(countLabel(1, "active visit"), "1 active visit");
  assert.equal(countLabel(1, "payment follow-up"), "1 payment follow-up");
  assert.equal(countLabel(3, "payment follow-up"), "3 payment follow-ups");
});

// Zero is plural in English — "0 windows", not "0 window" — which is why the
// test is `=== 1` and not `<= 1`.
test("countLabel treats zero as plural", () => {
  assert.equal(countLabel(0, "window"), "0 windows");
  assert.equal(countLabel(0, "live order"), "0 live orders");
});

// Irregular plurals must be supplied; deriving them would eventually ship the
// wrong word.
test("countLabel accepts an explicit plural", () => {
  assert.equal(countLabel(1, "person", "people"), "1 person");
  assert.equal(countLabel(4, "person", "people"), "4 people");
});

test("priceLabel handles empty, single and ranged price bands", () => {
  assert.equal(priceLabel([]), "Price on request");
  assert.equal(
    priceLabel([{ size_band_id: "s", label: "Small", price_minor: 15000, actual_price_minor: 15000, discounted_price_minor: null }]),
    "GH\u20B5150.00",
  );
  assert.equal(
    priceLabel([
      { size_band_id: "m", label: "Medium", price_minor: 24000, actual_price_minor: 24000, discounted_price_minor: null },
      { size_band_id: "s", label: "Small", price_minor: 18000, actual_price_minor: 18000, discounted_price_minor: null },
    ]),
    "From GH\u20B5180.00",
  );
});
