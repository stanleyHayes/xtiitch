import assert from "node:assert/strict";
import test from "node:test";
import { KNOWN_SECTIONS } from "../features/shared/types/navigation";
import { HELP_GUIDES, spokenGuide } from "./help-content";

test("every admin page has one step-by-step help guide", () => {
  const guideSections = HELP_GUIDES.map((guide) => guide.section);

  assert.deepEqual(new Set(guideSections), new Set(KNOWN_SECTIONS));
  assert.equal(guideSections.length, KNOWN_SECTIONS.length);
  for (const guide of HELP_GUIDES) {
    assert.ok(
      guide.summary.length > 20,
      `${guide.section} needs a useful summary`,
    );
    assert.ok(
      guide.steps.length >= 3,
      `${guide.section} needs at least three steps`,
    );
  }
});

test("spoken help preserves the visible step order", () => {
  const guide = HELP_GUIDES.find(
    (candidate) => candidate.section === "affiliates",
  );
  assert.ok(guide);

  const spoken = spokenGuide(guide);
  guide.steps.forEach((step, index) => {
    assert.ok(spoken.includes(`Step ${index + 1}. ${step}`));
  });
});
