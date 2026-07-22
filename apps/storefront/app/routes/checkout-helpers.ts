import { api } from "../lib/api";
import type { CartOrderLine, CheckoutQuote } from "../lib/api";
import type { CartItem } from "../lib/cart";

// Paying requires a verified customer session. Guests return to the same
// checkout URL, keeping the selected store and cart intact.
export function signInRedirect(url: URL): string {
  return `/account?redirectTo=${encodeURIComponent("/checkout" + url.search)}`;
}

// Pick the requested store, or the sole store in a single-store basket.
export function resolveCheckoutStore(url: URL, stores: string[]): string {
  const requested = url.searchParams.get("store") ?? "";
  if (requested) return requested;
  return stores.length === 1 ? (stores[0] ?? "") : "";
}

// Map quantity-bearing cookie lines onto the repeated wire shape shared by the
// cart-order and quote endpoints.
export function cartOrderLines(items: CartItem[]): CartOrderLine[] {
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

export async function fetchQuote(
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

// Verify Paystack's callback reference before deciding whether checkout may
// clear the cart, wait, or offer a retry.
export async function paymentReturnState(
  reference: string,
  storeHandle: string,
  tenant: string | null,
): Promise<"succeeded" | "pending" | "retry" | "unconfirmed" | null> {
  if (!reference) return null;
  const verification = await api
    .verifyPayment(storeHandle, reference, tenant)
    .catch(() => null);
  if (!verification?.ok) return "unconfirmed";
  if (verification.result.status === "succeeded") return "succeeded";
  return verification.result.status === "pending" ? "pending" : "retry";
}
