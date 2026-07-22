import { redirect } from "react-router";
import type { Route } from "./+types/account";
import {
  requestCustomerOtp,
  verifyCustomerOtp,
  fetchCustomerOrders,
  fetchCustomerProfile,
  updateCustomerProfile,
  markOrderReceived,
  markBasketReceived,
  requestPaymentLink,
  phoneOtpEnabled,
  type CustomerOrder,
  type CustomerProfile,
} from "../lib/discovery";
import { api } from "../lib/api";
import { commitSession, destroySession, getSession } from "../lib/session";
import { requestTenant } from "../lib/tenant";
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

  // Return from a "Pay now" payment on a draft order: Paystack appends
  // ?reference=... to the callback (/account?payment=return&store=<handle>).
  // Verify before loading orders so a confirmed payment is already reflected
  // in the statuses rendered below.
  let paymentReturn: "succeeded" | "pending" | "retry" | "unconfirmed" | null =
    null;
  const reference = (
    url.searchParams.get("reference") ??
    url.searchParams.get("trxref") ??
    ""
  ).trim();
  const paidStore = (url.searchParams.get("store") ?? "").trim();
  if (
    token &&
    url.searchParams.get("payment") === "return" &&
    reference &&
    paidStore
  ) {
    const verification = await api
      .verifyPayment(paidStore, reference, requestTenant(request))
      .catch(() => null);
    paymentReturn = verification?.ok
      ? verification.result.status === "succeeded"
        ? "succeeded"
        : verification.result.status === "pending"
          ? "pending"
          : "retry"
      : "unconfirmed";
  }

  // Load orders AFTER verification so a successful return cannot render the
  // stale draft/Pay now state for an order that was just confirmed.
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
    paymentReturn,
    // §6: on a tenant host the account hub hides cross-store entries (AI
    // Search). The customer's own orders stay shared across stores (§5.3.4) —
    // they are their own data, not another store's.
    tenantHost: Boolean(requestTenant(request)),
  };
}

// eslint-disable-next-line complexity -- route action handles account and order workflows.
export async function action({ request }: Route.ActionArgs) {
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

  // §5.3.2: acknowledge receipt of one archived design, or of a whole store
  // basket at once. The loader revalidates after either, so the stamped
  // orders disappear from the tabs on the next render.
  if (intent === "mark_received" || intent === "mark_basket_received") {
    const session = await getSession(request.headers.get("Cookie"));
    const token = session.get("customerToken") as string | undefined;
    if (!token) {
      return redirect("/account");
    }
    const result =
      intent === "mark_received"
        ? await markOrderReceived(token, String(form.get("order_id") ?? ""))
        : await markBasketReceived(
            token,
            String(form.get("checkout_group_id") ?? ""),
          );
    if (!result.ok) {
      // 409 order_not_in_final_stage: the store is still working on it.
      return {
        step: "identify",
        orderError:
          result.error === "order_not_in_final_stage"
            ? "The store is still working on this one — you can mark it received once it reaches its final stage."
            : "We couldn't mark that as received. Please try again.",
      } as ActionResult;
    }
    return {
      step: "identify",
      orderNotice: "Marked as received.",
    } as ActionResult;
  }

  // "Pay now" on a draft ("Awaiting payment") order: mint a fresh Paystack
  // link for the existing draft and send the customer straight to it. The
  // callback comes back here (?payment=return&store=<handle>), where the
  // loader verifies the reference before showing any outcome — no dead
  // "awaiting payment" state, even for drafts older than the current cart.
  if (intent === "pay_order") {
    const session = await getSession(request.headers.get("Cookie"));
    const token = session.get("customerToken") as string | undefined;
    if (!token) {
      return redirect("/account");
    }
    const orderID = String(form.get("order_id") ?? "").trim();
    const storeHandle = String(form.get("store_handle") ?? "").trim();
    const origin = new URL(request.url).origin;
    const callbackURL = `${origin}/account?payment=return&store=${encodeURIComponent(storeHandle)}`;
    const result = await requestPaymentLink(token, orderID, callbackURL);
    if (!result.ok) {
      return {
        step: "identify",
        orderError:
          result.error === "payment_pending"
            ? "Paystack is still confirming the previous payment. We haven't started another charge; refresh shortly."
            : result.status === 409
              ? "That order can no longer be paid online — please call the store about it."
              : "We couldn't start that payment. Please try again.",
      } as ActionResult;
    }
    return redirect(result.authorizationUrl);
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

// React Router injects loaderData/actionData props only into a route module's
// LOCALLY-declared default export, not a bare re-export — wrap the moved
// component so the props are injected here and forwarded on.
import AccountPage from "../features/account/account-page";

export default function AccountRoute(props: Route.ComponentProps) {
  return <AccountPage {...props} />;
}
