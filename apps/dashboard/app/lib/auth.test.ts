import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiFetch } from "./auth";
import { commitSession, getSession } from "./session";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("apiFetch redirects unauthenticated dashboard requests to login", async () => {
  await assert.rejects(
    () => apiFetch(new Request("http://app.localhost/dashboard"), "/orders"),
    (error) => {
      assert.ok(error instanceof Response);
      assert.equal(error.status, 302);
      assert.equal(error.headers.get("Location"), "/login");
      return true;
    },
  );
});

test("apiFetch sends the dashboard session access token to the API", async () => {
  const session = await getSession();
  session.set("access", "dashboard-access");
  session.set("refresh", "dashboard-refresh");
  const cookie = await commitSession(session);
  let seenUrl = "";
  let seenAuth = "";

  globalThis.fetch = (async (input, init) => {
    seenUrl = String(input);
    seenAuth = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const response = await apiFetch(
    new Request("http://app.localhost/dashboard", {
      headers: { Cookie: cookie },
    }),
    "/orders",
  );

  assert.equal(response.status, 200);
  assert.equal(seenUrl, "http://localhost:8080/v1/orders");
  assert.equal(seenAuth, "Bearer dashboard-access");
});
