import { redirect } from "react-router";
import type { Route } from "./+types/account";
import {
  requestCustomerOtp,
  verifyCustomerOtp,
  fetchCustomerOrders,
  fetchCustomerProfile,
  updateCustomerProfile,
  phoneOtpEnabled,
  type CustomerOrder,
  type CustomerProfile,
} from "../lib/discovery";
import { commitSession, destroySession, getSession } from "../lib/session";
import type { ActionResult } from "../features/account/types";
import { normalizeChannel, safeRedirect } from "../features/account/utils";

export function meta() {
  return [
    { title: "Your account · Xtiitch" },
    {
      name: "description",
      content:
        "Sign in with your phone or email to track your orders and unlock more AI searches across Xtiitch shops.",
    },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const url = new URL(request.url);
  const token = (session.get("customerToken") as string | undefined) ?? null;
  const signedInPhone = (session.get("customerPhone") as string | null) ?? null;

  let orders: CustomerOrder[] = [];
  let profile: CustomerProfile | null = null;
  if (token) {
    [orders, profile] = await Promise.all([
      fetchCustomerOrders(token),
      fetchCustomerProfile(token),
    ]);
  }

  return {
    signedInPhone,
    redirectTo: safeRedirect(url.searchParams.get("redirectTo")),
    orders,
    profile,
  };
}

export async function action({ request }: Route.ActionArgs) { // eslint-disable-line complexity -- route action/loader with many conditional branches; refactor in follow-up
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "signout") {
    const session = await getSession(request.headers.get("Cookie"));
    return redirect("/account", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }

  if (intent === "update_profile") {
    const session = await getSession(request.headers.get("Cookie"));
    const token = session.get("customerToken") as string | undefined;
    if (!token) {
      return redirect("/account");
    }
    const updated = await updateCustomerProfile(token, {
      display_name: String(form.get("display_name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      whatsapp_phone: String(form.get("whatsapp_phone") ?? "").trim(),
    });
    return {
      step: "identify",
      profileSaved: Boolean(updated),
      profileError: updated
        ? undefined
        : "We couldn't save your profile. Please try again.",
    } as ActionResult;
  }

  // The channel tabs (WhatsApp | Email) re-render the sign-in form pre-selected
  // on the chosen channel, with no client JS.
  if (intent === "switch") {
    return {
      step: "identify",
      channel: normalizeChannel(form.get("channel")),
    } as ActionResult;
  }

  if (intent === "request") {
    let channel = normalizeChannel(form.get("channel"));
    // Server-side backstop: the phone (SMS) tab is disabled in the UI when no
    // phone-OTP channel is configured, but a stale render or a bfcache/back-
    // forward-restored document can still POST channel=whatsapp. Re-check the live
    // flag and fall back to email so we never mint a phone code that would never
    // be delivered. Matches the API's buildCustomerOTPDelivery condition (SMS or
    // WhatsApp).
    if (channel === "whatsapp" && !(await phoneOtpEnabled())) {
      channel = "email";
    }
    const identifier = String(form.get("identifier") ?? "").trim();
    if (!identifier) {
      return {
        step: "identify",
        channel,
        error:
          channel === "email"
            ? "Enter your email address."
            : "Enter your phone number.",
      } as ActionResult;
    }
    // The API returns 202 for any identifier (registered or not) to avoid
    // enumeration, so a false here means the code genuinely failed to send
    // (provider error) — not "unknown identifier". Surface it instead of sending
    // the user to a code screen where nothing will ever arrive.
    const sent = await requestCustomerOtp(identifier, channel);
    if (!sent) {
      return {
        step: "identify",
        channel,
        error:
          "We couldn't send your code right now. Please try again in a moment.",
      } as ActionResult;
    }
    return { step: "verify", channel, identifier } as ActionResult;
  }

  if (intent === "verify") {
    const channel = normalizeChannel(form.get("channel"));
    const identifier = String(form.get("identifier") ?? "").trim();
    const code = String(form.get("code") ?? "").trim();
    const result = await verifyCustomerOtp(identifier, code, channel);
    if (!result.ok) {
      const error =
        result.status === 401
          ? "That code is incorrect or has expired."
          : result.status === 429
            ? "Too many attempts — request a fresh code."
            : "We couldn't verify that code. Please try again.";
      return { step: "verify", channel, identifier, error } as ActionResult;
    }
    const session = await getSession(request.headers.get("Cookie"));
    session.set("customerToken", result.token);
    // The account header shows whichever identity the customer signed in with.
    // Email-only customers have no phone, so fall back to the email/identifier.
    session.set("customerPhone", result.phone || result.email || identifier);
    return redirect(
      safeRedirect(String(form.get("redirectTo") ?? "/account")),
      {
        headers: { "Set-Cookie": await commitSession(session) },
      },
    );
  }

  return { step: "identify" } as ActionResult;
}

export { default } from "../features/account/account-page";
