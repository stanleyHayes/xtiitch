// §8 state machine for the sign-up phone-verification flow. The register form
// used to let the owner type anything, request a code, and only discover a
// wrong/expired code at final submit. §8 makes verification a gate: requesting
// a code freezes every other field, the code field pops up directly under the
// "Verify phone number" button, the fields only come back live once the code
// VERIFIES (via the new /auth/business/register/otp/verify endpoint), and only
// then does the WhatsApp field appear.
//
// All of that is pure transition logic, so it lives here as a reducer the
// RegisterForm drives with useReducer — keeping the fetch/race plumbing in the
// component and the rules here, unit-tested in phone-verification.test.ts.

export const OTP_CODE_LENGTH = 6;

export type PhoneVerificationStatus =
  // Nothing requested yet: every field editable, no code field, no WhatsApp.
  | "idle"
  // Code sent (§8.2): other fields frozen + dimmed, code field under the button.
  | "awaiting_code"
  // Verify call in flight after the 6th digit: still frozen, "Checking…" shown.
  | "checking"
  // Verified (§8.4): fields live again, phone locked behind the ✓ chip, the
  // WhatsApp field is revealed beneath the code field.
  | "verified"
  // Phone changed after verification: §8 requires the verified state to reset
  // and the fields to re-freeze until the NEW number verifies.
  | "reverify_needed";

export type PhoneVerificationState = {
  status: PhoneVerificationStatus;
  // The code as typed (digits only, capped at OTP_CODE_LENGTH). Kept after
  // verification so it still submits as owner_phone_code for backward
  // compatibility — the API accepts a verified phone with or without it.
  code: string;
  // Inline message under the button / code field (send + verify failures).
  error: string;
  // OTP request in flight — disables the button and swaps its label.
  sending: boolean;
};

export type PhoneVerificationEvent =
  | { type: "request_started" }
  | { type: "request_succeeded" }
  | { type: "request_failed"; message: string }
  | { type: "code_changed"; code: string }
  | { type: "verify_started" }
  | { type: "verify_succeeded" }
  | { type: "verify_failed"; message: string }
  | { type: "phone_changed"; phone: string };

export const initialPhoneVerification: PhoneVerificationState = {
  status: "idle",
  code: "",
  error: "",
  sending: false,
};

// The code field accepts digits only and stops at 6 — the 6th digit is the
// component's cue to fire verify_started automatically.
export function sanitizeOtpCode(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, OTP_CODE_LENGTH);
}

// Any phone edit routes here: mid-attempt it abandons the sent code
// (unfreezing the form so a typo can be fixed), post-verification it resets
// to re-verify (§8). Clearing the phone entirely is always the escape hatch —
// the phone is optional at signup, so an empty field needs no verification.
function phoneChangedTransition(
  state: PhoneVerificationState,
  phone: string,
): PhoneVerificationState {
  if (phone.trim().length === 0) {
    return { ...initialPhoneVerification };
  }
  switch (state.status) {
    case "verified":
      // §8: changing the number after verification resets the verified state
      // and re-freezes everything until the new number verifies.
      return { status: "reverify_needed", code: "", error: "", sending: false };
    case "awaiting_code":
    case "checking":
      // The sent code belongs to the old number; editing the phone abandons
      // the attempt and unfreezes the fields so the form stays usable.
      return { ...initialPhoneVerification };
    case "reverify_needed":
      return { ...state, error: "" };
    case "idle":
      return state;
  }
}

