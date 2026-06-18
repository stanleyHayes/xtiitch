import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ghsMinorUnitsSchema,
  storeHandleSchema,
  tenantScopedIdSchema,
} from "./index";

test("ghsMinorUnitsSchema accepts non-negative integer pesewas", () => {
  assert.equal(ghsMinorUnitsSchema.parse(12500), 12500);
  assert.equal(ghsMinorUnitsSchema.safeParse(-1).success, false);
  assert.equal(ghsMinorUnitsSchema.safeParse(12.5).success, false);
});

test("tenantScopedIdSchema accepts UUID tenant ids only", () => {
  assert.equal(
    tenantScopedIdSchema.safeParse("8224d491-741e-44e2-9825-a7b97d984a8f")
      .success,
    true,
  );
  assert.equal(tenantScopedIdSchema.safeParse("tenant_123").success, false);
});

test("storeHandleSchema keeps storefront handles lowercase and URL-safe", () => {
  assert.equal(storeHandleSchema.parse("demo-atelier"), "demo-atelier");
  assert.equal(storeHandleSchema.safeParse("Demo").success, false);
  assert.equal(storeHandleSchema.safeParse("-demo").success, false);
  assert.equal(storeHandleSchema.safeParse("de").success, false);
});
