// Authenticated business-surface client. Every call goes through authedFetch,
// which handles the Bearer header and one silent token refresh. A
// session_expired result means the caller should route back to login.
import { type MeasurementField, type Tracking } from "./api";
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
  customer_whatsapp: string;
  // Null for a bespoke order whose total has not been negotiated yet — never
  // render it as GH₵0.00. payment_amount_minor carries the checkout target for
  // online orders, so the effective target is agreed ?? payment (see web
  // dashboard features/orders/utils.ts).
  agreed_total_minor: number | null;
  payment_amount_minor: number | null;
  settled_minor: number;
  status: string;
  stage_name: string;
  colour: string;
  channel: string;
  order_type: string;
  size_mode: string;
  created_at: string;
  payment_status: string;
  payment_purpose: string;
};

export type AuthedResult<T> =
  | { ok: true; data: T }
  | { ok: false; expired: boolean; error: string };

// Shared request wrapper — also used by the sibling businessOpsApi /
// businessAdminApi modules so every business call gets the same Bearer +
// silent-refresh handling and the same result envelope.
export async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<AuthedResult<T>> {
  try {
    const response = await authedFetch(path, init);
    if (!response.ok) {
      return {
        ok: false,
        expired: false,
        error: `upstream_${response.status}`,
      };
    }
    // Several protected command endpoints intentionally return 204. Trying to
    // parse that empty body as JSON converted a successful retire/restore/update
    // into a misleading `network_error` on native clients.
    const data = response.status === 204 ? null : await response.json();
    return { ok: true, data: data as T };
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
  chart?: { name: string; value: string; unit: string }[];
};

export type CreateWalkInInput = {
  design_id: string;
  size_band_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  agreed_total_minor?: number;
};

// Bespoke walk-in (POST /orders/custom). DisallowUnknownFields is on
// server-side — send exactly these keys. measurements maps field_id → value,
// keys must exist in the studio's measurement-fields template.
export type CreateCustomWalkInInput = {
  design_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  measurements?: Record<string, string>;
};

// The studio's production stages (read-only — the API has no stage-management
// endpoints; templates are seeded at registration). flow is "ready_made"
// (standard orders) or "bespoke" (custom orders).
export type Stage = {
  name: string;
  colour: string;
  flow: string;
  sequence: number;
};

// Handover (pickup/delivery) contracts — delivery/handler.go. Statuses:
// pending → dispatched → completed (delivery), pending → completed (pickup),
// or cancelled.
export type HandoverSummary = {
  handover_id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  design_title: string;
  method: "pickup" | "delivery";
  status: string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  courier: string;
  note: string;
  created_at: string;
};

// address is required server-side (400 address_required) when method is
// "delivery"; everything beyond order_id + method is optional for pickup.
export type ArrangeHandoverInput = {
  order_id: string;
  method: "pickup" | "delivery";
  recipient_name?: string;
  recipient_phone?: string;
  address?: string;
  courier?: string;
  note?: string;
};

// The staff-taken measurement routes the API accepts (measurementapp
// SourceVisit/SourceShop). "self_measure" orders arrive with values already.
export type MeasurementSource = "visit" | "shop";

// What POST /orders/{id}/measurements returns (201). values maps field_id to
// the entered string, validated against the studio's template server-side.
export type OrderMeasurement = {
  measurement_id: string;
  order_id: string;
  customer_id: string;
  source: string;
  values: Record<string, string>;
  created_at: string;
  updated_at: string;
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
  createSizeBand: (input: Omit<SizeBand, "size_band_id">) =>
    request<{ size_band_id: string }>("/size-bands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateSizeBand: (id: string, input: Omit<SizeBand, "size_band_id">) =>
    request<null>(`/size-bands/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  deleteSizeBand: (id: string) =>
    request<null>(`/size-bands/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  // The studio's measurement template — the fields the record form renders.
  measurementFields: () =>
    request<{ fields: MeasurementField[] }>("/measurement-fields"),
  createMeasurementField: (input: {
    label: string;
    unit: string;
    sequence: number;
  }) =>
    request<MeasurementField>("/measurement-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateMeasurementField: (
    fieldId: string,
    input: { label: string; unit: string; sequence: number },
  ) =>
    request<MeasurementField>(
      `/measurement-fields/${encodeURIComponent(fieldId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
  deleteMeasurementField: (fieldId: string) =>
    request<{ deleted: boolean }>(
      `/measurement-fields/${encodeURIComponent(fieldId)}`,
      {
        method: "DELETE",
      },
    ),
  // Save staff-taken measurements for a bespoke order. The API requires at
  // least one non-empty value and field IDs from the studio's template.
  recordMeasurements: (
    orderId: string,
    source: MeasurementSource,
    values: Record<string, string>,
  ) =>
    request<OrderMeasurement>(
      `/orders/${encodeURIComponent(orderId)}/measurements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, values }),
      },
    ),
  // Record an in-person (walk-in) order against one of the studio's designs.
  createWalkIn: (input: CreateWalkInInput) =>
    request<{ order_id: string }>("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  // Record a bespoke (made-to-measure) walk-in order, optionally with
  // measurements taken on the spot. 409 order_not_advanceable when the studio
  // has no bespoke stage configured.
  createCustomWalkIn: (input: CreateCustomWalkInInput) =>
    request<{ order_id: string }>("/orders/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  stages: () => request<{ stages: Stage[] }>("/stages"),
  handovers: () => request<{ handovers: HandoverSummary[] }>("/handovers"),
  arrangeHandover: (input: ArrangeHandoverInput) =>
    request<{ handover_id: string; status: string }>("/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  // Advance to the next handover state (pickup: pending→completed; delivery:
  // pending→dispatched→completed). 409 invalid_handover_state when terminal.
  advanceHandover: (
    handoverId: string,
    note?: { courier?: string; note?: string },
  ) =>
    request<{ status: string }>(
      `/handovers/${encodeURIComponent(handoverId)}/advance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note ?? {}),
      },
    ),
  cancelHandover: (handoverId: string) =>
    request<{ status: string }>(
      `/handovers/${encodeURIComponent(handoverId)}/cancel`,
      { method: "POST" },
    ),
};

// The real domain statuses are draft / awaiting_deposit / confirmed /
// fulfilled / cancelled (apps/api/internal/domain/order/order.go). Only the
// last two are terminal.
const TERMINAL_STATUSES = new Set(["fulfilled", "cancelled"]);

export function isOrderOpen(order: BusinessOrder): boolean {
  return !TERMINAL_STATUSES.has(order.status.toLowerCase());
}

// Mirrors the web dashboard's measurementSourceFor (features/orders/utils.ts):
// staff record measurements only for bespoke orders in production whose size
// route is a home visit or a shop appointment.
export function measurementSourceFor(
  order: BusinessOrder,
): MeasurementSource | null {
  if (order.order_type !== "custom" || order.status !== "confirmed") {
    return null;
  }
  if (order.size_mode === "home_visit") {
    return "visit";
  }
  if (order.size_mode === "come_to_shop") {
    return "shop";
  }
  return null;
}

// Map an order's status to one of the brand tones. The API also returns a
// per-order `colour`, but that is a loose CSS-name hint; this keeps pills on
// the brand palette.
export function orderTone(status: string): string {
  switch (status.toLowerCase()) {
    case "fulfilled":
      return "#237a4b";
    case "cancelled":
      return "#a92727";
    case "confirmed":
      return "#b87914";
    case "draft":
    case "awaiting_deposit":
      return "#315f8f";
    default:
      return "#800020";
  }
}

// Human payment-status label, mirroring the web dashboard's paymentLabel
// (apps/dashboard/app/features/orders/utils.ts).
export function paymentStatusLabel(order: BusinessOrder): string {
  if (order.payment_status === "none") {
    return order.channel === "walk_in" || order.size_mode === "come_to_shop"
      ? "Offline arrangement"
      : "No payment";
  }
  switch (order.payment_status) {
    case "succeeded":
      return order.payment_purpose === "deposit" ? "Deposit paid" : "Paid";
    case "initiated":
      return "Payment pending";
    case "failed":
      return "Payment failed";
    case "reversed":
      return "Reversed";
    default:
      return order.payment_status.replace(/_/g, " ");
  }
}

// Short, locale-stable date for order cards (e.g. "18 Jul 2026").
export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
