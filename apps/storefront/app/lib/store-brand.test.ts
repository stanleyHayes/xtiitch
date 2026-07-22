import assert from "node:assert/strict";
import test from "node:test";
import {
  readableBrandText,
  resolveStoreBrand,
} from "../features/storefront/store-brand";
import { tokens } from "../theme";

test("resolveStoreBrand keeps valid merchant colours", () => {
  assert.equal(resolveStoreBrand("#2F6B4F"), "#2F6B4F");
});

test("resolveStoreBrand falls back for missing or unsafe colour values", () => {
  assert.equal(resolveStoreBrand(""), tokens.burgundy);
  assert.equal(resolveStoreBrand("red"), tokens.burgundy);
  assert.equal(resolveStoreBrand("url(javascript:alert(1))"), tokens.burgundy);
});

test("readableBrandText chooses accessible light or dark copy", () => {
  assert.equal(readableBrandText("#ffffff"), tokens.ink);
  assert.equal(readableBrandText("#001122"), tokens.white);
});
