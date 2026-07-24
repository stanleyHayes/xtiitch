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
  // §3.1: Paystack's own fee on the transactions, as reported by Paystack —
  // displayed branded as "Transaction fee" (§4.5), never "Paystack fee".
  paystack_fee_minor: number;
  // §3.1: the Xtiitch fee taken per design sold, split from its tax.
  xtiitch_fee_minor: number;
  xtiitch_tax_minor: number;
  // Kept meaning: the Xtiitch fee + its tax combined.
  commission_minor: number;
  settled_payouts_minor: number;
  manual_takings_minor: number;
  offline_commission_due_minor: number;
  // §3.1: total money the store has made with Xtiitch since joining.
  all_time_income_minor: number;
  // §3.1: the amount due for payout — rises with sales, drops in real time
  // when a payout settles (§3.3).
  net_income_minor: number;
};

export type MoneyPeriod =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_month"
  | "last_month"
  | "all_time"
  | "custom";

export type MoneyTransaction = {
  payment_id: string;
  order_id: string;
  reference: string;
  purpose: string;
  method: string;
  amount_minor: number;
  design_cost_minor: number;
  paystack_fee_minor: number;
  xtiitch_fee_minor: number;
  xtiitch_tax_minor: number;
  take_home_minor: number;
  design_title: string;
  customer_name: string;
  created_at: string;
};

// §3.3 payout history row: one mirrored Paystack settlement to the store's
// MoMo subaccount (automatic T+1 cycle, §4.10).
export type MoneyPayout = {
  settlement_id: string;
  reference: string;
  amount_minor: number;
  status: string;
  settled_at: string;
  created_at: string;
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
