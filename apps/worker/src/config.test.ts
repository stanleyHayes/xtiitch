import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "./config";

test("loadConfig defaults to the log notification transport", () => {
  const config = loadConfig({});

  assert.equal(config.notificationTransport, "log");
  assert.equal(config.notificationHttp, undefined);
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
