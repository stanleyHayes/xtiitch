import { data, redirect } from "react-router";
import type { Route } from "./+types/checkout";
import { api } from "../lib/api";
import type { CartOrderLine, CheckoutQuote } from "../lib/api";
import {
  cartTotalMinor,
  clearStoreItems,
  getCart,
  itemsForStore,
  setPendingCartPayment,
  storeHandlesInCart,
  type CartItem,
} from "../lib/cart";
import { getSession } from "../lib/session";
import { requestTenant } from "../lib/tenant";
import { fetchCustomerProfile, requestPaymentLink } from "../lib/discovery";
import Checkout from "../features/checkout/Checkout";

// §3b: paying requires a verified customer session. Guests are sent to sign in
// and returned to the same checkout URL (keeping any ?store= selection) with the
// cart intact.
function signInRedirect(url: URL): string {
  return `/account?redirectTo=${encodeURIComponent("/checkout" + url.search)}`;
}

// resolveCheckoutStore picks which store's basket lines this checkout settles:
// the ?store= param, or the sole store when the unified basket has just one.
function resolveCheckoutStore(url: URL, stores: string[]): string {
  const requested = url.searchParams.get("store") ?? "";
  if (requested) {
    return requested;
  }
  return stores.length === 1 ? (stores[0] ?? "") : "";
}

// cartOrderLines maps the basket's cookie lines onto the wire shape the
// cart-orders and checkout-quote endpoints share.
function cartOrderLines(items: CartItem[]): CartOrderLine[] {
  return items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      design_handle: item.design_handle,
      size_band_id: item.size_band_id,
      kind: item.kind,
      size_mode: item.size_mode,
      measurements: item.measurements,
      note: item.note || undefined,
    })),
  );
}

// fetchQuote prices the basket through the read-only checkout-quote endpoint
// (§4.5), so the breakdown the page renders — combined "Transaction fee" line,
// "Tax (VAT)" line, total — comes from the same engine that will charge. A
// failure leaves the quote null and the page falls back to items + delivery.
async function fetchQuote(
  storeHandle: string,
  items: CartItem[],
  deliveryZoneID: string,
  tenant: string | null,
): Promise<CheckoutQuote | null> {
  const response = await api
    .checkoutQuote(
      storeHandle,
      {
        items: cartOrderLines(items),
        ...(deliveryZoneID ? { delivery_zone_id: deliveryZoneID } : {}),
      },
      tenant,
    )
    .catch(() => null);
  return response?.ok ? response.result : null;
}

