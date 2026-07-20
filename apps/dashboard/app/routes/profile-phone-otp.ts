import type { ActionFunctionArgs } from "react-router";
import { apiFetch } from "../lib/auth";

// Resource route backing the profile page's "Verify phone number" button (§9:
// a phone change is proven with an SMS code, exactly as at account creation).
// The Go API base is not reachable from the browser, so the button posts here
// and we forward server-side with the session (same pattern as payout-otp.ts).
//
// Like payout-otp.ts, real failures are passed through: the caller owns this
// account, so "resend too soon" and "unroutable number" deserve their own
// answers rather than a swallowed generic OK.

type ProfilePhoneOtpBody = {
  phone?: unknown;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  let payload: ProfilePhoneOtpBody;
  try {
    payload = (await request.json()) as ProfilePhoneOtpBody;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  if (!phone) {
    return Response.json({ error: "missing_phone" }, { status: 400 });
  }

  const response = await apiFetch(request, "/auth/business/me/phone-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  if (!response.ok) {
    // Pass the API's reason through (resend_too_soon, invalid_phone, ...).
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
