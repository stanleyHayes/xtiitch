import assert from "node:assert/strict";
import test from "node:test";
import {
  planChangeRequestBody,
  upgradeBillingHref,
} from "../features/billing/billing-helpers";

test("upgrade selection opens the billing-cycle step before Paystack", () => {
  assert.equal(
    upgradeBillingHref("studio"),
    "/onboarding/billing?change=studio",
  );
});

test("selected upgrade cadence is sent to the plan-change API", () => {
  assert.deepEqual(
    planChangeRequestBody(
      "studio",
      "quarterly",
      "https://dashboard.test/onboarding/billing/callback?flow=plan-change",
    ),
    {
      plan_code: "studio",
      billing_cadence: "quarterly",
      callback_url:
        "https://dashboard.test/onboarding/billing/callback?flow=plan-change",
    },
  );
});
