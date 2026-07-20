import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_VAT_RATE_BPS,
  MAX_VAT_RATE_BPS,
  vatPercentToBps,
} from "./api/settings";

// §11.1: the form edits VAT as a percent, the API stores basis points.
test("vatPercentToBps converts whole percents", () => {
  assert.equal(vatPercentToBps(20), 2000);
  assert.equal(vatPercentToBps(0), 0);
  assert.equal(vatPercentToBps(100), 10000);
});

test("vatPercentToBps keeps fractional percents in integer bps", () => {
  assert.equal(vatPercentToBps(12.5), 1250);
  assert.equal(vatPercentToBps(7.765), 777); // rounds to the nearest bp
});

test("vatPercentToBps clamps to the API's 0-10000 bps window", () => {
  assert.equal(vatPercentToBps(-3), 0);
  assert.equal(vatPercentToBps(250), MAX_VAT_RATE_BPS);
});

test("vatPercentToBps falls back to the platform default on junk input", () => {
  assert.equal(vatPercentToBps(Number.NaN), DEFAULT_VAT_RATE_BPS);
  assert.equal(vatPercentToBps(Number.POSITIVE_INFINITY), DEFAULT_VAT_RATE_BPS);
});
