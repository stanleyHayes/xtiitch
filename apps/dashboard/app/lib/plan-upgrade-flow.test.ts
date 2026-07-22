import assert from "node:assert/strict";
import test from "node:test";
import {
  billingPlansLabel,
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

test("billing navigation remains available on Studio with accurate wording", () => {
  assert.equal(billingPlansLabel("studio"), "View billing plans");
  assert.equal(billingPlansLabel(" Studio "), "View billing plans");
  assert.equal(billingPlansLabel("growth"), "Upgrade plan");
});
