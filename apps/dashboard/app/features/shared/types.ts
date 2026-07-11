import type { ReactElement } from "react";
import type { ReactNode } from "react";
import type { DesignVariation } from "../../lib/api";

export type { Design } from "../../lib/api";

export type Profile = {
  name: string;
  handle: string;
  verification_status: string;
  // True once the store has set up payouts (a provisioned settlement account), so
  // it can actually RECEIVE payments. Distinct from verification_status (identity):
  // a store can be identity-verified yet unable to take orders until payouts are
  // set up. Drives the "set up payouts" prompt.
  payout_ready?: boolean;
  plan: string;
  // Resolved plan benefits, e.g. { custom_logo: true }. Drives which storefront
  // customizations the dashboard unlocks; the API enforces the same set.
  entitlements: Record<string, boolean>;
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
  fee_pass_to_buyer: boolean;
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

export type CollectionSummary = {
  collection_id: string;
  name: string;
  theme: string;
  handle: string;
  status: string;
  sequence: number;
};

export type SizeChartItem = {
  name: string;
  value: string;
  unit: string;
};

export type SizeBand = {
  size_band_id: string;
  label: string;
  chart: SizeChartItem[];
  sequence: number;
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

export type OrderSummary = {
  order_id: string;
  design_title: string;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp: string;
  customer_email: string;
  status: string;
  order_type: string;
  size_mode: string;
  channel: string;
  stage_name: string;
  colour: string;
  agreed_total_minor: number | null;
  settled_minor: number;
  payment_status: string;
  payment_purpose: string;
  payment_amount_minor: number | null;
  created_at: string;
};

export type Stage = {
  name: string;
  colour: string;
  // "ready_made" (standard orders) or "bespoke" (custom orders).
  flow: string;
  sequence: number;
};

export type MeasurementField = {
  field_id: string;
  label: string;
  unit: "cm" | "in";
  sequence: number;
  created_at: string;
  updated_at: string;
};

export type MoneySummary = {
  through_platform_minor: number;
  commission_minor: number;
  manual_takings_minor: number;
  offline_commission_due_minor: number;
  net_income_minor: number;
};

export type ManualTaking = {
  taking_id: string;
  amount_minor: number;
  method: string;
  what_for: string;
  commission_bps: number;
  commission_minor: number;
  commission_status: string;
  commission_note: string;
  taken_at: string;
};

export type BookingSummary = {
  booking_id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  design_title: string;
  slot_start: string;
  slot_end: string;
  status: string;
  address: string;
};

export type HandoverSummary = {
  handover_id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  design_title: string;
  method: "pickup" | "delivery" | string;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  courier: string;
  note: string;
  created_at: string;
};

export type NotificationSummary = {
  message_id: string;
  channel: string;
  kind: string;
  recipient: string;
  status: string;
  attempts: number;
  created_at: string;
};

export type AvailabilityWindow = {
  weekday: number;
  start_minute: number;
  end_minute: number;
  slot_minutes: number;
  // How the window repeats: daily / weekly (uses weekday) / monthly (uses
  // day_of_month) / ongoing (every day, no planned end). Older windows default
  // to "weekly".
  recurrence: string;
  day_of_month?: number | null;
  // Present only on recurrence "date" windows — a one-off day's hours ("YYYY-MM-DD").
  specific_date?: string | null;
};

export type RevenueBucket = {
  key: string;
  label: string;
  platform_minor: number;
  manual_minor: number;
  total_minor: number;
  entries: number;
};

export type StageMetric = {
  label: string;
  helper: string;
  count: number;
  tone: string;
};

export type FollowUpItem = {
  id: string;
  title: string;
  helper: string;
  meta: string;
  tone: string;
  href: string;
};

export type DashboardSection =
  | "overview"
  | "tasks"
  | "reports"
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

export type OrderFilter =
  | "all"
  | "standard"
  | "custom"
  | "draft"
  | "confirmed"
  | "fulfilled";

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

export type DesignSizeBandOverride = {
  size_band_id: string;
  label: string | null;
  chart: SizeChartItem[];
  chart_set: boolean;
};

export type DesignExtrasData = {
  variations?: DesignVariation[];
  overrides?: DesignSizeBandOverride[];
  ok?: boolean;
  error?: string;
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