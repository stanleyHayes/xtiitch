import assert from "node:assert/strict";
import { test } from "node:test";
import { billingVerificationIsActive } from "./billing-verification";

test("billing verification accepts only an explicit active payload", async () => {
  assert.equal(
    await billingVerificationIsActive(
      Response.json({ status: "active" }, { status: 200 }),
    ),
    true,
  );

  for (const status of ["trialing", "past_due", "pending", "abandoned"]) {
    assert.equal(
      await billingVerificationIsActive(Response.json({ status }, { status: 200 })),
      false,
    );
  }
});

test("billing verification rejects transport and malformed successes", async () => {
  assert.equal(
    await billingVerificationIsActive(
      Response.json({ error: "unavailable" }, { status: 503 }),
    ),
    false,
  );
  assert.equal(
    await billingVerificationIsActive(new Response("not json", { status: 200 })),
    false,
  );
});
