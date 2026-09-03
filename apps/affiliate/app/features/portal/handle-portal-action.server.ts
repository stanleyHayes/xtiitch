import { affiliateAPI } from "../../lib/api.server";
import { withAffiliateAuth } from "../../lib/auth.server";
import type { PortalActionResult } from "./types";

type PortalMutation = {
  path: string;
  method: string;
  body: Record<string, unknown>;
  // Shown on success. Each form says what it actually did, because "Saved"
  // under four different cards tells the affiliate nothing.
  success: string;
  // Sent without the session's bearer token. Password recovery is a public
  // endpoint and rejects an Authorization header it does not expect.
  anonymous?: boolean;
};

function mutationForIntent(
  intent: string,
  form: FormData,
  email: string
): PortalMutation | null {
  if (intent === "campaign") {
    return {
      path: "/affiliate/campaign-links",
      method: "POST",
      success: "Campaign link created.",
      body: {
        name: form.get("name"),
        slug: form.get("slug"),
        destination_url: form.get("destination_url")
      }
    };
  }
	if (intent === "invite") {
		return {
			path: "/affiliate/invitations",
			method: "POST",
			success: `Invitation sent to ${String(form.get("invitee_email") ?? "").trim()}.`,
			body: {
				email: String(form.get("invitee_email") ?? "").trim()
			}
		};
	}
  if (intent === "payout") {
    return {
      path: "/affiliate/payout-profile",
      method: "PUT",
      success: "Payout details updated.",
      body: {
        payout_method: form.get("payout_method"),
        account_name: form.get("account_name"),
        provider_name: form.get("provider_name"),
        account_identifier: form.get("account_identifier")
      }
    };
  }
  if (intent === "notifications") {
    return {
      path: "/affiliate/notification-preferences",
      method: "PUT",
      success: "Notification preferences saved.",
      body: {
        // Unchecked boxes are absent from FormData entirely, so presence is
        // the value — reading form.get() would make every unchecked box null
        // rather than false.
        conversion_emails: form.has("conversion_emails"),
        approval_emails: form.has("approval_emails"),
        reversal_emails: form.has("reversal_emails"),
        payout_emails: form.has("payout_emails")
      }
    };
  }
  if (intent === "password") {
    // The API has no authenticated change-password endpoint — only recovery
    // by email and a token-consuming reset. So "change my password" from
    // Settings sends the same reset link the sign-in page does, addressed to
    // the account's own email rather than one typed into a box (which would
    // let a borrowed session send a reset to an attacker's address).
    return {
      path: "/affiliate/auth/recovery",
      method: "POST",
      anonymous: true,
      success: `Password reset link sent to ${email}. It expires shortly.`,
      body: { email }
    };
  }
  return null;
}

// The API answers with machine codes ("invalid_application", "slug_taken").
// Those are for logs, not for people: the old handler piped the raw body
// straight into the page.
function messageForError(status: number, code: string): string {
	if (status === 409 && code.includes("affiliate_already_registered")) {
		return "That email already belongs to an Affiliate account. They can sign in directly.";
	}
	if (status === 403 && code.includes("affiliate_unavailable")) {
		return "Your Affiliate account cannot send invitations right now. Contact Xtiitch support.";
	}
  if (status === 409 && code.includes("slug")) {
    return "That link name is already in use. Try a different one.";
  }
  if (status === 409) {
    return "That value is already taken. Try a different one.";
  }
  if (status === 400 || status === 422) {
    return "Some details are missing or invalid. Check the form and try again.";
  }
  if (status === 401 || status === 403) {
    return "Your session expired. Sign in again to save this.";
  }
  if (status === 429) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return "We could not save that right now. Please try again.";
}

export async function handlePortalAction(
  request: Request
): Promise<{ result: PortalActionResult; setCookie?: string }> {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const email = String(form.get("account_email") ?? "");
  const mutation = mutationForIntent(intent, form, email);

  if (!mutation) {
    return { result: { intent, error: "That action is not available." } };
  }
  if (mutation.anonymous && !email) {
    return {
      result: {
        intent,
        error: "We could not read your account email. Reload and try again."
      }
    };
  }

  // The password reset is a public endpoint and takes no bearer token, so it
  // must not go through the authenticated wrapper — a 401 there would be
  // misread as an expired session and sign the affiliate out.
  if (mutation.anonymous) {
    return { result: await runMutation(mutation, intent, undefined) };
  }

  const { data, setCookie } = await withAffiliateAuth(
    request,
    (headers: HeadersInit) => runMutation(mutation, intent, headers),
  );
  return { result: data, setCookie };
}

// Rethrows a 401 so withAffiliateAuth can refresh and retry; every other
// failure becomes a message the operator can act on.
async function runMutation(
  mutation: PortalMutation,
  intent: string,
  headers: HeadersInit | undefined,
): Promise<PortalActionResult> {
  try {
    await affiliateAPI(mutation.path, {
      method: mutation.method,
      headers,
      body: JSON.stringify(mutation.body)
    });
    return { intent, success: mutation.success };
  } catch (error) {
    if (error instanceof Response) {
      if (error.status === 401 && headers) {
        throw error;
      }
      return {
        intent,
        error: messageForError(error.status, await error.text())
      };
    }
    return { intent, error: messageForError(0, "") };
  }
}
