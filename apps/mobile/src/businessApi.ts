// Authenticated business-surface client. Every call goes through authedFetch,
// which handles the Bearer header and one silent token refresh. A
// session_expired result means the caller should route back to login.
import { type Tracking } from "./api";
import { authedFetch, SessionExpiredError } from "./auth";

export type BusinessProfile = {
  business_id: string;
  user_id: string;
  role: string;
};

export type BusinessOrder = {
  order_id: string;
  design_title: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  agreed_total_minor: number;
  settled_minor: number;
  status: string;
  stage_name: string;
  colour: string;
  channel: string;
  order_type: string;
  created_at: string;
  payment_status: string;
};

export type AuthedResult<T> =
  | { ok: true; data: T }
  | { ok: false; expired: boolean; error: string };

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<AuthedResult<T>> {
  try {
    const response = await authedFetch(path, init);
    if (!response.ok) {
      return { ok: false, expired: false, error: `upstream_${response.status}` };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      return { ok: false, expired: true, error: "session_expired" };
    }
    return { ok: false, expired: false, error: "network_error" };
  }
}

export type CollectBalanceResult = {
  reference: string;
  authorization_url: string;
  amount_minor: number;
};

export type BusinessDesign = {
  design_id: string;
  title: string;
  handle: string;
  status: string;
  images: string[];
};

export type SizeBand = {
  size_band_id: string;
  label: string;
  sequence: number;
};

export type CreateWalkInInput = {
  design_id: string;
  size_band_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  agreed_total_minor?: number;
};

export const businessApi = {
  me: () => request<BusinessProfile>("/auth/business/me"),
  orders: () => request<{ orders: BusinessOrder[] }>("/orders"),
  // Advance an order to its next fulfilment stage. The API returns the updated
  // tracking (current stage + the full ordered stage list).
  advanceOrder: (orderId: string) =>
    request<Tracking>(`/orders/${encodeURIComponent(orderId)}/advance`, {
      method: "POST",
    }),
  // Set/adjust the negotiated total for an order (minor units / pesewas).
  setAgreedTotal: (orderId: string, agreedTotalMinor: number) =>
    request<{ agreed_total_minor: number }>(
      `/orders/${encodeURIComponent(orderId)}/agreed-total`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed_total_minor: agreedTotalMinor }),
      },
    ),
  // Raise a Paystack payment link for the order's outstanding balance.
  collectBalance: (orderId: string, method: "momo" | "card") =>
    request<CollectBalanceResult>(
      `/orders/${encodeURIComponent(orderId)}/balance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      },
    ),
  // The studio's own catalogue + size bands, for composing a walk-in order.
  designs: () => request<{ designs: BusinessDesign[] }>("/designs"),
  sizeBands: () => request<{ size_bands: SizeBand[] }>("/size-bands"),
  // Record an in-person (walk-in) order against one of the studio's designs.
  createWalkIn: (input: CreateWalkInInput) =>
    request<{ order_id: string }>("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
};

const TERMINAL_STATUSES = new Set([
  "completed",
  "delivered",
  "collected",
  "cancelled",
  "canceled",
  "closed",
]);

export function isOrderOpen(order: BusinessOrder): boolean {
  return !TERMINAL_STATUSES.has(order.status.toLowerCase());
}

// Map an order's status to one of the brand tones. The API also returns a
// per-order `colour`, but that is a loose CSS-name hint; this keeps pills on
// the brand palette.
export function orderTone(status: string): string {
  const value = status.toLowerCase();
  if (["completed", "delivered", "collected"].includes(value)) return "#237a4b";
  if (["cancelled", "canceled", "rejected"].includes(value)) return "#a92727";
  if (["pending", "pending_review", "awaiting", "quote"].includes(value)) {
    return "#315f8f";
  }
  if (["confirmed", "preparing", "in_progress", "ready"].includes(value)) {
    return "#b87914";
  }
  return "#800020";
}
