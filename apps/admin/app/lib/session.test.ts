import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  commitSession,
  getSession,
  requireAdminContext,
  setAdminSession,
} from "./session";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("requireAdminContext redirects missing sessions to login", async () => {
  await assert.rejects(
    () => requireAdminContext(new Request("http://admin.localhost/admin")),
    (error) => {
      assert.ok(error instanceof Response);
      assert.equal(error.status, 302);
      assert.equal(error.headers.get("Location"), "/login");
      return true;
    },
  );
});

test("requireAdminContext validates the cookie session through admin auth me", async () => {
  const session = await getSession();
  setAdminSession(session, {
    adminUserId: "adm_cookie",
    email: "cookie@xtiitch.test",
    displayName: "Cookie Operator",
    role: "support",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accessExpiresAt: "2026-06-18T12:00:00Z",
    refreshExpiresAt: "2026-06-19T12:00:00Z",
  });

  const cookie = await commitSession(session);
  let seenUrl = "";
  let seenAuth = "";

  globalThis.fetch = (async (input, init) => {
    seenUrl = String(input);
    seenAuth = new Headers(init?.headers).get("Authorization") ?? "";
    return jsonResponse({
      admin_user_id: "adm_live",
      email: "operator@xtiitch.test",
      display_name: "Live Operator",
      role: "operator",
      is_active: true,
    });
  }) as typeof fetch;

  const context = await requireAdminContext(
    new Request("http://admin.localhost/admin", {
      headers: { Cookie: cookie },
    }),
  );

  assert.equal(seenUrl, "http://localhost:8080/v1/admin/auth/me");
  assert.equal(seenAuth, "Bearer access-token");
  assert.deepEqual(context, {
    admin: {
      adminUserId: "adm_live",
      adminEmail: "operator@xtiitch.test",
      adminDisplayName: "Live Operator",
      adminRole: "operator",
    },
    accessToken: "access-token",
  });
});
