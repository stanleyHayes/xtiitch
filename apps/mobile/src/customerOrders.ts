// Customer order model + order actions (pay-now, close, mark-received).
// Split from customerAuth.ts for the file-size budget; customerAuth re-exports
// everything here so existing imports from "./customerAuth" keep working.
// Contracts verified against
// apps/api/internal/adapters/inbound/http/customerauth/handler.go.
import { authedFetch, CustomerSessionExpiredError } from "./customerAuth";

export type CustomerOrder = {
  order_id: string;
  business_name: string;
  business_handle: string;
  // May be "" when the owner has no phone/WhatsApp on file — hide the
  // call-store shortcut then.
  store_phone: string;
  design_title: string;
  // Open string, NOT a closed enum: beyond draft / awaiting_deposit /
  // confirmed / fulfilled / cancelled the API can return business-set
  // statuses — always compare against a set, case-insensitively.
  status: string;
  kind: "standard" | "bespoke";
  // Non-null when the order is part of a multi-line store basket.
  checkout_group_id: string | null;
  agreed_total_minor: number;
  created_at: string;
  // Set once the customer acknowledges receipt; such orders are archived.
  received_at: string | null;
};

// Statuses the web storefront treats as final-stage (lib/orders.ts) — the
// "Mark received" action is stage-based, not status-based server-side.
const FINAL_STAGE_STATUSES = new Set([
  "completed",
  "delivered",
  "fulfilled",
  "handed_over",
]);

// "Pay now" is only meaningful on drafts — the server additionally requires
// an outstanding amount, not closed, < 24h old; handle 409 order_not_payable
// as "no longer payable".
export function isPayableDraft(order: CustomerOrder): boolean {
  return order.status.toLowerCase() === "draft" && order.received_at === null;
}

// Eligible for "Mark received": final stage and not already acknowledged.
export function canMarkReceived(order: CustomerOrder): boolean {
  return (
    FINAL_STAGE_STATUSES.has(order.status.toLowerCase()) &&
    order.received_at === null
  );
}

// One shared outcome envelope for the actions below — the caller renders
// `error` verbatim when ok is false.
export type ActionOutcome = { ok: true } | { ok: false; error: string };

async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error ?? fallback;
}

export async function fetchCustomerOrders(): Promise<CustomerOrder[]> {
  const response = await authedFetch("/customer/orders");
  // A non-OK must NOT masquerade as an empty list ("No orders yet") — throw so
  // the caller renders its retryable error state. CustomerSessionExpiredError
  // from authedFetch still propagates unchanged.
  if (!response.ok) throw new Error("orders_load_failed");
  const body = (await response.json()) as { orders?: CustomerOrder[] };
  return body.orders ?? [];
}

// Raise a fresh Paystack link for a DRAFT order's outstanding amount. The
// caller opens authorization_url in the browser. 409 order_not_payable means
// the draft aged out or is already covered; 409 payment_pending means a prior
// attempt is still settling.
export async function requestOrderPaymentLink(
  orderId: string,
): Promise<
  | { ok: true; authorization_url: string; reference: string }
  | { ok: false; error: string }
> {
  try {
    const response = await authedFetch(
      `/customer/orders/${encodeURIComponent(orderId)}/payment-link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (!response.ok) {
      const code = await readError(response, "");
      return {
        ok: false,
        error:
          code === "payment_pending"
            ? "A payment for this order is still processing — check back shortly."
            : code === "order_not_payable"
              ? "This order can no longer be paid online — contact the store."
              : "Could not start the payment. Please try again.",
      };
    }
    return {
      ok: true,
      ...((await response.json()) as {
        authorization_url: string;
        reference: string;
      }),
    };
  } catch (error) {
    if (error instanceof CustomerSessionExpiredError) throw error;
    return {
      ok: false,
      error: "Network error — check your connection and retry.",
    };
  }
}

// Close (abandon) a draft order. Closing a basket order closes the whole
// basket server-side.
export async function closeOrder(orderId: string): Promise<ActionOutcome> {
  return postOrderAction(
    `/customer/orders/${encodeURIComponent(orderId)}/close`,
    "This order can no longer be closed.",
  );
}

// Acknowledge receipt of a finished order (idempotent server-side).
export function markOrderReceived(orderId: string): Promise<ActionOutcome> {
  return postOrderAction(
    `/customer/orders/${encodeURIComponent(orderId)}/received`,
    "The store has not marked this order as complete yet.",
  );
}

// Basket variant: mark every line of a multi-order checkout received at once.
export async function markBasketReceived(
  checkoutGroupId: string,
): Promise<ActionOutcome> {
  try {
    const response = await authedFetch("/customer/orders/received-basket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout_group_id: checkoutGroupId }),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: await readError(
          response,
          "The store has not marked this basket as complete yet.",
        ),
      };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof CustomerSessionExpiredError) throw error;
    return {
      ok: false,
      error: "Network error — check your connection and retry.",
    };
  }
}

async function postOrderAction(
  path: string,
  fallback: string,
): Promise<ActionOutcome> {
  try {
    const response = await authedFetch(path, { method: "POST" });
    if (!response.ok) {
      return { ok: false, error: await readError(response, fallback) };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof CustomerSessionExpiredError) throw error;
    return {
      ok: false,
      error: "Network error — check your connection and retry.",
    };
  }
}
