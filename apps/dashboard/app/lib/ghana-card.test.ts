import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGhanaCardNumber, isValidGhanaCardNumber } from "./ghana-card";

test("formatGhanaCardNumber builds the GHA-XXXXXXXXX-X shape as digits arrive", () => {
  assert.equal(formatGhanaCardNumber(""), "");
  assert.equal(formatGhanaCardNumber("1"), "GHA-1");
  assert.equal(formatGhanaCardNumber("123456789"), "GHA-123456789");
  assert.equal(formatGhanaCardNumber("1234567890"), "GHA-123456789-0");
});

test("formatGhanaCardNumber normalises pasted and messy input", () => {
  assert.equal(formatGhanaCardNumber("GHA-123456789-0"), "GHA-123456789-0");
  assert.equal(formatGhanaCardNumber("gha1234567890"), "GHA-123456789-0");
  assert.equal(formatGhanaCardNumber("GHA 123 456 789 0"), "GHA-123456789-0");
  // Extra digits beyond the locked 10 are dropped, letters are stripped.
  assert.equal(formatGhanaCardNumber("12345678901234"), "GHA-123456789-0");
  assert.equal(formatGhanaCardNumber("GHA-12X3456789-0"), "GHA-123456789-0");
});

test("isValidGhanaCardNumber accepts only the full locked pattern", () => {
  assert.equal(isValidGhanaCardNumber("GHA-123456789-0"), true);
  assert.equal(isValidGhanaCardNumber("GHA-12345678-0"), false);
  assert.equal(isValidGhanaCardNumber("GHA-1234567890"), false);
  assert.equal(isValidGhanaCardNumber("gha-123456789-0"), false);
  assert.equal(isValidGhanaCardNumber("1234567890"), false);
  assert.equal(isValidGhanaCardNumber("GHA-123456789-"), false);
});
