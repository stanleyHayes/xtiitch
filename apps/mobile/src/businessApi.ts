// Authenticated business-surface client. Every call goes through authedFetch,
// which handles the Bearer header and one silent token refresh. A
// session_expired result means the caller should route back to login.
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

async function get<T>(path: string): Promise<AuthedResult<T>> {
  try {
    const response = await authedFetch(path);
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

export const businessApi = {
  me: () => get<BusinessProfile>("/auth/business/me"),
  orders: () => get<{ orders: BusinessOrder[] }>("/orders"),
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
