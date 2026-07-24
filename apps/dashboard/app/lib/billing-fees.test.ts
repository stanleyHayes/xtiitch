import assert from "node:assert/strict";
import { test } from "node:test";
import { roundHalfUpMinor, subscriptionCharge, vatMinor } from "./billing-fees";

test("subscriptionCharge matches the §4.6 worked example (147.00 + 29.40 + 3.51 = 179.91)", () => {
  const charge = subscriptionCharge(14700, 2000, false);
  assert.equal(charge.packageMinor, 14700);
  assert.equal(charge.vatMinor, 2940);
  assert.equal(charge.transactionFeeMinor, 351);
  assert.equal(charge.totalMinor, 17991);
  // The point of the gross-up: after Paystack takes 1.95% of the total
  // (179.91 -> 3.51), what remains (176.40) is package + tax untouched.
  assert.equal(
    charge.totalMinor - roundHalfUpMinor(charge.totalMinor * 0.0195),
    charge.packageMinor + charge.vatMinor,
  );
});

test("subscriptionCharge disables VAT only when the configured rate is zero", () => {
  const noVat = subscriptionCharge(14700, 0, false);
  assert.equal(noVat.vatMinor, 0);
  assert.equal(noVat.totalMinor, roundHalfUpMinor(14700 / 0.9805));
  assert.equal(
    noVat.transactionFeeMinor,
    noVat.totalMinor - noVat.packageMinor,
  );

  const inclusive = subscriptionCharge(14700, 2000, true);
  assert.equal(inclusive.packageMinor, 14700);
  assert.equal(inclusive.vatMinor, 2940);
  assert.equal(inclusive.transactionFeeMinor, 351);
  assert.equal(inclusive.totalMinor, 17991);
  assert.equal(
    inclusive.packageMinor + inclusive.vatMinor + inclusive.transactionFeeMinor,
    inclusive.totalMinor,
  );
});

test("legacy inclusive flag cannot back tax out of a package purchase", () => {
  const charge = subscriptionCharge(200, 2000, true);
  assert.deepEqual(charge, {
    packageMinor: 200,
    vatMinor: 40,
    transactionFeeMinor: 5,
    totalMinor: 245,
  });
});

test("vatMinor rounds half-up to the pesewa (§4.7)", () => {
  assert.equal(vatMinor(6275, 2000, false), 1255);
  // 1001 * 20% = 200.2 -> 200; 1003 * 20% = 200.6 -> 201.
  assert.equal(vatMinor(1001, 2000, false), 200);
  assert.equal(vatMinor(1003, 2000, false), 201);
  assert.equal(vatMinor(200, 2000, true), 40);
});

test("roundHalfUpMinor rounds a trailing 5 up, never down (§4.7)", () => {
  assert.equal(roundHalfUpMinor(125.5), 126);
  assert.equal(roundHalfUpMinor(124.3), 124);
  assert.equal(roundHalfUpMinor(17990.872), 17991);
});
