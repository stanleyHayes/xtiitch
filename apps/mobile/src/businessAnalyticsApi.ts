import { request } from "./businessApi";

export type AnalyticsSummary = {
  window: { from: string | null; to: string };
  sales_total_minor: number;
  orders_count: number;
  orders_by_status: { status: string; count: number }[];
  customers_count: number;
  designs_count: number;
};
export type SalesPoint = {
  day: string;
  sales_minor: number;
  manual_takings_minor: number;
};
export type TopDesign = {
  design_id: string;
  title: string;
  orders: number;
  revenue_minor: number;
};
export type OrdersPoint = {
  day: string;
  orders: number;
  standard: number;
  bespoke: number;
};
export type CustomersAnalytics = {
  new_customers: number;
  returning_customers: number;
  repeat_rate?: number;
  top_customers?: {
    customer_id: string;
    display_name: string;
    orders: number;
    spend_minor: number;
  }[];
};
export type OutstandingBalance = {
  order_id: string;
  customer_name: string;
  design_title: string;
  outstanding_minor: number;
  status: string;
};
export type RevenueBreakdowns = {
  by_flow: { flow: string; orders: number; revenue_minor: number }[];
  by_fulfilment: { method: string; orders: number; revenue_minor: number }[];
};
export type DesignPerformance = {
  design_id: string;
  title: string;
  views: number;
  orders: number;
  conversion_rate: number;
  waiting_list: number;
};
export type StaffActivity = {
  user_id: string;
  display_name: string;
  role: string;
  orders_created: number;
  takings_logged: number;
  takings_minor: number;
};
export type ReportSchedule = {
  report: string;
  format: string;
  cadence: string;
  email: string;
  enabled: boolean;
  last_sent_at: string | null;
};

export const businessAnalyticsApi = {
  summary: () => request<AnalyticsSummary>("/analytics/summary"),
  salesTrend: () => request<{ points: SalesPoint[] }>("/analytics/sales-trend"),
  topDesigns: () =>
    request<{ designs: TopDesign[]; limit: number }>(
      "/analytics/top-designs?limit=10",
    ),
  ordersTrend: () =>
    request<{ points: OrdersPoint[] }>("/analytics/orders-trend"),
  customers: () => request<CustomersAnalytics>("/analytics/customers"),
  balances: () =>
    request<{
      balances: OutstandingBalance[];
      total_outstanding_minor: number;
    }>("/analytics/outstanding-balances"),
  breakdowns: () => request<RevenueBreakdowns>("/analytics/revenue-breakdowns"),
  designPerformance: () =>
    request<{ designs: DesignPerformance[] }>("/analytics/design-performance"),
  staff: () => request<{ staff: StaffActivity[] }>("/analytics/staff"),
  reportSchedule: () =>
    request<{ schedule: ReportSchedule }>("/reports/schedule"),
  saveReportSchedule: (schedule: ReportSchedule) =>
    request<{ schedule: ReportSchedule }>("/reports/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    }),
};
