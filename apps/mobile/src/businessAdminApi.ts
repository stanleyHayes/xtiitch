// Business-admin client: notifications, design waitlists, team, promotions
// and CRM. Shares the request wrapper from businessApi. Contracts verified
// against apps/api/internal/adapters/inbound/http/{notification,catalogue,
// auth,crm}.
import { request } from "./businessApi";

// ---- Notifications (notification/handler.go) -------------------------------
// Read-only message log — the API has no mark-read endpoint (same constraint
// as the web dashboard panel).
export type NotificationSummary = {
  message_id: string;
  channel: string; // whatsapp | sms
  kind: string; // order_confirmed | order_stage_advanced | handover_dispatched | ...
  recipient: string;
  status: string; // opaque provider/delivery status
  attempts: number;
  created_at: string;
};

// ---- Design waitlists (catalogue/handler_catalogue.go) ---------------------

export type WaitlistEntry = {
  entry_id: string;
  design_id: string;
  design_title: string;
  design_handle: string;
  customer_name: string;
  customer_contact: string;
  note: string;
  status: string; // waiting | notified | closed
  created_at: string;
};

export type WaitlistStatus = "waiting" | "notified" | "closed";

// ---- Team (auth/handler_identity.go) ---------------------------------------

export type BusinessUser = {
  business_user_id: string;
  business_id: string;
  email: string;
  display_name: string;
  phone: string;
  role: string; // owner | admin | staff
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// role "owner" is rejected server-side (single owner) — invite admin/staff.
export type CreateBusinessUserInput = {
  display_name: string;
  email: string;
  phone?: string;
  password: string;
  role: "admin" | "staff";
};

// ⚠️ is_active is a plain bool server-side — omitting it silently deactivates
// the user. Always send the full shape.
export type UpdateBusinessUserInput = {
  display_name: string;
  phone: string;
  role: "admin" | "staff";
  is_active: boolean;
};

// ---- Promotions (catalogue/handler_catalogue.go) ---------------------------

export type PromotionBody = {
  code: string; // uppercase A-Z0-9_-, 3–32 chars (server uppercases)
  title: string;
  description?: string;
  discount_type: "percentage" | "fixed";
  // percentage: basis points 1–10000; fixed: minor units > 0.
  discount_value: number;
  // Required (> 0) when discount_type is "percentage".
  max_discount_minor?: number | null;
  min_spend_minor?: number;
  usage_limit_global?: number | null;
  usage_limit_per_customer?: number | null;
  scope: "store" | "collection" | "design";
  target_collection_id?: string | null;
  target_design_id?: string | null;
  status: "active" | "paused";
  starts_at?: string; // RFC3339, "" = none
  ends_at?: string;
};

export type BusinessPromotion = {
  promotion_id: string;
  business_id: string;
  code: string;
  title: string;
  description: string;
  discount_type: string;
  discount_value: number;
  max_discount_minor: number | null;
  min_spend_minor: number;
  usage_limit_global: number | null;
  usage_limit_per_customer: number | null;
  funding_source: string;
  scope: string;
  target_collection_id: string | null;
  target_design_id: string | null;
  status: string; // active | paused | archived
  starts_at: string | null;
  ends_at: string | null;
  redemption_count: number;
  discount_redeemed_minor: number;
  created_at: string;
  updated_at: string;
};

// ---- CRM (crm/handler.go) --------------------------------------------------
// Plan-gated: crm_level 0 = free, 1 = standard, 2 = growth. Counts/spend are
// explicit null below level 1; tags key is absent below level 2.
export type CrmCustomerRow = {
  customer_id: string;
  name: string;
  phone: string;
  whatsapp: string;
  source: string;
  last_order_at: string | null;
  orders_count: number | null;
  total_spend_minor: number | null;
  tags?: string[];
};

export type CrmCustomerList = {
  crm_level: number;
  total: number;
  limit: number;
  offset: number;
  customers: CrmCustomerRow[];
};

export type CrmCustomerProfile = {
  crm_level: number;
  customer_id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  source: string;
  first_order_at: string | null;
  last_order_at: string | null;
  orders: {
    order_id: string;
    status: string;
    agreed_total_minor: number | null;
    settled_minor: number;
    created_at: string;
  }[];
  measurements: {
    measurement_id: string;
    order_id: string;
    source: string;
    values: Record<string, string>;
    created_at: string;
  }[];
  orders_count: number | null;
  total_spend_minor: number | null;
  note?: string;
  note_updated_at?: string | null;
  tags?: string[];
};

export const businessAdminApi = {
  notifications: () =>
    request<{ notifications: NotificationSummary[] }>("/notifications"),
  waitlistEntries: () => request<{ entries: WaitlistEntry[] }>("/waitlist-entries"),
  updateWaitlistEntry: (entryId: string, status: WaitlistStatus) =>
    request<{ status: string }>(
      `/waitlist-entries/${encodeURIComponent(entryId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    ),
  teamMembers: () => request<{ users: BusinessUser[] }>("/auth/business/users"),
  inviteTeamMember: (input: CreateBusinessUserInput) =>
    request<BusinessUser>("/auth/business/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateTeamMember: (userId: string, input: UpdateBusinessUserInput) =>
    request<BusinessUser>(`/auth/business/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  promotions: () => request<{ promotions: BusinessPromotion[] }>("/promotions"),
  createPromotion: (input: PromotionBody) =>
    request<BusinessPromotion>("/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updatePromotion: (promotionId: string, input: PromotionBody) =>
    request<BusinessPromotion>(
      `/promotions/${encodeURIComponent(promotionId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
  archivePromotion: (promotionId: string) =>
    request<BusinessPromotion>(
      `/promotions/${encodeURIComponent(promotionId)}/archive`,
      { method: "POST" },
    ),
  // Always send limit=200 — the server defaults to 50 and silently truncates
  // larger customer lists (the list screen shows a "showing the first n"
  // footer when total exceeds the page).
  crmCustomers: (query?: string) =>
    request<CrmCustomerList>(
      `/crm/customers?limit=200${query ? `&q=${encodeURIComponent(query)}` : ""}`,
    ),
  crmCustomer: (customerId: string) =>
    request<CrmCustomerProfile>(
      `/crm/customers/${encodeURIComponent(customerId)}`,
    ),
};

// Short human label for a promotion row (list + detail).
export function promotionDiscountLabel(promo: BusinessPromotion): string {
  if (promo.discount_type === "percentage") {
    const pct = promo.discount_value / 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}% off`;
  }
  return `GH₵${(promo.discount_value / 100).toFixed(2)} off`;
}
