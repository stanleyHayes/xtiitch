import type { ActionFunctionArgs } from "react-router";
import { fetchApi } from "../lib/api-base";

// Resource route backing the sign-up form's SMS-code check (§8: the account
// step only unfreezes once the code VERIFIES, not at final submit). Mirrors
// business-otp.ts: the Go API base is configured server-side and is not
// reachable from the browser, so the form posts here and we forward to the
// public verify endpoint server-side.
//
// Unlike the OTP REQUEST route (opaque on purpose), this one passes real
// failures through: §8 needs invalid_code / code_expired / too_many_attempts
// surfaced inline so the owner knows whether to retype, resend, or wait. The
// codes travel in the response body; the status mirrors the API's so a 429
// still looks like a 429 to the browser.

type OtpVerifyBody = {
  phone?: unknown;
  code?: unknown;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  let payload: OtpVerifyBody;
  try {
    payload = (await request.json()) as OtpVerifyBody;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";

  if (!phone || !code) {
    return Response.json({ error: "missing_phone_or_code" }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetchApi("/auth/business/register/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
  } catch {
    return Response.json({ error: "api_unavailable" }, { status: 502 });
  }

  if (!response.ok) {
    // Pass the API's reason through (invalid_code, code_expired,
    // too_many_attempts, invalid_phone, whatsapp_unavailable) — same
    // passthrough shape as profile-phone-otp.ts.
    let code = "otp_verify_failed";
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error) {
        code = body.error;
      }
    } catch {
      // Keep the generic code when the body is not the shape we expect.
    }
    return Response.json({ error: code }, { status: response.status });
  }

  // 204 No Content: the challenge for this phone is now marked verified, and
  // the later /auth/business/register is accepted with or without the code.
  return Response.json({ ok: true });
}
