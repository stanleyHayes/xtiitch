import assert from "node:assert/strict";
import { test } from "node:test";
import { adminActionSucceeded } from "./actionFeedback";

// §1.2/§11.4: the auto-reset convention hinges on this predicate — reset only
// fires for a success tagged with the SAME section that is listening.
test("adminActionSucceeded matches section and success severity", () => {
  assert.equal(
    adminActionSucceeded(
      { section: "subscriptions", severity: "success" },
      "subscriptions",
    ),
    true,
  );
});

test("adminActionSucceeded ignores feedback for another section", () => {
  assert.equal(
    adminActionSucceeded(
      { section: "settings", severity: "success" },
      "subscriptions",
    ),
    false,
  );
});

test("adminActionSucceeded never resets on non-success severities", () => {
  // An error must keep the operator's input so they can fix and retry; a
  // warning (e.g. a partial billing sweep) is not a clean completion either.
  for (const severity of ["error", "warning", "info"]) {
    assert.equal(
      adminActionSucceeded(
        { section: "businesses", severity },
        "businesses",
      ),
      false,
    );
  }
});

test("adminActionSucceeded tolerates empty or partial feedback", () => {
  assert.equal(adminActionSucceeded(undefined, "settings"), false);
  assert.equal(adminActionSucceeded(null, "settings"), false);
  assert.equal(adminActionSucceeded({}, "settings"), false);
  assert.equal(
    adminActionSucceeded({ section: "settings" }, "settings"),
    false,
  );
});
