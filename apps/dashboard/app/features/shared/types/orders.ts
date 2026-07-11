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

export type SizeChartItem = {
  name: string;
  value: string;
  unit: string;
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

export type OrderFilter =
  | "all"
  | "standard"
  | "custom"
  | "draft"
  | "confirmed"
  | "fulfilled";
