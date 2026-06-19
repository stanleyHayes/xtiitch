import assert from "node:assert/strict";
import { test } from "node:test";
import {
  xtiitchColors,
  xtiitchRadii,
  xtiitchSpacing,
  xtiitchTypography,
} from "./index";

test("brand colors expose the shared Xtiitch palette", () => {
  assert.equal(xtiitchColors.wine, "#800020");
  assert.equal(xtiitchColors.burgundy, "#800020");
  assert.equal(xtiitchColors.cream, "#faf6f2");
  assert.equal(xtiitchColors.graphite, "#565b63");
  assert.equal(xtiitchColors.line, "#e7ded7");
  // Order-status colours (reserved for in-product status, never decoration).
  assert.equal(xtiitchColors.statusReady, "#1e8e4e");
  assert.equal(xtiitchColors.success, "#1e8e4e");
});

test("layout tokens keep the web and mobile apps on the same scale", () => {
  assert.equal(xtiitchRadii.md, 8);
  assert.equal(xtiitchRadii.control, 16);
  assert.equal(xtiitchRadii.button, 999);
  assert.equal(xtiitchSpacing.lg, 24);
  assert.equal(xtiitchTypography.body.mobile, 16);
});
