import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(root, "../..");
const spec = JSON.parse(
  readFileSync(resolve(root, "openapi/xtiitch.v1.openapi.json"), "utf8"),
);

const requiredPaths = [
  "/healthz",
  "/readyz",
  "/v1/version",
  "/v1/auth/business/register",
  "/v1/auth/business/login",
  "/v1/auth/business/me",
  "/v1/auth/business/users",
  "/v1/businesses/me",
  "/v1/businesses/me/verify",
  "/v1/store-settings",
  "/v1/collections",
  "/v1/designs",
  "/v1/designs/{id}/prices/{bandId}",
  "/v1/media/design-upload-signature",
  "/v1/orders",
  "/v1/orders/{id}/advance",
  "/v1/payments",
  "/v1/payments/checkout",
  "/v1/money/summary",
  "/v1/promotions",
  "/v1/public/stores/{handle}",
  "/v1/public/designs/{handle}",
  "/v1/public/stores/{handle}/orders",
  "/v1/public/stores/{handle}/custom-orders",
  "/v1/public/orders/{id}",
  "/v1/public/referrals/{code}",
  "/v1/public/affiliates/{code}/clicks",
  "/v1/public/sponsored",
  "/v1/webhooks/paystack",
  "/v1/admin/auth/login",
  "/v1/admin/auth/me",
  "/v1/admin/users",
  "/v1/admin/roles",
  "/v1/admin/settings/profile",
  "/v1/admin/business-verifications",
  "/v1/admin/business-verifications/{id}/decision",
  "/v1/admin/businesses",
  "/v1/admin/customers",
  "/v1/admin/platform-metrics",
  "/v1/admin/money-rails",
  "/v1/admin/subscriptions",
  "/v1/admin/plans",
  "/v1/admin/promotions",
  "/v1/admin/ad-campaigns",
  "/v1/admin/affiliates",
  "/v1/admin/referral-programmes",
  "/v1/admin/referral-rewards/issue",
  "/v1/admin/risk-reviews",
  "/v1/admin/support-tickets",
  "/v1/admin/operations-health",
  "/v1/admin/notifications",
  "/v1/admin/reports",
  "/v1/admin/launch-readiness",
  "/v1/admin/audit-events",
  "/v1/admin/exports/{dataset}.csv",
];

const sourceRoutes = [
  {
    file: "apps/api/internal/adapters/inbound/http/router.go",
    routes: ["/healthz", "/readyz", "/version"],
  },
  {
    file: "apps/api/internal/adapters/inbound/http/auth/handler.go",
    routes: ["/auth/business/register", "/auth/business/me", "/auth/business/users"],
  },
  {
    file: "apps/api/internal/adapters/inbound/http/catalogue/handler.go",
    routes: ["/public/stores/{handle}", "/designs/{id}/prices/{bandId}", "/promotions"],
  },
  {
    file: "apps/api/internal/adapters/inbound/http/checkout/handler.go",
    routes: ["/public/stores/{handle}/orders", "/public/stores/{handle}/custom-orders"],
  },
  {
    file: "apps/api/internal/adapters/inbound/http/adminauth/handler.go",
    routes: [
      "/admin/users",
      "/admin/roles",
      "/admin/customers",
      "/admin/referral-rewards/issue",
      "/admin/exports/{dataset}.csv",
    ],
  },
];

test("OpenAPI v1 document has required metadata and auth schemes", () => {
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.info.title, "Xtiitch API");
  assert.ok(spec.info.version);
  assert.ok(spec.servers.length >= 2);

  const schemes = spec.components.securitySchemes;
  assert.equal(schemes.BusinessBearer.scheme, "bearer");
  assert.equal(schemes.AdminBearer.scheme, "bearer");
  assert.equal(schemes.PaystackSignature.name, "X-Paystack-Signature");
});

test("OpenAPI v1 document covers the active route families", () => {
  for (const path of requiredPaths) {
    assert.ok(spec.paths[path], `missing ${path}`);
  }
});

test("OpenAPI operations are identifiable, tagged, and have a success response", () => {
  const seenOperationIds = new Set();

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      assert.ok(operation.operationId, `${method.toUpperCase()} ${path} missing operationId`);
      assert.ok(!seenOperationIds.has(operation.operationId), `duplicate operationId ${operation.operationId}`);
      seenOperationIds.add(operation.operationId);

      assert.ok(Array.isArray(operation.tags), `${operation.operationId} missing tags`);
      assert.ok(operation.tags.length > 0, `${operation.operationId} has no tags`);

      const responseCodes = Object.keys(operation.responses ?? {});
      assert.ok(responseCodes.some((code) => code.startsWith("2")), `${operation.operationId} missing 2xx response`);
    }
  }
});

test("protected operations declare the expected security scheme", () => {
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const label = `${method.toUpperCase()} ${path}`;

      if (path.startsWith("/v1/admin/") && path !== "/v1/admin/auth/login") {
        assert.deepEqual(operation.security, [{ AdminBearer: [] }], `${label} must use admin auth`);
      }

      if (
        path.startsWith("/v1/") &&
        !path.startsWith("/v1/admin/") &&
        !path.startsWith("/v1/public/") &&
        path !== "/v1/version" &&
        path !== "/v1/webhooks/paystack" &&
        !path.startsWith("/v1/auth/business/register") &&
        !path.startsWith("/v1/auth/business/login") &&
        !path.startsWith("/v1/auth/business/refresh")
      ) {
        assert.deepEqual(operation.security, [{ BusinessBearer: [] }], `${label} must use business auth`);
      }

      if (path === "/v1/webhooks/paystack") {
        assert.deepEqual(operation.security, [{ PaystackSignature: [] }], `${label} must use webhook signature auth`);
      }
    }
  }
});

test("critical documented routes still exist in the Go handlers", () => {
  for (const { file, routes } of sourceRoutes) {
    const source = readFileSync(resolve(workspaceRoot, file), "utf8");
    for (const route of routes) {
      assert.ok(source.includes(route), `${file} no longer registers ${route}`);
    }
  }
});
