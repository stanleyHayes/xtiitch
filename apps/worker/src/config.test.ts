import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "./config";

test("loadConfig defaults to the log notification transport", () => {
  const config = loadConfig({});

  assert.equal(config.notificationTransport, "log");
  assert.equal(config.notificationHttp, undefined);
  assert.equal(config.subscriptionBillingSweepEnabled, true);
  assert.equal(config.subscriptionBillingSweepIntervalMs, 3_600_000);
});

test("loadConfig requires HTTP transport credentials", () => {
  assert.throws(
    () => loadConfig({ NOTIFICATION_TRANSPORT: "http" }),
    /NOTIFICATION_HTTP_URL is required/,
  );
  assert.throws(
    () =>
      loadConfig({
        NOTIFICATION_TRANSPORT: "http",
        NOTIFICATION_HTTP_URL: "https://provider.test/send",
      }),
    /NOTIFICATION_HTTP_AUTH_VALUE is required/,
  );
});

test("loadConfig parses HTTP notification transport settings", () => {
  const config = loadConfig({
    NOTIFICATION_TRANSPORT: "http",
    NOTIFICATION_HTTP_URL: "https://provider.test/send",
    NOTIFICATION_HTTP_AUTH_HEADER: "X-API-Key",
    NOTIFICATION_HTTP_AUTH_VALUE: "secret-token",
    NOTIFICATION_FROM: "Xtiitch Local",
    NOTIFICATION_HTTP_TIMEOUT_MS: "3000",
  });

  assert.equal(config.notificationTransport, "http");
  assert.deepEqual(config.notificationHttp, {
    url: "https://provider.test/send",
    authHeader: "X-API-Key",
    authValue: "secret-token",
    from: "Xtiitch Local",
    timeoutMs: 3000,
  });
});

test("loadConfig parses subscription billing sweep settings", () => {
  const config = loadConfig({
    SUBSCRIPTION_BILLING_SWEEP_ENABLED: "false",
    SUBSCRIPTION_BILLING_SWEEP_INTERVAL_MS: "60000",
  });

  assert.equal(config.subscriptionBillingSweepEnabled, false);
  assert.equal(config.subscriptionBillingSweepIntervalMs, 60_000);
});

test("loadConfig refuses no-op notifications + local DB in production", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        NOTIFICATION_TRANSPORT: "log",
      }),
    /NOTIFICATION_TRANSPORT must deliver messages in production/,
  );
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        NOTIFICATION_TRANSPORT: "whatsapp_cloud",
        WHATSAPP_PHONE_NUMBER_ID: "123",
        WHATSAPP_ACCESS_TOKEN: "tok",
      }),
    /DATABASE_URL must point at the production database/,
  );
  // A fully-configured production worker loads fine.
  const ok = loadConfig({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://app:strong@db.internal:5432/xtiitch?sslmode=require",
    NOTIFICATION_TRANSPORT: "whatsapp_cloud",
    WHATSAPP_PHONE_NUMBER_ID: "123",
    WHATSAPP_ACCESS_TOKEN: "tok",
  });
  assert.equal(ok.notificationTransport, "whatsapp_cloud");
});
