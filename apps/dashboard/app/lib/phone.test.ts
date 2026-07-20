import assert from "node:assert/strict";
import { test } from "node:test";
import {
  internationalPhoneDigits,
  telHref,
  whatsAppHref,
} from "./phone";

test("internationalPhoneDigits normalises Ghana local and E.164 forms", () => {
  assert.equal(internationalPhoneDigits("0244123456"), "233244123456");
  assert.equal(internationalPhoneDigits("0244 123 456"), "233244123456");
  assert.equal(internationalPhoneDigits("+233 24 412 3456"), "233244123456");
  assert.equal(internationalPhoneDigits("233244123456"), "233244123456");
  assert.equal(internationalPhoneDigits(""), "");
  assert.equal(internationalPhoneDigits("  "), "");
});

test("tel and wa.me hrefs are built from the normalised digits", () => {
  assert.equal(telHref("0244123456"), "tel:+233244123456");
  assert.equal(whatsAppHref("0244123456"), "https://wa.me/233244123456");
  assert.equal(whatsAppHref("+233244123456"), "https://wa.me/233244123456");
  assert.equal(telHref(""), "");
  assert.equal(whatsAppHref(""), "");
});
