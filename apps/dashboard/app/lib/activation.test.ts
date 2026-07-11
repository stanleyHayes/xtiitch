import assert from "node:assert/strict";
import { test } from "node:test";
import { activationPlanLabel, activationPromptMessage } from "./activation";

test("activationPlanLabel prefers the API plan name", () => {
  assert.equal(
    activationPlanLabel({ plan_name: "Growth", plan_code: "growth" }),
    "Growth",
  );
});

test("activationPlanLabel falls back to a capitalized plan code", () => {
  assert.equal(
    activationPlanLabel({ plan_name: "", plan_code: "studio" }),
    "Studio",
  );
});

test("activationPlanLabel falls back to 'paid' when nothing is known", () => {
  assert.equal(activationPlanLabel({ plan_name: "", plan_code: "" }), "paid");
});

test("activationPromptMessage builds the standard prompt", () => {
  assert.equal(
    activationPromptMessage("Growth"),
    "Activate your Growth plan to start using Xtiitch",
  );
});
