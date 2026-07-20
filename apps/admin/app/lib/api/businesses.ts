import { requestJSON } from "./utils";
import type { AdminVerificationStatus, AdminRiskLevel } from "./verifications";

export type AdminBusinessOperationalStatus = "active" | "suspended";
export type AdminBusinessStatus = AdminVerificationStatus | "suspended";
export type AdminBusinessActivityCategory =
  | "orders"
  | "payments"
  | "billing"
  | "payouts"
  | "verification"
  | "admin"
  | "takings";

export type AdminBusinessActivityEvent = {
  eventType: string;
  category: AdminBusinessActivityCategory;
  occurredAt: string;
  summary: string;
  actor: string;
  refId: string;
  amountMinor?: number;
};

export type AdminBusinessActivityPage = {
  activity: AdminBusinessActivityEvent[];
};

export type AdminBusinessDeleteResult = {
  businessId: string;
  name: string;
  handle: string;
  rowsDeleted: number;
  deleted: boolean;
};

export type AdminBusiness = {
  id: string;
  name: string;
  handle: string;
  ownerName: string;
  ownerEmail: string;
  status: AdminBusinessStatus;
  verificationStatus: AdminVerificationStatus;
  operationalStatus: AdminBusinessOperationalStatus;
  plan: string;
  orders: number;
  gmvMinor: number;
  commissionMinor: number;
  riskLevel: AdminRiskLevel;
  lastActive: string;
  subaccountRef: string;
  suspensionReason: string;
  suspendedAt?: string;
  updatedAt: string;
};

export type AdminCustomer = {
  id: string;
  email: string;
  phone: string;
  displayName: string;
  tenantCount: number;
  orderCount: number;
  customOrderCount: number;
  gmvMinor: number;
  lastBusinessName: string;
  lastBusinessHandle: string;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
};
type AdminBusinessPayload = {
  business_id: string;
  name: string;
  handle: string;
  owner_name: string;
  owner_email: string;
  status: AdminBusinessStatus;
  verification_status: AdminVerificationStatus;
  operational_status: AdminBusinessOperationalStatus;
  plan: string;
  orders: number;
  gmv_minor: number;
  commission_minor: number;
  risk_level: AdminRiskLevel;
  last_active: string;
  subaccount_ref: string;
  suspension_reason: string;
  suspended_at?: string;
  updated_at: string;
};

type AdminCustomerPayload = {
  customer_id: string;
  email: string;
  phone: string;
  display_name: string;
  tenant_count: number;
  order_count: number;
  custom_order_count: number;
  gmv_minor: number;
  last_business_name: string;
  last_business_handle: string;
  last_active: string;
  created_at: string;
  updated_at: string;
};
function mapBusiness(payload: AdminBusinessPayload): AdminBusiness {
  return {
    id: payload.business_id,
    name: payload.name,
    handle: payload.handle,
    ownerName: payload.owner_name,
    ownerEmail: payload.owner_email,
    status: payload.status,
    verificationStatus: payload.verification_status,
    operationalStatus: payload.operational_status,
    plan: payload.plan,
    orders: payload.orders,
    gmvMinor: payload.gmv_minor,
    commissionMinor: payload.commission_minor,
    riskLevel: payload.risk_level,
    lastActive: payload.last_active,
    subaccountRef: payload.subaccount_ref,
    suspensionReason: payload.suspension_reason,
    suspendedAt: payload.suspended_at,
    updatedAt: payload.updated_at,
  };
}

function mapCustomer(payload: AdminCustomerPayload): AdminCustomer {
  return {
    id: payload.customer_id,
    email: payload.email,
    phone: payload.phone,
    displayName: payload.display_name,
    tenantCount: payload.tenant_count,
    orderCount: payload.order_count,
    customOrderCount: payload.custom_order_count,
    gmvMinor: payload.gmv_minor,
    lastBusinessName: payload.last_business_name,
    lastBusinessHandle: payload.last_business_handle,
    lastActive: payload.last_active,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

type AdminBusinessActivityEventPayload = {
  event_type: string;
  category: AdminBusinessActivityCategory;
  occurred_at: string;
  summary: string;
  actor: string;
  ref_id: string;
  amount_minor?: number;
};

type AdminBusinessDeletePayload = {
  business_id: string;
  name: string;
  handle: string;
  rows_deleted: number;
  deleted: boolean;
};

function mapBusinessActivityEvent(
  payload: AdminBusinessActivityEventPayload,
): AdminBusinessActivityEvent {
  return {
    eventType: payload.event_type,
    category: payload.category,
    occurredAt: payload.occurred_at,
    summary: payload.summary,
    actor: payload.actor,
    refId: payload.ref_id,
    amountMinor: payload.amount_minor,
  };
}

export const businessesApi = {
  businesses: async (accessToken: string) => {
    const payload = await requestJSON<{ businesses: AdminBusinessPayload[] }>(
      "/admin/businesses",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.businesses.map(mapBusiness);
  },
  customers: async (accessToken: string) => {
    const payload = await requestJSON<{ customers: AdminCustomerPayload[] }>(
      "/admin/customers",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.customers.map(mapCustomer);
  },
  eraseCustomer: (
    accessToken: string,
    customerId: string,
    confirmation: string,
  ) =>
    requestJSON<{
      customer_id: string;
      erased: boolean;
      orders_retained: number;
      measurements_cleared: number;
      booking_addresses_cleared: number;
    }>(`/admin/customers/${encodeURIComponent(customerId)}/erase`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ confirmation }),
    }),
  updateBusinessStatus: (
    accessToken: string,
    businessId: string,
    input: {
      operationalStatus: AdminBusinessOperationalStatus;
      reason: string;
    },
  ) =>
    requestJSON<AdminBusinessPayload>(
      `/admin/businesses/${encodeURIComponent(businessId)}/status`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          operational_status: input.operationalStatus,
          reason: input.reason,
        }),
      },
    ).then(mapBusiness),
  // §11.2: permanent, typed-confirmation delete. The confirm name travels as a
  // query parameter (not a body) because that is the API contract, and it must
  // match the business name exactly or the API answers 400 invalid_input.
  deleteBusiness: (accessToken: string, businessId: string, confirm: string) =>
    requestJSON<AdminBusinessDeletePayload>(
      `/admin/businesses/${encodeURIComponent(businessId)}?confirm=${encodeURIComponent(confirm)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    ).then((payload) => ({
      businessId: payload.business_id,
      name: payload.name,
      handle: payload.handle,
      rowsDeleted: payload.rows_deleted,
      deleted: payload.deleted,
    })),
  // §11.3: the unified per-business activity feed (orders, payments, billing,
  // payouts, verification, admin, takings), newest first.
  businessActivity: async (
    accessToken: string,
    businessId: string,
    input: { type?: string; limit?: number; offset?: number } = {},
  ): Promise<AdminBusinessActivityPage> => {
    const params = new URLSearchParams();
    if (input.type) {
      params.set("type", input.type);
    }
    if (typeof input.limit === "number") {
      params.set("limit", String(input.limit));
    }
    if (typeof input.offset === "number") {
      params.set("offset", String(input.offset));
    }
    const query = params.toString();
    const payload = await requestJSON<{
      activity?: AdminBusinessActivityEventPayload[] | null;
    }>(
      `/admin/businesses/${encodeURIComponent(businessId)}/activity${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return { activity: (payload.activity ?? []).map(mapBusinessActivityEvent) };
  },
};
