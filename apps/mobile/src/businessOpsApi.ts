// Business-operations client: money, bookings and availability. Shares the
// request wrapper from businessApi so every call gets the same Bearer +
// silent-refresh handling. Contracts verified against
// apps/api/internal/adapters/inbound/http/{payments,booking,availability}.
import { request } from "./businessApi";

// ---- Money (payments/handler.go) -------------------------------------------

// Money period filter shared by the summary / transactions / takings /
// payouts reads. "custom" reads the inclusive from/to date bounds; any other
// value (including "all_time") is unbounded server-side.
export type MoneyPeriod =
  | "all_time"
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_month"
  | "last_month"
  | "custom";

export type MoneyQuery = {
  period?: MoneyPeriod;
  from?: string; // YYYY-MM-DD, only read when period is "custom"
  to?: string;
};

function moneyQueryString(query?: MoneyQuery): string {
  if (!query?.period) return "";
  const params = new URLSearchParams({ period: query.period });
  if (query.period === "custom") {
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
  }
  return `?${params.toString()}`;
}

// All amounts are int64 minor units (pesewas), never null.
export type MoneySummary = {
  through_platform_minor: number;
  paystack_fee_minor: number;
  xtiitch_fee_minor: number;
  xtiitch_tax_minor: number;
  commission_minor: number;
  settled_payouts_minor: number;
  manual_takings_minor: number;
  offline_commission_due_minor: number;
  all_time_income_minor: number;
  net_income_minor: number;
};

export type MoneyTransaction = {
  payment_id: string;
  // Empty string (NOT null) when the payment has no order attached.
  order_id: string;
  reference: string;
  purpose: string; // standard_full | deposit | balance | booking_deposit | cart_full
  method: string; // momo | card
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

export type LogTakingInput = {
  order_id?: string;
  amount_minor: number;
  method: "cash" | "momo" | "other"; // the API has no "card" taking
  what_for: string;
};

export type MoneyPayout = {
  settlement_id: string;
  reference: string;
  amount_minor: number;
  status: string;
  // Empty string (NOT null) until the payout settles.
  settled_at: string;
  created_at: string;
};

// ---- Bookings (booking/handler.go) -----------------------------------------

export type BookingSummary = {
  booking_id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  design_title: string;
  slot_start: string;
  slot_end: string;
  // held | booked | completed | cancelled | rescheduled
  status: string;
  address: string;
};

// ---- Availability (availability/handler.go) --------------------------------

export type AvailabilityWindow = {
  weekday: number; // 0–6, meaningful for "weekly"
  start_minute: number; // minutes from midnight
  end_minute: number;
  slot_minutes: number;
  recurrence: string; // daily | weekly | monthly | ongoing | date
  day_of_month: number; // 0 = unset (only meaningful for "monthly")
  // Key omitted when unset — present only for recurrence "date" (YYYY-MM-DD).
  specific_date?: string;
};

export const businessOpsApi = {
  profile: () =>
    request<{
      name: string;
      handle: string;
      verification_status: string;
      payout_ready: boolean;
      settlement_bank: string;
      settlement_account: string;
      settlement_account_name: string;
      plan: string;
    }>("/businesses/me"),
  requestPayoutOTP: (settlementAccount: string) =>
    request<null>("/businesses/me/payout-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settlement_account: settlementAccount }),
    }),
  savePayout: (input: {
    settlement_bank: string;
    settlement_account: string;
    settlement_account_name: string;
    otp_code: string;
  }) =>
    request<{ payout_status: string }>("/businesses/me/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  moneySummary: (query?: MoneyQuery) =>
    request<MoneySummary>(`/money/summary${moneyQueryString(query)}`),
  moneyTransactions: (query?: MoneyQuery) =>
    request<{ transactions: MoneyTransaction[] }>(
      `/money/transactions${moneyQueryString(query)}`,
    ),
  moneyTakings: (query?: MoneyQuery) =>
    request<{ takings: ManualTaking[] }>(
      `/money/takings${moneyQueryString(query)}`,
    ),
  moneyPayouts: (query?: MoneyQuery) =>
    request<{ payouts: MoneyPayout[] }>(
      `/money/payouts${moneyQueryString(query)}`,
    ),
  // Log a cash / offline sale so the books are complete (201).
  logTaking: (input: LogTakingInput) =>
    request<{
      taking_id: string;
      commission_minor: number;
      commission_status: string;
    }>("/money/takings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  bookings: () => request<{ bookings: BookingSummary[] }>("/bookings"),
  cancelBooking: (bookingId: string) =>
    request<{ status: string }>(
      `/bookings/${encodeURIComponent(bookingId)}/cancel`,
      { method: "POST" },
    ),
  // 409 slot_unavailable when the replacement slot is taken.
  rescheduleBooking: (bookingId: string, slotStart: string) =>
    request<{ status: string }>(
      `/bookings/${encodeURIComponent(bookingId)}/reschedule`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_start: slotStart }),
      },
    ),
  availabilityWindows: () =>
    request<{ windows: AvailabilityWindow[] }>("/availability"),
  // Replaces the studio's full window set with the provided list.
  defineAvailabilityWindows: (windows: AvailabilityWindow[]) =>
    request<{ windows: number }>("/availability/windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows }),
    }),
  // The server defaults the range to [now, now+14d] when from/to are omitted
  // and caps it at 28 days, so pass the full window explicitly — otherwise
  // blackouts more than 14 days out vanish from the list.
  availabilityBlackouts: () => {
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 27 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return request<{ dates: string[] }>(
      `/availability/blackouts?${params.toString()}`,
    );
  },
  addBlackout: (date: string) =>
    request<{ date: string }>("/availability/blackouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    }),
  removeBlackout: (date: string) =>
    request<{ date: string }>(
      `/availability/blackouts/${encodeURIComponent(date)}`,
      { method: "DELETE" },
    ),
};

// Human labels for the money period filter chips.
export const MONEY_PERIOD_LABELS: Record<MoneyPeriod, string> = {
  all_time: "All time",
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  this_month: "This month",
  last_month: "Last month",
  custom: "Custom",
};

// Render a payment purpose code as a short label (money transactions list).
export function paymentPurposeLabel(purpose: string): string {
  switch (purpose) {
    case "standard_full":
      return "Full payment";
    case "deposit":
      return "Deposit";
    case "balance":
      return "Balance";
    case "booking_deposit":
      return "Booking deposit";
    case "cart_full":
      return "Basket payment";
    default:
      return purpose.replace(/_/g, " ");
  }
}
