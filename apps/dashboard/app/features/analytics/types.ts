// §14 analytics response shapes, mirrored field-for-field from the deployed
// API (apps/api/internal/adapters/inbound/http/analytics/handler.go and
// .../reports/handler.go). All money is GHS pesewas (minor units) — format
// only through lib/format's formatGHS.

export type AnalyticsWindow = {
  // null for full-history plans (Growth/Studio without a custom range).
  from: string | null;
  to: string;
};

export type OrderStatusCount = {
  status: string;
  count: number;
};

// GET /v1/analytics/summary — every plan (§14.1 "Totals").
export type AnalyticsSummary = {
  window: AnalyticsWindow;
  sales_total_minor: number;
  orders_count: number;
  orders_by_status: OrderStatusCount[];
  customers_count: number;
  designs_count: number;
};

// GET /v1/analytics/sales-trend (Starter+): per-day points.
export type SalesTrendPoint = {
  day: string;
  sales_minor: number;
  manual_takings_minor: number;
};

// GET /v1/analytics/orders-trend (Starter+): the standard-vs-bespoke split.
export type OrdersTrendPoint = {
  day: string;
  orders: number;
  standard: number;
  bespoke: number;
};

// GET /v1/analytics/top-designs (Starter+; Starter pinned to 5 by the API).
export type TopDesignRow = {
  design_id: string;
  title: string;
  orders: number;
  revenue_minor: number;
};

export type TopCustomerRow = {
  customer_id: string;
  display_name: string;
  phone: string;
  orders: number;
  spend_minor: number;
  last_order_at: string;
};

export type CustomerGrowthPoint = {
  month: string;
  new_customers: number;
};

// GET /v1/analytics/customers (Starter+). repeat_rate / top_customers /
// growth are only present at full+ (Growth) — the API omits them below.
export type CustomersAnalytics = {
  window: AnalyticsWindow;
  analytics_level: number;
  new_customers: number;
  returning_customers: number;
  repeat_rate?: number;
  top_customers?: TopCustomerRow[];
  growth?: CustomerGrowthPoint[];
};

// GET /v1/analytics/outstanding-balances (Starter+) — bespoke money still owed.
export type OutstandingBalanceRow = {
  order_id: string;
  customer_name: string;
  design_title: string;
  status: string;
  agreed_total_minor: number;
  settled_minor: number;
  outstanding_minor: number;
  created_at: string;
};

export type RevenueBreakdownRow = {
  orders: number;
  revenue_minor: number;
};

// GET /v1/analytics/revenue-breakdowns (Growth+): four lenses on the same
// revenue. Keys differ per lens (design/title, collection/name, flow, method).
export type RevenueBreakdowns = {
  window: AnalyticsWindow;
  by_design: (RevenueBreakdownRow & {
    design_id: string;
    title: string;
  })[];
  by_collection: (RevenueBreakdownRow & {
    collection_id: string | null;
    name: string;
  })[];
  by_flow: (RevenueBreakdownRow & { flow: string })[];
  by_fulfilment: (RevenueBreakdownRow & { method: string })[];
};

// GET /v1/analytics/design-performance (Growth+).
export type DesignPerformanceRow = {
  design_id: string;
  title: string;
  views: number;
  orders: number;
  conversion_rate: number;
  waiting_list: number;
};

// GET /v1/analytics/staff (Studio only).
export type StaffActivityRow = {
  user_id: string;
  display_name: string;
  role: string;
  is_active: boolean;
  orders_created: number;
  takings_logged: number;
  takings_minor: number;
};

// GET/PUT /v1/reports/schedule (Growth+). 404 on GET means "not configured".
export type ReportSchedule = {
  report: string;
  format: string;
  cadence: string;
  email: string;
  enabled: boolean;
  last_sent_at: string | null;
};

// The whole bundle the dashboard loader assembles for the Analytics section.
// Every slice fails soft (§ loader convention): a null/empty slice renders its
// empty state and adds a warning banner, never a broken page.
export type AnalyticsData = {
  summary: AnalyticsSummary | null;
  salesTrend: SalesTrendPoint[];
  ordersTrend: OrdersTrendPoint[];
  topDesigns: TopDesignRow[];
  topDesignsLimit: number | null;
  customers: CustomersAnalytics | null;
  balances: OutstandingBalanceRow[];
  totalOutstandingMinor: number;
  breakdowns: RevenueBreakdowns | null;
  designPerformance: DesignPerformanceRow[];
  staff: StaffActivityRow[];
  reportSchedule: ReportSchedule | null;
  // The §14.1 Studio custom range currently applied ("" = plan window). Kept
  // so the range picker can echo its own state after navigation.
  customRange: { from: string; to: string };
};

export const defaultAnalyticsData: AnalyticsData = {
  summary: null,
  salesTrend: [],
  ordersTrend: [],
  topDesigns: [],
  topDesignsLimit: null,
  customers: null,
  balances: [],
  totalOutstandingMinor: 0,
  breakdowns: null,
  designPerformance: [],
  staff: [],
  reportSchedule: null,
  customRange: { from: "", to: "" },
};
