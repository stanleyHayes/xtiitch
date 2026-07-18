// Passwordless WhatsApp sign-in for the business surface. Step one asks the
// API to send a one-time code to the number registered on the studio account;
// step two redeems it for the same token pair /auth/business/login issues (or
// an MFA challenge, which the login screen redeems through verifyMfaLogin).
//
// Mirrors the web dashboard's login action (apps/dashboard/app/features/auth/
// login-action.ts). Kept out of src/auth.ts so the password login/refresh logic
// stays untouched; the verified session is saved via auth.ts's persistSession.
import { apiBaseUrl } from "./api";
import { persistSession, type BusinessSession } from "./auth";

export type OtpVerifyOutcome =
  | { ok: true; session: BusinessSession }
  | { ok: true; mfa: "required"; challenge_token: string }
  | { ok: false; error: string };

// The request endpoint is opaque by design: it answers 202 whether or not the
// handle+number is registered, and the web advances to the code step even on a
// network fault. So does this — the caller never branches on the result.
export async function requestSignInOtp(
  businessHandle: string,
  whatsappNumber: string,
): Promise<void> {
  try {
    await fetch(`${apiBaseUrl()}/auth/business/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        business_handle: businessHandle.trim(),
        whatsapp_number: whatsappNumber.trim(),
      }),
    });
  } catch {
    // Swallowed: the user lands on the code step regardless and can resend.
  }
}

// 200 from /auth/business/otp/verify is either the full token pair or, for
// MFA-enabled accounts, { mfa_required, mfa_challenge_token } — the same fork
// as password login.
type OtpVerifyResponse = {
  business_id: string;
  business_user_id: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
  mfa_required?: boolean;
  mfa_challenge_token?: string;
};

export async function verifySignInOtp(
  businessHandle: string,
  whatsappNumber: string,
  code: string,
): Promise<OtpVerifyOutcome> {
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/business/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        business_handle: businessHandle.trim(),
        whatsapp_number: whatsappNumber.trim(),
        code: code.trim(),
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      return { ok: false, error: mapOtpError(response.status, payload?.error) };
    }
    const data = (await response.json()) as OtpVerifyResponse;
    if (data.mfa_required && data.mfa_challenge_token) {
      return { ok: true, mfa: "required", challenge_token: data.mfa_challenge_token };
    }
    const session: BusinessSession = {
      ...data,
      business_handle: businessHandle.trim().toLowerCase(),
    };
    await persistSession(session);
    return { ok: true, session };
  } catch {
    return { ok: false, error: "Network error — check your connection and retry." };
  }
}

// Codes from the API's authError mapping for /auth/business/otp/verify:
// invalid_code (wrong code — retry), code_expired (request a fresh one),
// too_many_attempts / account_locked (back off), invalid_phone (number shape),
// whatsapp_unavailable (provider down — fall back to password).
function mapOtpError(status: number, code?: string): string {
  if (code === "invalid_code" || code === "invalid_credentials") {
    return "That code didn't match. Request a new code and try again.";
  }
  if (code === "code_expired") {
    return "That code expired. Request a new one and try again.";
  }
  if (code === "too_many_attempts" || code === "account_locked" || status === 429) {
    return "Too many attempts — request a new code in a few minutes.";
  }
  if (code === "invalid_phone") {
    return "Enter the WhatsApp number registered to this studio.";
  }
  if (code === "whatsapp_unavailable" || status === 503) {
    return "Code sign-in is unavailable right now — use your password instead.";
  }
  return "Couldn't verify the code. Please try again.";
}
