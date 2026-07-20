import type { Route } from "../../routes/+types/profile";
import { apiFetch } from "../../lib/auth";
import { apiErrorCode } from "../shared/utils";

export type ProfileActionResult = {
  error?: string;
  saved?: boolean;
  // True when the API rejected a phone CHANGE for lack of an SMS code
  // (§9: phone_verification_required). The form answers by opening the
  // code-entry step rather than reporting a dead failure.
  phoneCodeNeeded?: boolean;
};

// Friendly copy for the profile-save rejection codes (§9). Each implies a
// different fix — prove the phone, pick another email/WhatsApp, or resend a
// code — so they stay distinct.
async function profileErrorMessage(
  response: Response,
): Promise<{ error: string; phoneCodeNeeded?: boolean }> {
  const code = await apiErrorCode(response);
  switch (code) {
    case "phone_verification_required":
      return {
        error:
          "Your new phone number needs the SMS code we sent to it — enter the code and save again.",
        phoneCodeNeeded: true,
      };
    case "invalid_code":
      return { error: "That code doesn't match. Check it and try again." };
    case "code_expired":
      return { error: "That code has expired. Send a new one to your number." };
    case "too_many_attempts":
      return {
        error: "Too many incorrect codes. Send a new one to try again.",
      };
    case "user_email_taken":
      return { error: "That email is already used by another Xtiitch account." };
    case "user_whatsapp_taken":
      return {
        error: "That WhatsApp number is already used by another Xtiitch account.",
      };
    case "invalid_phone":
      return { error: "That doesn't look like a Ghana phone number." };
    case "invalid_input":
      return { error: "Check the details and try again." };
    case "whatsapp_unavailable":
      return {
        error: "Phone verification is unavailable right now. Try again shortly.",
      };
    default:
      return { error: "Could not save your profile. Try again." };
  }
}

// §9 self-service profile edit: display name, email and WhatsApp save
// directly; a phone CHANGE must carry the SMS code sent to the new number
// (exactly as at account creation). The API only touches the caller's OWN row
// — the user id comes from the verified token.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent !== "save_profile") {
    return { error: "Unknown action." } satisfies ProfileActionResult;
  }
  const displayName = String(form.get("display_name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const whatsappNumber = String(form.get("whatsapp_number") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const otpCode = String(form.get("otp_code") ?? "").trim();
  if (!displayName) {
    return { error: "Enter your name." } satisfies ProfileActionResult;
  }
  if (!email) {
    return { error: "Enter your email address." } satisfies ProfileActionResult;
  }
  const response = await apiFetch(request, "/auth/business/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: displayName,
      email,
      whatsapp_number: whatsappNumber,
      phone,
      // The code only rides along when one was entered; the API ignores it
      // unless the phone actually changed.
      ...(otpCode ? { otp_code: otpCode } : {}),
    }),
  });
  if (!response.ok) {
    return (await profileErrorMessage(response)) satisfies ProfileActionResult;
  }
  return { saved: true } satisfies ProfileActionResult;
}
