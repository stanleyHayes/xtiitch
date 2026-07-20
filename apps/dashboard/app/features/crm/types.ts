// §15 CRM response shapes, mirrored field-for-field from the deployed API
// (apps/api/internal/adapters/inbound/http/crm/handler.go). The API blanks
// ladder-gated fields to null/omits them (spend & counts below Starter, tags
// below Growth) — the nulls make the gating VISIBLE so the dashboard can show
// "upgrade to see" instead of faking zeros. Money is GHS pesewas.

// GET /v1/crm/customers — one list row.
export type CrmCustomerRow = {
  customer_id: string;
  name: string;
  phone: string;
  whatsapp: string;
  // First order's channel with this store ("online" / "walk_in").
  source: string;
  last_order_at: string | null;
  // null below Starter (§15.1 ladders spend/counts).
  orders_count: number | null;
  total_spend_minor: number | null;
  // absent below Growth.
  tags?: string[];
};

export type CrmCustomerList = {
  customers: CrmCustomerRow[];
  crm_level: number;
  total: number;
  limit: number;
  offset: number;
};

// GET /v1/crm/customers/{id} — the §15.1 profile every plan gets.
export type CrmOrderLine = {
  order_id: string;
  status: string;
  agreed_total_minor: number | null;
  settled_minor: number;
  created_at: string;
};

export type CrmMeasurement = {
  measurement_id: string;
  order_id: string;
  source: string;
  values: Record<string, string>;
  created_at: string;
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
  orders: CrmOrderLine[];
  measurements: CrmMeasurement[];
  // null below Starter; note/note_updated_at absent below Starter; tags
  // absent below Growth.
  orders_count: number | null;
  total_spend_minor: number | null;
  note?: string;
  note_updated_at?: string | null;
  tags?: string[];
};

// GET /v1/crm/customers/insights (Growth+): new vs returning + lapsed.
export type CrmLapsedCustomer = {
  customer_id: string;
  name: string;
  phone: string;
  last_order_at: string;
};

export type CrmInsights = {
  new_customers_30d: number;
  returning_customers: number;
  lapsed_customers: CrmLapsedCustomer[];
};

// The filters currently applied, echoed back so the form can render its own
// state after a GET navigation.
export type CrmQuery = {
  q: string;
  tag: string;
  segment: string;
  minSpendGhs: string;
  lastOrderBefore: string;
  page: number;
};

export type CrmData = {
  list: CrmCustomerList;
  insights: CrmInsights | null;
  query: CrmQuery;
};

export const defaultCrmData: CrmData = {
  list: { customers: [], crm_level: 0, total: 0, limit: 0, offset: 0 },
  insights: null,
  query: { q: "", tag: "", segment: "", minSpendGhs: "", lastOrderBefore: "", page: 1 },
};
