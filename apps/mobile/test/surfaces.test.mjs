import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mobileSurfaces,
  resolveApiBaseUrl,
  resolveLaunchRoute,
  resolveMobileSurface,
} from "../src/surfaces.mjs";

test("mobile surface registry keeps customer and business lanes separate", () => {
  assert.deepEqual(
    mobileSurfaces.map((surface) => surface.id),
    ["customer", "business"],
  );
  assert.equal(resolveMobileSurface().authRealm, "customer");
  assert.equal(resolveMobileSurface("business").authRealm, "business");
  assert.throws(() => resolveMobileSurface("admin"), /Unsupported mobile surface/);
});

test("launch routing maps customer and business paths to the correct shell", () => {
  assert.deepEqual(resolveLaunchRoute({ path: "/store/demo-atelier" }), {
    surface: "customer",
    route: "/store/demo-atelier",
  });
  assert.deepEqual(resolveLaunchRoute({ path: "/dashboard/orders" }), {
    surface: "business",
    route: "/dashboard/orders",
  });
  assert.deepEqual(resolveLaunchRoute({ surface: "business" }), {
    surface: "business",
    route: "/business",
  });
});

test("launch routing accepts full URLs and defaults to the customer surface", () => {
  assert.deepEqual(
    resolveLaunchRoute({
      path: "https://demo-atelier.xtiitch.com/track/order_123?from=sms",
    }),
    {
      surface: "customer",
      route: "/track/order_123",
    },
  );
  assert.deepEqual(resolveLaunchRoute(), {
    surface: "customer",
    route: "/customer/home",
  });
});

test("API base URL prefers Expo public config and strips route/search fragments", () => {
  assert.equal(
    resolveApiBaseUrl({
      EXPO_PUBLIC_XTIITCH_API_URL: "https://api.xtiitch.test/api/?debug=true",
      XTIITCH_API_URL: "https://ignored.example",
    }),
    "https://api.xtiitch.test/api",
  );
  assert.equal(resolveApiBaseUrl({}), "http://localhost:8080/v1");
});
