import assert from "node:assert/strict";
import { test } from "node:test";
import {
  xtiitchColors,
  xtiitchFonts,
  xtiitchRadii,
  xtiitchSpacing,
  xtiitchThemeColors,
  xtiitchTypography,
  getXtiitchThemeColors,
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

test("web theme modes expose semantic light and dark surfaces", () => {
  assert.equal(xtiitchThemeColors.light.background, "#faf6f2");
  assert.equal(xtiitchThemeColors.light.surface, "#ffffff");
  assert.equal(xtiitchThemeColors.dark.mode, "dark");
  assert.equal(xtiitchThemeColors.dark.background, "#120d14");
  assert.equal(getXtiitchThemeColors("dark").text, "#fff7f2");
});

test("web typography uses the current Xtiitch font pairing", () => {
  assert.match(xtiitchFonts.display, /Fraunces/);
  assert.match(xtiitchFonts.body, /Outfit/);
  assert.match(xtiitchFonts.googleFontsHref, /Fraunces/);
  assert.match(xtiitchFonts.googleFontsHref, /Outfit/);
});

test("layout tokens keep the web and mobile apps on the same scale", () => {
  assert.equal(xtiitchRadii.md, 8);
  assert.equal(xtiitchRadii.control, 16);
  assert.equal(xtiitchRadii.button, 999);
  assert.equal(xtiitchSpacing.lg, 24);
  assert.equal(xtiitchTypography.body.mobile, 16);
});