// paymentReturnState verifies the reference Paystack appended to the checkout
// callback (?reference=...&trxref=...). Only "succeeded" may clear a basket;
// "pending" blocks a second charge, "retry" keeps the exact draft available
// for another attempt, and "unconfirmed" blocks retry until Paystack can be
// reached. All non-success states keep the cart intact.
async function paymentReturnState(
  reference: string,
  storeHandle: string,
  tenant: string | null,
): Promise<"succeeded" | "pending" | "retry" | "unconfirmed" | null> {
  if (!reference) {
    return null;
  }
  const verification = await api
    .verifyPayment(storeHandle, reference, tenant)
    .catch(() => null);
  if (!verification?.ok) {
    return "unconfirmed";
  }
  if (verification.result.status === "succeeded") {
    return "succeeded";
  }
  return verification.result.status === "pending" ? "pending" : "retry";
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Checkout · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// eslint-disable-next-line complexity -- loader resolves cart, tenant, and provider-return states.
export async function loader({ request }: Route.LoaderArgs) {
  const { items: allItems, pendingPayments } = await getCart(request);
  if (allItems.length === 0) {
    return redirect("/cart");
  }
  const url = new URL(request.url);
  // §3b account gate: a verified customer session is required to pay. Guests are
  // redirected to sign in and returned here (store selection preserved); the cart
  // (its own cookie) survives.
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("customerToken") as string | undefined;
  if (!token) {
    return redirect(signInRedirect(url));
  }
  // §5.2: settle ONE store's basket lines per charge. Resolve the store and
  // filter to its items; a multi-store basket with no store chosen goes back
  // to the cart to pick a shop to check out.
  const tenant = requestTenant(request);
  const storeHandle = resolveCheckoutStore(url, storeHandlesInCart(allItems));
  // §6: on a tenant host only that store's basket can be checked out.
  if (tenant && storeHandle !== tenant) {
    return redirect("/cart");
  }
  const items = storeHandle ? itemsForStore(allItems, storeHandle) : [];
  if (items.length === 0) {
    return redirect("/cart");
  }

  // Paystack return: the callback_url (/checkout?store=<handle>) comes back
  // with ?reference=...&trxref=... appended. VERIFY the reference before
  // believing anything — only "succeeded" clears this store's basket lines and
  // shows the success state. "pending"/"failed" (incl. backing out of the
  // Paystack page) keep the cart intact with Pay Now active and a retry
  // banner; a verify error degrades to the same non-trapping state.
  const returnedReference = (
    url.searchParams.get("reference") ??
    url.searchParams.get("trxref") ??
    pendingPayments[storeHandle]?.reference ??
    ""
  ).trim();
  const paymentState = await paymentReturnState(
    returnedReference,
    storeHandle,
    tenant,
  );
  if (paymentState === "succeeded") {
    // NOW the basket settles: clear only this store's lines and render the
    // success state on this page (any other stores stay in the basket).
    return data(
      {
        storeHandle,
        items,
        totalMinor: cartTotalMinor(items),
        zones: [],
        profile: null,
        quote: null,
        paymentState,
      },
      {
        headers: { "Set-Cookie": await clearStoreItems(request, storeHandle) },
      },
    );
  }

  // Prefill the contact fields from the signed-in profile so a verified shopper
  // does not re-type what we already hold.
  const profile = await fetchCustomerProfile(token);
  // Delivery zones are offered when the cart has at least one ready-made piece.
  // Bespoke self-measure deposit lines can pay in the same transaction, but they
  // do not carry delivery fulfilment until the balance/order details are agreed.
  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  let zones: { zone_id: string; name: string; fee_minor: number }[] = [];
  if (hasMadeToWear && storeHandle) {
    // Delivery is optional; an upstream timeout must not trap a shopper who
    // just returned from a failed/abandoned payment. The quote below remains
    // the payment gate and will show its explicit retry state if unavailable.
    const page = await api.deliveryZones(storeHandle, tenant).catch(() => null);
    zones = page?.zones ?? [];
  }
  // §4.5: the pickup quote (no delivery zone) drives the fee lines on first
  // render; choosing a delivery zone re-quotes via the "quote" action intent.
  const pendingDeliveryZoneID =
    pendingPayments[storeHandle]?.delivery_zone_id ?? "";
  const quote = await fetchQuote(
    storeHandle,
    items,
    pendingDeliveryZoneID,
    tenant,
  );
  return {
    storeHandle,
    items,
    totalMinor: cartTotalMinor(items),
    zones,
    profile,
    quote,
    paymentState,
    pendingDeliveryZoneID,
  };
}

// eslint-disable-next-line complexity, max-lines-per-function -- action handles quote, fulfilment, retry, and payment branches.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const url = new URL(request.url);
  const { items: allItems, pendingPayments } = await getCart(request);
  if (allItems.length === 0) {
    return redirect("/cart");
  }
  // §3b: enforce the account gate on submit too, so a direct POST without a
  // verified session cannot place an order past the loader redirect.
  const session = await getSession(request.headers.get("Cookie"));
  const customerToken = session.get("customerToken") as string | undefined;
  if (!customerToken) {
    return redirect(signInRedirect(url));
  }
  // §5.2: settle exactly one store's lines (same resolution as the loader);
  // §6: on a tenant host, only the tenant's own basket.
  const tenant = requestTenant(request);
  const storeHandle = resolveCheckoutStore(url, storeHandlesInCart(allItems));
  if (tenant && storeHandle !== tenant) {
    return redirect("/cart");
  }
  const items = storeHandle ? itemsForStore(allItems, storeHandle) : [];
  if (items.length === 0) {
    return redirect("/cart");
  }

  // Re-quote intent (§4.5): the delivery-zone picker asks for the fee
  // breakdown of the SAME basket with that zone, so the displayed lines and
  // total always match what the charge will ask for.
  const intent = String(form.get("intent") ?? "pay");
  const deliveryZoneID = String(form.get("delivery_zone_id") ?? "").trim();
  if (intent === "quote") {
    const quote = await fetchQuote(storeHandle, items, deliveryZoneID, tenant);
    return { quote, zoneID: deliveryZoneID };
  }

  const callbackURL = `${url.origin}/checkout?store=${encodeURIComponent(storeHandle)}`;
  const failed = {
    error: "We couldn't start that payment. Check your details and try again.",
  };

  // An unchanged cart with an abandoned payment retries the SAME draft order,
  // rather than creating duplicate awaiting-payment orders on every attempt.
  // This runs before form validation because the original order already holds
  // its customer and delivery details.
  const pendingPayment = pendingPayments[storeHandle];
  if (pendingPayment) {
    const verification = await api
      .verifyPayment(storeHandle, pendingPayment.reference, tenant)
      .catch(() => null);
    if (!verification?.ok) {
      return {
        error:
          "We couldn't confirm the previous payment yet. Refresh before trying again.",
      };
    }
    if (verification.result.status === "succeeded") {
      return redirect(
        `/checkout?store=${encodeURIComponent(storeHandle)}&reference=${encodeURIComponent(pendingPayment.reference)}`,
      );
    }
    if (verification.result.status === "pending") {
      return {
        error:
          "Paystack is still confirming the previous payment. We haven't started another charge.",
      };
    }
    const retry = await requestPaymentLink(
      customerToken,
      pendingPayment.order_id,
      callbackURL,
    );
    if (!retry.ok) {
      return failed;
    }
    return redirect(retry.authorizationUrl, {
      headers: {
        "Set-Cookie": await setPendingCartPayment(request, {
          ...pendingPayment,
          reference: retry.reference,
        }),
      },
    });
  }

  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  const customerWhatsApp = String(form.get("customer_whatsapp") ?? "").trim();
  if (!customerName || !customerEmail) {
    return { error: "Add your name and email to check out." };
  }

  const fulfilment = String(form.get("fulfilment") ?? "pickup");
  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  const deliveryAddress = String(form.get("delivery_address") ?? "").trim();
  const gpsLocation = String(form.get("gps_location") ?? "").trim();
  if (fulfilment === "delivery" && !hasMadeToWear) {
    return {
      error:
        "Delivery can be selected when your cart includes a ready-made piece.",
    };
  }
  if (fulfilment === "delivery" && (!deliveryZoneID || !deliveryAddress)) {
    return {
      error: "Choose a delivery area and enter the delivery address.",
    };
  }
  const deliveryDestination =
    fulfilment === "delivery" && gpsLocation
      ? `${deliveryAddress}\nGPS: ${gpsLocation}`
      : deliveryAddress;

  // Pickup + a single ready-made piece: the proven single-order checkout. A
  // lone bespoke deposit has no size band, so it must not take this path — it
  // falls through to the group charge below, which settles the deposit.
  const orderLines = cartOrderLines(items);
  const only = items[0];
  if (
    fulfilment !== "delivery" &&
    orderLines.length === 1 &&
    only &&
    only.kind === "made_to_wear"
  ) {
    const response = await api.placeOrder(
      storeHandle,
      {
        design_handle: only.design_handle,
        size_band_id: only.size_band_id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_whatsapp: customerWhatsApp,
        customer_email: customerEmail,
        method: "momo",
        note: only.note || undefined,
        callback_url: callbackURL,
      },
      tenant,
      customerToken,
    );
    if (!response.ok) {
      return failed;
    }
    if (response.result.authorization_url) {
      return redirect(response.result.authorization_url, {
        headers: {
          "Set-Cookie": await setPendingCartPayment(request, {
            store_handle: storeHandle,
            order_id: response.result.order_id,
            reference: response.result.reference,
            delivery_zone_id: "",
          }),
        },
      });
    }
    return redirect(`/track/${response.result.order_id}`);
  }

  // Everything else (several pieces, or delivery): one combined Paystack charge
  // across the cart. Each piece becomes its own order in a checkout group; the
  // single payment's webhook confirms them all. A chosen delivery zone adds its
  // fee to the charge.
  const response = await api.placeCartOrder(
    storeHandle,
    {
      items: orderLines,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_whatsapp: customerWhatsApp,
      customer_email: customerEmail,
      method: "momo",
      ...(fulfilment === "delivery"
        ? {
            delivery_zone_id: deliveryZoneID,
            delivery_address: deliveryDestination,
          }
        : {}),
      callback_url: callbackURL,
    },
    tenant,
    customerToken,
  );
  if (!response.ok) {
    return failed;
  }
  if (response.result.authorization_url) {
    return redirect(response.result.authorization_url, {
      headers: {
        "Set-Cookie": await setPendingCartPayment(request, {
          store_handle: storeHandle,
          order_id: response.result.order_id,
          reference: response.result.reference,
          delivery_zone_id: fulfilment === "delivery" ? deliveryZoneID : "",
        }),
      },
    });
  }
  return redirect(`/track/${response.result.order_id}`);
}

export default function CheckoutRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return <Checkout {...loaderData} actionData={actionData} />;
}
