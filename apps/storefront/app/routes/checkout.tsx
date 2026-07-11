import { redirect } from "react-router";
import type { Route } from "./+types/checkout";
import { api } from "../lib/api";
import {
  cartTotalMinor,
  clearStoreItems,
  getCart,
  itemsForStore,
  storeHandlesInCart,
  type CartItem,
} from "../lib/cart";
import { getSession } from "../lib/session";
import { fetchCustomerProfile } from "../lib/discovery";
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

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Checkout · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { items: allItems } = await getCart(request);
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
  // §4: settle ONE store's basket lines per charge. Resolve the store and filter
  // to its items; a multi-store basket with no store chosen goes back to the cart
  // to pick a shop to check out.
  const storeHandle = resolveCheckoutStore(url, storeHandlesInCart(allItems));
  const items = storeHandle ? itemsForStore(allItems, storeHandle) : [];
  if (items.length === 0) {
    return redirect("/cart");
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
    const page = await api.deliveryZones(storeHandle);
    zones = page?.zones ?? [];
  }
  return {
    storeHandle,
    items,
    totalMinor: cartTotalMinor(items),
    zones,
    profile,
  };
}

export async function action({ request }: Route.ActionArgs) { // eslint-disable-line complexity -- route action/loader with many conditional branches; refactor in follow-up
  const form = await request.formData();
  const url = new URL(request.url);
  const { items: allItems } = await getCart(request);
  if (allItems.length === 0) {
    return redirect("/cart");
  }
  // §3b: enforce the account gate on submit too, so a direct POST without a
  // verified session cannot place an order past the loader redirect.
  const session = await getSession(request.headers.get("Cookie"));
  if (!session.get("customerToken")) {
    return redirect(signInRedirect(url));
  }
  // §4: settle exactly one store's lines (same resolution as the loader).
  const storeHandle = resolveCheckoutStore(url, storeHandlesInCart(allItems));
  const items = storeHandle ? itemsForStore(allItems, storeHandle) : [];
  if (items.length === 0) {
    return redirect("/cart");
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
  const deliveryZoneID = String(form.get("delivery_zone_id") ?? "").trim();
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

  // Clear only this store's lines on success; any other stores stay in the basket.
  const startedHeaders = {
    "Set-Cookie": await clearStoreItems(request, storeHandle),
  };
  const failed = {
    error: "We couldn't start that payment. Check your details and try again.",
  };

  // Pickup + a single ready-made piece: the proven single-order checkout. A
  // lone bespoke deposit has no size band, so it must not take this path — it
  // falls through to the group charge below, which settles the deposit.
  const only = items[0];
  if (
    fulfilment !== "delivery" &&
    items.length === 1 &&
    only &&
    only.kind === "made_to_wear"
  ) {
    const response = await api.placeOrder(storeHandle, {
      design_handle: only.design_handle,
      size_band_id: only.size_band_id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_whatsapp: customerWhatsApp,
      customer_email: customerEmail,
      method: "momo",
      note: only.note || undefined,
    });
    if (!response.ok) {
      return failed;
    }
    if (response.result.authorization_url) {
      return redirect(response.result.authorization_url, {
        headers: startedHeaders,
      });
    }
    return redirect(`/track/${response.result.order_id}`, {
      headers: startedHeaders,
    });
  }

  // Everything else (several pieces, or delivery): one combined Paystack charge
  // across the cart. Each piece becomes its own order in a checkout group; the
  // single payment's webhook confirms them all. A chosen delivery zone adds its
  // fee to the charge.
  const response = await api.placeCartOrder(storeHandle, {
    items: items.map((item: CartItem) => ({
      design_handle: item.design_handle,
      size_band_id: item.size_band_id,
      kind: item.kind,
      size_mode: item.size_mode,
      measurements: item.measurements,
      note: item.note || undefined,
    })),
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
  });
  if (!response.ok) {
    return failed;
  }
  if (response.result.authorization_url) {
    return redirect(response.result.authorization_url, {
      headers: startedHeaders,
    });
  }
  return redirect(`/track/${response.result.order_id}`, {
    headers: startedHeaders,
  });
}

export default function CheckoutRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return <Checkout {...loaderData} actionData={actionData} />;
}
