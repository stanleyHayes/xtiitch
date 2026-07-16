import type { ActionFunctionArgs } from "react-router";
import { apiFetch } from "../lib/auth";

// Resource route backing the "Verify number" button on the payout details panel.
// The Go API base is not reachable from the browser, so the button posts here and
// we forward server-side (same pattern as business-otp.ts).
//
// This is deliberately NOT business-otp.ts. That route serves signup and sign-in,
// where no session exists yet, so it forwards to the PUBLIC code-request
// endpoints. A payout number is proved by an owner who is already signed in, so
// it goes through apiFetch — the session travels with it and the API can refuse
// anyone without the money-management role, rather than sending paid SMS on an
// anonymous caller's say-so.
//
// Unlike business-otp.ts we do NOT collapse every response to { ok: true }. That
// route is opaque on purpose (it must not reveal whether an account exists);
// here the caller already owns the account, so a real failure — an unroutable
// number, a delivery fault — should reach the owner instead of being swallowed
// into a "code sent" that never arrives.

type PayoutOtpBody = {
  settlement_account?: unknown;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  let payload: PayoutOtpBody;
  try {
    payload = (await request.json()) as PayoutOtpBody;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const settlementAccount =
    typeof payload.settlement_account === "string"
      ? payload.settlement_account.trim()
      : "";

  if (!settlementAccount) {
    return Response.json({ error: "missing_number" }, { status: 400 });
  }

  const response = await apiFetch(request, "/businesses/me/payout-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settlement_account: settlementAccount }),
  });

  if (!response.ok) {
    // Pass the API's reason through. The owner already holds this account, so
    // there is nothing to stay opaque about, and "a code was just sent" needs a
    // different response from them than "that number is unreachable".
    let code = "otp_request_failed";
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error) {
        code = body.error;
      }
    } catch {
      // Keep the generic code when the body is not the shape we expect.
    }
    return Response.json({ error: code }, { status: 502 });
  }

  return Response.json({ ok: true });
}
