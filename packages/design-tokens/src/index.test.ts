import assert from "node:assert/strict";
import { test } from "node:test";
import {
  xtiitchColors,
  xtiitchRadii,
  xtiitchSpacing,
  xtiitchTypography,
} from "./index";

test("brand colors expose the shared Xtiitch palette", () => {
  assert.equal(xtiitchColors.burgundy, "#800020");
  assert.equal(xtiitchColors.cream, "#faf6f2");
  assert.equal(xtiitchColors.success, "#237a4b");
});

test("layout tokens keep the web and mobile apps on the same scale", () => {
  assert.equal(xtiitchRadii.md, 8);
  assert.equal(xtiitchRadii.control, 16);
  assert.equal(xtiitchRadii.button, 999);
  assert.equal(xtiitchSpacing.lg, 24);
  assert.equal(xtiitchTypography.body.mobile, 16);
});
