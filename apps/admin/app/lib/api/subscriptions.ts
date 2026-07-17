import { requestJSON } from "./utils";

export type AdminSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "grace_period"
  | "cancel_at_period_end"
  | "canceled";

// The two cadences Xtiitch bills on ("no monthly billing — billed quarterly or
// yearly only", Pricing Book rule 1). '' means the owner has not chosen yet, so
// nothing is billable.
export type AdminSubscriptionCadence = "" | "quarterly" | "yearly";

export type AdminSubscriptionBillingMode =
  | "manual"
  | "payment_link"
  | "recurring";

export type AdminSubscriptionEvent = {
  id: string;
  eventType: string;
  summary: string;
  actorEmail: string;
  createdAt: string;
};

export type AdminSubscriptionInvoiceStatus =
  | "issued"
  | "paid"
  | "failed"
  | "void";

export type AdminSubscriptionInvoice = {
  invoiceId: string;
  subscriptionId: string;
  invoiceRef: string;
  status: AdminSubscriptionInvoiceStatus;
  billingMode: AdminSubscriptionBillingMode;
  provider: string;
  providerInvoiceRef: string;
  paymentUrl: string;
  amountMinor: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  paidAt?: string;
  failedAt?: string;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminSubscription = {
  subscriptionId?: string;
  businessId: string;
  businessName: string;
  handle: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerWhatsApp: string;
  planCode: string;
  planName: string;
  monthlyFeeMinor: number;
  commissionBps: number;
  designLimit?: number;
  designCount: number;
  status: AdminSubscriptionStatus;
  billingMode: AdminSubscriptionBillingMode;
  // How often the subscription RENEWS. '' when the owner has not chosen yet.
  // Distinct from billingMode, which is how it is COLLECTED — the CRM's cadence
  // column and filter mean this one (Pricing Book §6.2).
  billingCadence: AdminSubscriptionCadence;
  provider: string;
  providerCustomerRef: string;
  providerSubscriptionRef: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  graceEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  failedPaymentCount: number;
  lastInvoiceRef: string;
  lastPaymentAt?: string;
  nextBillingAt?: string;
  signupAt: string;
  renewalAt?: string;
  storeLink: string;
  discountCode: string;
  discountInstitution: string;
  lastActiveAt: string;
  orders: number;
  gmvMinor: number;
  commissionMinor: number;
  updatedAt: string;
  events: AdminSubscriptionEvent[];
  invoices: AdminSubscriptionInvoice[];
};
type AdminSubscriptionEventPayload = {
  subscription_event_id: string;
  event_type: string;
  summary: string;
  actor_email: string;
  created_at: string;
};

type AdminSubscriptionInvoicePayload = {
  invoice_id: string;
  subscription_id: string;
  invoice_ref: string;
  status: AdminSubscriptionInvoiceStatus;
  billing_mode: AdminSubscriptionBillingMode;
  provider: string;
  provider_invoice_ref: string;
  payment_url: string;
  amount_minor: number;
  currency: string;
  period_start: string;
  period_end: string;
  due_at: string;
  paid_at?: string;
  failed_at?: string;
  failure_reason: string;
  created_at: string;
  updated_at: string;
};

export type AdminSubscriptionPayload = {
  subscription_id?: string;
  business_id: string;
  business_name: string;
  handle: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  owner_whatsapp: string;
  plan_code: string;
  plan_name: string;
  monthly_fee_minor: number;
  commission_bps: number;
  design_limit?: number;
  design_count?: number;
  status: AdminSubscriptionStatus;
  billing_mode: AdminSubscriptionBillingMode;
  billing_cadence?: string;
  provider: string;
  provider_customer_ref: string;
  provider_subscription_ref: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string;
  grace_ends_at?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  failed_payment_count: number;
  last_invoice_ref: string;
  last_payment_at?: string;
  next_billing_at?: string;
  signup_at: string;
  renewal_at?: string;
  store_link: string;
  discount_code: string;
  discount_institution: string;
  last_active_at: string;
  orders: number;
  gmv_minor: number;
  commission_minor: number;
  updated_at: string;
  events: AdminSubscriptionEventPayload[];
  invoices: AdminSubscriptionInvoicePayload[];
};
export function mapSubscription(payload: AdminSubscriptionPayload): AdminSubscription {
  return {
    subscriptionId: payload.subscription_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    handle: payload.handle,
    ownerName: payload.owner_name,
    ownerPhone: payload.owner_phone,
    ownerEmail: payload.owner_email,
    ownerWhatsApp: payload.owner_whatsapp,
    planCode: payload.plan_code,
    planName: payload.plan_name,
    monthlyFeeMinor: payload.monthly_fee_minor,
    commissionBps: payload.commission_bps,
    designLimit: payload.design_limit,
    designCount: payload.design_count ?? 0,
    status: payload.status,
    billingMode: payload.billing_mode,
    billingCadence: (payload.billing_cadence ?? "") as AdminSubscriptionCadence,
    provider: payload.provider,
    providerCustomerRef: payload.provider_customer_ref,
    providerSubscriptionRef: payload.provider_subscription_ref,
    currentPeriodStart: payload.current_period_start,
    currentPeriodEnd: payload.current_period_end,
    trialEndsAt: payload.trial_ends_at,
    graceEndsAt: payload.grace_ends_at,
    cancelAtPeriodEnd: payload.cancel_at_period_end,
    canceledAt: payload.canceled_at,
    failedPaymentCount: payload.failed_payment_count,
    lastInvoiceRef: payload.last_invoice_ref,
    lastPaymentAt: payload.last_payment_at,
    nextBillingAt: payload.next_billing_at,
    signupAt: payload.signup_at,
    renewalAt: payload.renewal_at,
    storeLink: payload.store_link,
    discountCode: payload.discount_code,
    discountInstitution: payload.discount_institution,
    lastActiveAt: payload.last_active_at,
    orders: payload.orders,
    gmvMinor: payload.gmv_minor,
    commissionMinor: payload.commission_minor,
    updatedAt: payload.updated_at,
    events: payload.events.map((event) => ({
      id: event.subscription_event_id,
      eventType: event.event_type,
      summary: event.summary,
      actorEmail: event.actor_email,
      createdAt: event.created_at,
    })),
    invoices: payload.invoices.map((invoice) => ({
      invoiceId: invoice.invoice_id,
      subscriptionId: invoice.subscription_id,
      invoiceRef: invoice.invoice_ref,
      status: invoice.status,
      billingMode: invoice.billing_mode,
      provider: invoice.provider,
      providerInvoiceRef: invoice.provider_invoice_ref,
      paymentUrl: invoice.payment_url,
      amountMinor: invoice.amount_minor,
      currency: invoice.currency,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      dueAt: invoice.due_at,
      paidAt: invoice.paid_at,
      failedAt: invoice.failed_at,
      failureReason: invoice.failure_reason,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    })),
  };
}

export const subscriptionsApi = {
  subscriptions: async (accessToken: string) => {
    const payload = await requestJSON<{
      subscriptions: AdminSubscriptionPayload[];
    }>("/admin/subscriptions", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.subscriptions.map(mapSubscription);
  },
  updateSubscription: (
    accessToken: string,
    businessId: string,
    input: {
      status: AdminSubscriptionStatus;
      billingMode: AdminSubscriptionBillingMode;
      providerCustomerRef: string;
      providerSubscriptionRef: string;
      reason: string;
    },
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          billing_mode: input.billingMode,
          provider_customer_ref: input.providerCustomerRef,
          provider_subscription_ref: input.providerSubscriptionRef,
          reason: input.reason,
        }),
      },
    ).then(mapSubscription),
  issueSubscriptionInvoice: (
    accessToken: string,
    businessId: string,
    input: {
      providerInvoiceRef: string;
      paymentUrl: string;
      dueAt?: string;
      reason: string;
    },
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(
        businessId,
      )}/invoices`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider_invoice_ref: input.providerInvoiceRef,
          payment_url: input.paymentUrl,
          due_at: input.dueAt,
          reason: input.reason,
        }),
      },
    ).then(mapSubscription),
  markSubscriptionInvoicePaid: (
    accessToken: string,
    invoiceId: string,
    reason: string,
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/invoices/${encodeURIComponent(invoiceId)}/paid`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscription),
  markSubscriptionInvoiceFailed: (
    accessToken: string,
    invoiceId: string,
    reason: string,
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/invoices/${encodeURIComponent(invoiceId)}/failed`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscription),
};