export function phoneVerificationReducer(
  state: PhoneVerificationState,
  event: PhoneVerificationEvent,
): PhoneVerificationState {
  switch (event.type) {
    case "request_started":
      return { ...state, sending: true, error: "" };

    case "request_succeeded":
      // §8.2: a sent code freezes the other fields and pops the code field up
      // directly under the button. Any previously typed code is stale (a new
      // one was just sent), so it is cleared.
      return { status: "awaiting_code", code: "", error: "", sending: false };

    case "request_failed":
      // Keep the current status: from awaiting_code this is a failed RESEND, so
      // the first code may still arrive and the code field stays open; from
      // idle/reverify_needed the error shows under the button for a retry.
      return { ...state, sending: false, error: event.message };

    case "code_changed":
      return { ...state, code: sanitizeOtpCode(event.code), error: "" };

    case "verify_started":
      // Only meaningful from awaiting_code — anything else is a stale double
      // fire (e.g. an effect re-running after the state already moved on).
      return state.status === "awaiting_code"
        ? { ...state, status: "checking", error: "" }
        : state;

    case "verify_succeeded":
      // Guarded so a late response from an abandoned attempt (the user already
      // edited the phone, moving us out of checking) cannot mark the NEW
      // number verified.
      return state.status === "checking"
        ? { ...state, status: "verified", error: "" }
        : state;

    case "verify_failed":
      // Back to awaiting_code (§8.3: fields stay frozen until a code verifies).
      // The wrong code is cleared so a fresh one can be typed straight away.
      return state.status === "checking"
        ? { ...state, status: "awaiting_code", code: "", error: event.message }
        : state;

    case "phone_changed":
      return phoneChangedTransition(state, event.phone);
  }
}

// §8.2/§8.3: while a code is pending or being checked — and after a
// post-verification phone change — nothing else can be typed in.
export function fieldsFrozen(state: PhoneVerificationState): boolean {
  return (
    state.status === "awaiting_code" ||
    state.status === "checking" ||
    state.status === "reverify_needed"
  );
}

// §8: once verified the phone is no longer editable without re-verifying — the
// field goes read-only behind the ✓ chip and the explicit "Change number"
// affordance is the way back in.
export function phoneLocked(state: PhoneVerificationState): boolean {
  return state.status === "verified";
}

// The code field lives directly under the button (§8.2) and stays visible
// (disabled) after verification so the revealed WhatsApp field sits beneath
// it, keeping the flow moving downward (§8.4).
export function codeFieldVisible(state: PhoneVerificationState): boolean {
  return (
    state.status === "awaiting_code" ||
    state.status === "checking" ||
    state.status === "verified"
  );
}

// §8.4: no WhatsApp field at all until the phone is verified.
export function whatsappVisible(state: PhoneVerificationState): boolean {
  return state.status === "verified";
}

// A provided phone must reach "verified" before the account step can advance —
// verification is the gate, not the final submit (§8.3).
export function phoneStepComplete(state: PhoneVerificationState): boolean {
  return state.status === "verified";
}

// Reads the { error } code out of a same-origin OTP proxy response (both
// business-otp and business-otp-verify use that shape). Returns "" when the
// body is not the shape we expect, so the caller falls back to generic copy.
export async function readProxyErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "";
  } catch {
    return "";
  }
}

// Maps the request endpoint's errors to inline copy. The request endpoint is
// otherwise opaque (always 202), so resend_too_soon is the one real signal.
export function otpRequestErrorMessage(code: string): string {
  if (code === "resend_too_soon") {
    return "A code was just sent — please wait a moment before resending.";
  }
  return "We couldn't send a code. Check the number and try again.";
}

// Maps the verify endpoint's errors (401 invalid_code / code_expired, 429
// too_many_attempts, 400 invalid_phone, 503 whatsapp_unavailable) to inline
// copy under the code field.
export function otpVerifyErrorMessage(code: string): string {
  switch (code) {
    case "invalid_code":
      return "That code isn't right — check the SMS and try again.";
    case "code_expired":
      return "That code expired. Tap “Resend code” for a new one.";
    case "too_many_attempts":
      return "Too many tries. Request a new code and try again.";
    case "invalid_phone":
      return "That phone number doesn't look right.";
    case "whatsapp_unavailable":
      return "Verification is temporarily unavailable — try again shortly.";
    default:
      return "We couldn't check the code. Try again.";
  }
}
