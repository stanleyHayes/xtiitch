import test from "node:test";
import assert from "node:assert/strict";

const KB = 1024;

// uploadBudgetBytes() reads navigator.connection, so each case installs a fake
// navigator and re-imports the module with a cache-busting query. Importing
// once and mutating navigator would not work: the module reads it per call, but
// Node's `navigator` global is read-only, so it has to be defined before the
// import graph touches it.
async function budgetFor(connection: unknown): Promise<number> {
  Object.defineProperty(globalThis, "navigator", {
    value: { connection },
    configurable: true,
    writable: true,
  });
  const mod = await import(`./upload-limits.ts?case=${Math.random()}`);
  return mod.uploadBudgetBytes();
}

// The real measurement from the shop owner's phone: 3G, ~45 KB/s, mid-call.
// A 4 MB upload there is ~90 seconds — long enough that the network drops it
// and she loses the form. Whatever we choose must transfer in a sane window.
const OBSERVED_KBPS = 45;
const TOLERABLE_SECONDS = 20;

test("3G gets a budget that uploads inside a tolerable window", async () => {
  const budget = await budgetFor({ effectiveType: "3g" });
  const seconds = budget / KB / OBSERVED_KBPS;
  assert.ok(
    seconds < TOLERABLE_SECONDS,
    `3g budget ${Math.round(budget / KB)}KB = ${seconds.toFixed(0)}s (want < ${TOLERABLE_SECONDS}s)`,
  );
});

test("2G and slow-2G shrink further still", async () => {
  const threeG = await budgetFor({ effectiveType: "3g" });
  const twoG = await budgetFor({ effectiveType: "2g" });
  const slow = await budgetFor({ effectiveType: "slow-2g" });
  assert.ok(twoG <= threeG, `2g ${twoG} should not exceed 3g ${threeG}`);
  assert.ok(slow <= twoG, `slow-2g ${slow} should not exceed 2g ${twoG}`);
});

test("save-data honours the user's explicit request", async () => {
  const saver = await budgetFor({ effectiveType: "4g", saveData: true });
  const normal = await budgetFor({ effectiveType: "4g" });
  assert.ok(saver < normal, "saveData must reduce the budget even on 4g");
});

test("4G is not punished — good links keep the full ceiling", async () => {
  const fast = await budgetFor({ effectiveType: "4g", downlink: 10 });
  const mod = await import(`./upload-limits.ts?case=${Math.random()}`);
  assert.equal(fast, mod.MAX_UPLOAD_BUDGET_BYTES);
});

test("no Network Information API falls back conservatively, never to zero", async () => {
  const unknown = await budgetFor(undefined);
  assert.ok(unknown > 0, "must never return a zero budget");
  const seconds = unknown / KB / OBSERVED_KBPS;
  assert.ok(
    seconds < 60,
    `fallback ${Math.round(unknown / KB)}KB = ${seconds.toFixed(0)}s on a slow link`,
  );
});
