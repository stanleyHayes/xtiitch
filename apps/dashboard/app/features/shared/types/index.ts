import type { ReactElement } from "react";
import type { ReactNode } from "react";

export type { Design } from "../../../lib/api";

export * from "./orders";
export * from "./studio";

export type Profile = {
  name: string;
  handle: string;
  verification_status: string;
  // True once the store has set up payouts (a provisioned settlement account), so
  // it can actually RECEIVE payments. Distinct from verification_status (identity):
  // a store can be identity-verified yet unable to take orders until payouts are
  // set up. Drives the "set up payouts" prompt.
  payout_ready?: boolean;
  // The payout details as saved: the network code (MTN / VOD / ATL) and the
  // mobile money number settlements are paid to. Both empty until payouts are set
  // up; settlement_bank is also empty for stores set up before the network was
  // recorded locally, so treat it as "unknown", not "none".
  settlement_bank?: string;
  settlement_account?: string;
  // §2.1: the MoMo-registered wallet name, collected at payout setup and shown
  // on the payout summary. Empty until payouts are set up.
  settlement_account_name?: string;
  plan: string;
  // Resolved plan benefits, e.g. { custom_logo: true }. Drives which storefront
  // customizations the dashboard unlocks; the API enforces the same set.
  entitlements: Record<string, boolean>;
  // §11.1: the NUMERIC plan-matrix rows (analytics/CRM levels, lookback,
  // scheduled reports) — they can never live in the boolean entitlements map.
  // -1 means unlimited; an absent key means the disabled/conservative default.
  // Keys: analytics_level (0-3), analytics_lookback_days, crm_level (0-3),
  // scheduled_reports (0/1/2). Read via the helpers in app/lib/entitlements.
  entitlement_limits?: Record<string, number>;
  // The plan's cap on active designs, straight from the plan. null or absent
  // means unlimited — do NOT coerce it to a number. Admin-editable, so the
  // dashboard must read it rather than infer a cap from the plan name.
  design_limit?: number | null;
  // Per-design caps on images and colour variations; null/absent means
  // unlimited. Same rule as design_limit: read them, never re-derive them from
  // the plan name — the API enforces exactly these numbers.
  image_limit?: number | null;
  variation_limit?: number | null;
};

export type UserRole = "owner" | "admin" | "staff";

export type CurrentUser = {
  business_id: string;
  user_id: string;
  role: UserRole | string;
};

export type BusinessUser = {
  business_user_id: string;
  business_id: string;
  email: string;
  display_name: string;
  phone: string;
  role: UserRole | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreSettings = {
  bespoke_enabled: boolean;
  measurements_enabled: boolean;
  customisation_enabled: boolean;
  collections_enabled: boolean;
  delivery_enabled: boolean;
  dispatch_enabled: boolean;
  // §4.4 pass-down controls, all default false (the owner absorbs the fees).
  // Ticked fees are added to the customer's checkout instead of coming out of
  // the store's share; the Xtiitch fee and the Paystack fee appear there as
  // one combined "Transaction fee" line, the tax as its own line (§4.5).
  fee_pass_xtiitch_fee: boolean;
  fee_pass_tax: boolean;
  fee_pass_paystack_fee: boolean;
  brand_color: string;
  logo_url: string;
  banner_url: string;
  layout_variant: string;
};

export type DeliveryZone = {
  zone_id: string;
  name: string;
  fee_minor: number;
  sequence: number;
  active: boolean;
};

export type WaitlistEntry = {
  entry_id: string;
  design_id: string;
  design_title: string;
  design_handle: string;
  customer_name: string;
  customer_contact: string;
  note: string;
  status: string;
  created_at: string;
};

export type BusinessPromotion = {
  promotion_id: string;
  business_id: string;
  code: string;
  title: string;
  description: string;
  discount_type: "percentage" | "fixed" | string;
  discount_value: number;
  max_discount_minor: number | null;
  min_spend_minor: number;
  usage_limit_global: number | null;
  usage_limit_per_customer: number | null;
  funding_source: string;
  scope: "store" | "collection" | "design" | string;
  target_collection_id: string | null;
  target_design_id: string | null;
  status: "active" | "paused" | "archived" | string;
  starts_at: string | null;
  ends_at: string | null;
  redemption_count: number;
  discount_redeemed_minor: number;
  created_at: string;
  updated_at: string;
};

export type DashboardSection =
  | "overview"
  | "tasks"
  | "reports"
  | "analytics"
  | "customers"
  | "orders"
  | "money"
  | "visits"
  | "handovers"
  | "catalogue"
  | "promotions"
  | "measurements"
  | "availability"
  | "settings"
  | "team"
  | "messages";

export type WorkspaceNavItem = {
  href: string;
  section: DashboardSection;
  label: string;
  helper: string;
  icon: ReactNode;
};

export type WorkspaceNavGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  items: WorkspaceNavItem[];
};

export type DashboardActionData = {
  permissionError?: string;
  orderError?: string;
  designError?: string;
  mediaError?: string;
  fieldError?: string;
  measurementError?: string;
  moneyError?: string;
  bookingError?: string;
  handoverError?: string;
  availabilityError?: string;
  availabilitySuccess?: string;
  teamError?: string;
  settingsError?: string;
  settingsSuccess?: string;
  verificationError?: string;
  verificationSuccess?: string;
  payoutError?: string;
  payoutSuccess?: string;
  collectionError?: string;
  sizeBandError?: string;
  priceError?: string;
  promotionError?: string;
  walkInError?: string;
  // §14/§15: analytics report-schedule and CRM note/tag mutations surface
  // their own feedback so the snackbar can confirm §1.2 resets.
  analyticsError?: string;
  analyticsSuccess?: string;
  crmError?: string;
  crmSuccess?: string;
};

export type DashboardPageMeta = {
  eyebrow: string;
  title: string;
  helper: string;
  icon: ReactNode;
  tone: string;
};

export type DashboardJSONResult<T> = {
  data: T;
  warning: string | null;
};

export type OverviewRoom = {
  title: string;
  helper: string;
  href: string;
  value: string;
  actionLabel: string;
  tone: string;
  icon: ReactNode;
};

export type PriorityRibbonItem = {
  label: string;
  value: number;
  href: string;
  icon: ReactElement;
  tone: string;
};

export type SetupStep = {
  label: string;
  helper: string;
  href: string;
  done: boolean;
  icon: ReactElement;
};

export type UploadSignature = {
  signature: string;
  timestamp: number;
  cloud_name: string;
  api_key: string;
  folder: string;
};

export type CloudinaryUploadResult = {
  secure_url?: string;
  url?: string;
};

export type PromotionFormBody =
  | {
      ok: true;
      body: {
        code: string;
        title: string;
        description: string;
        discount_type: string;
        discount_value: number;
        max_discount_minor: number | null;
        min_spend_minor: number;
        usage_limit_global: number | null;
        usage_limit_per_customer: number | null;
        scope: string;
        target_collection_id: string | null;
        target_design_id: string | null;
        status: string;
        starts_at: string;
        ends_at: string;
      };
    }
  | { ok: false; message: string };
