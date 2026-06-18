import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { XtiitchApiClient } from "./index";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("health fetches the API health endpoint from the configured base URL", async () => {
  let seenUrl = "";
  globalThis.fetch = (async (input) => {
    seenUrl = String(input);
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const client = new XtiitchApiClient({
    baseUrl: "https://api.xtiitch.test/root",
  });

  assert.deepEqual(await client.health(), { status: "ok" });
  assert.equal(seenUrl, "https://api.xtiitch.test/healthz");
});

test("health throws when the API health endpoint is not ok", async () => {
  globalThis.fetch = (async () =>
    new Response("down", { status: 503 })) as typeof fetch;

  const client = new XtiitchApiClient({
    baseUrl: "https://api.xtiitch.test",
  });

  await assert.rejects(
    () => client.health(),
    /Xtiitch API health check failed: 503/,
  );
});
