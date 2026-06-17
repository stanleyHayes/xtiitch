import assert from "node:assert/strict";
import test from "node:test";

import {
  runSubscriptionBillingSweep,
  type SubscriptionBillingSweepStore,
  type SubscriptionBillingSweepSummary,
} from "./billing";

test("runSubscriptionBillingSweep trims the reason and returns the store summary", async () => {
  const ranAt = new Date("2026-06-17T12:00:00Z");
  const store = new MemoryBillingSweepStore({
    overdueInvoicesFailed: 2,
    subscriptionsCanceled: 1,
    businessesTouched: 2,
    ranAt,
  });

  const summary = await runSubscriptionBillingSweep({
    store,
    reason: "  scheduled retry  ",
  });

  assert.equal(store.reason, "scheduled retry");
  assert.deepEqual(summary, {
    overdueInvoicesFailed: 2,
    subscriptionsCanceled: 1,
    businessesTouched: 2,
    ranAt,
  });
});

test("runSubscriptionBillingSweep supplies a default reason", async () => {
  const store = new MemoryBillingSweepStore({
    overdueInvoicesFailed: 0,
    subscriptionsCanceled: 0,
    businessesTouched: 0,
    ranAt: new Date("2026-06-17T12:00:00Z"),
  });

  await runSubscriptionBillingSweep({ store, reason: "   " });

  assert.equal(store.reason, "Scheduled subscription billing sweep.");
});

class MemoryBillingSweepStore implements SubscriptionBillingSweepStore {
  reason = "";

  constructor(private readonly summary: SubscriptionBillingSweepSummary) {}

  async runSubscriptionBillingSweep(reason: string): Promise<SubscriptionBillingSweepSummary> {
    this.reason = reason;
    return this.summary;
  }
}
