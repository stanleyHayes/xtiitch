import assert from "node:assert/strict";
import test from "node:test";
import { parseDepositMinor } from "../features/shared/utils/money";

test("bespoke deposits default blank and zero values to GHS 1", () => {
  assert.equal(parseDepositMinor(null), 100);
  assert.equal(parseDepositMinor(""), 100);
  assert.equal(parseDepositMinor("0"), 100);
});

test("bespoke deposits preserve owner-defined amounts without an upper cap", () => {
  assert.equal(parseDepositMinor("1"), 100);
  assert.equal(parseDepositMinor("275.50"), 27_550);
  assert.equal(parseDepositMinor("1000000"), 100_000_000);
});
