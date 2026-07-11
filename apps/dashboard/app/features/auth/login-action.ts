import { data, redirect } from "react-router";
import type { Route } from "../../routes/+types/login";
import { fetchApi } from "../../lib/api-base";
import { commitSession, getSession } from "../../lib/session";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "login");
  const session = await getSession(request.headers.get("Cookie"));

  // Second factor: the password stage already issued a challenge; redeem it
  // together with the authenticator/backup code for a full session.
  if (intent === "mfa") {
    const code = String(form.get("code") ?? "").trim();
    const challenge = session.get("mfaChallenge");
    if (!challenge) {
      // Drop any stale challenge reference and fall back to the password form.
      session.unset("mfaChallenge");
      return data(
        { error: "Your verification step expired. Please sign in again." },
        { headers: { "Set-Cookie": await commitSession(session) } },
      );
    }
    let response: Response;
    try {
      response = await fetchApi("/auth/business/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_challenge_token: challenge, code }),
      });
    } catch {
      return {
        error: "Dashboard API is unavailable. Try again after a moment.",
        mfaRequired: true,
      };
    }
    if (!response.ok) {
      return {
        error: "That code didn't match. Try again, or use a backup code.",
        mfaRequired: true,
      };
    }
    const verified = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };
    session.set("access", verified.access_token);
    session.set("refresh", verified.refresh_token);
    session.unset("mfaChallenge");
    return redirect("/dashboard", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  // WhatsApp sign-in, step one: ask the API to send a one-time code. The request
  // endpoint is opaque (always 202) so we never reveal whether the account/number
  // exists — we always advance to the code step, even on a network fault.
  if (intent === "otp-request") {
    const businessHandle = String(form.get("business_handle") ?? "").trim();
    const whatsappNumber = String(form.get("whatsapp_number") ?? "").trim();
    try {
      await fetchApi("/auth/business/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_handle: businessHandle,
          whatsapp_number: whatsappNumber,
        }),
      });
    } catch {
      // Swallow: the opaque contract means we advance regardless; the user can
      // retry the code step (which resends) if nothing arrives.
    }
    return { otpSent: true };
  }

  // WhatsApp sign-in, step two: redeem the code for a session. Mirrors the
  // password path — on an MFA-enabled account we stash the challenge and hand
  // off to the shared second-factor form; otherwise we set the session tokens.
  if (intent === "otp-verify") {
    const businessHandle = String(form.get("business_handle") ?? "").trim();
    const whatsappNumber = String(form.get("whatsapp_number") ?? "").trim();
    const code = String(form.get("code") ?? "").trim();
    let response: Response;
    try {
      response = await fetchApi("/auth/business/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_handle: businessHandle,
          whatsapp_number: whatsappNumber,
          code,
        }),
      });
    } catch {
      return {
        error: "Dashboard API is unavailable. Try again after a moment.",
        otpSent: true,
      };
    }
    if (!response.ok) {
      return {
        error: "That code didn't match. Request a new code and try again.",
        otpSent: true,
      };
    }
    const body = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      mfa_required?: boolean;
      mfa_challenge_token?: string;
    };
    // MFA-enabled account: stash the challenge and prompt for the second factor,
    // identical to the password path above.
    if (body.mfa_required && body.mfa_challenge_token) {
      session.set("mfaChallenge", body.mfa_challenge_token);
      return data(
        { mfaRequired: true },
        { headers: { "Set-Cookie": await commitSession(session) } },
      );
    }
    session.set("access", body.access_token ?? "");
    session.set("refresh", body.refresh_token ?? "");
    return redirect("/dashboard", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const handle = String(form.get("handle") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  let response: Response;
  try {
    response = await fetchApi("/auth/business/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_handle: handle,
        owner_email: email,
        owner_password: password,
      }),
    });
  } catch {
    return {
      error: "Dashboard API is unavailable. Try again after a moment.",
    };
  }
  if (!response.ok) {
    return {
      error:
        "Those details didn't match. Check your store handle, email and password.",
    };
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    mfa_required?: boolean;
    mfa_challenge_token?: string;
  };

  // MFA-enabled account: stash the challenge and prompt for the second factor.
  if (body.mfa_required && body.mfa_challenge_token) {
    session.set("mfaChallenge", body.mfa_challenge_token);
    return data(
      { mfaRequired: true },
      { headers: { "Set-Cookie": await commitSession(session) } },
    );
  }

  session.set("access", body.access_token ?? "");
  session.set("refresh", body.refresh_token ?? "");

  return redirect("/dashboard", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
