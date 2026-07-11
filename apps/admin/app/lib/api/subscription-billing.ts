import { requestJSON } from "./utils";
import { mapSubscription } from "./subscriptions";
import type { AdminSubscriptionPayload } from "./subscriptions";

export type AdminSubscriptionBillingSweep = {
  overdueInvoicesFailed: number;
  subscriptionsCanceled: number;
  businessesTouched: number;
  ranAt: string;
};

export type AdminSubscriptionRecurringSweep = {
  dueSubscriptions: number;
  chargesAttempted: number;
  chargesPaid: number;
  chargesPending: number;
  chargesFailed: number;
  chargesSkipped: number;
  ranAt: string;
};

export type AdminSubscriptionAuthorizationLink = {
  businessId: string;
  businessName: string;
  ownerEmail: string;
  redirectUrl: string;
  accessCode: string;
  reference: string;
};
type AdminSubscriptionBillingSweepPayload = {
  overdue_invoices_failed: number;
  subscriptions_canceled: number;
  businesses_touched: number;
  ran_at: string;
};

type AdminSubscriptionRecurringSweepPayload = {
  due_subscriptions: number;
  charges_attempted: number;
  charges_paid: number;
  charges_pending: number;
  charges_failed: number;
  charges_skipped: number;
  ran_at: string;
};

type AdminSubscriptionAuthorizationLinkPayload = {
  business_id: string;
  business_name: string;
  owner_email: string;
  redirect_url: string;
  access_code: string;
  reference: string;
};
function mapSubscriptionBillingSweep(
  payload: AdminSubscriptionBillingSweepPayload,
): AdminSubscriptionBillingSweep {
  return {
    overdueInvoicesFailed: payload.overdue_invoices_failed,
    subscriptionsCanceled: payload.subscriptions_canceled,
    businessesTouched: payload.businesses_touched,
    ranAt: payload.ran_at,
  };
}

function mapSubscriptionRecurringSweep(
  payload: AdminSubscriptionRecurringSweepPayload,
): AdminSubscriptionRecurringSweep {
  return {
    dueSubscriptions: payload.due_subscriptions,
    chargesAttempted: payload.charges_attempted,
    chargesPaid: payload.charges_paid,
    chargesPending: payload.charges_pending,
    chargesFailed: payload.charges_failed,
    chargesSkipped: payload.charges_skipped,
    ranAt: payload.ran_at,
  };
}

function mapSubscriptionAuthorizationLink(
  payload: AdminSubscriptionAuthorizationLinkPayload,
): AdminSubscriptionAuthorizationLink {
  return {
    businessId: payload.business_id,
    businessName: payload.business_name,
    ownerEmail: payload.owner_email,
    redirectUrl: payload.redirect_url,
    accessCode: payload.access_code,
    reference: payload.reference,
  };
}

export const subscriptionBillingApi = {
  runSubscriptionBillingSweep: (accessToken: string, reason: string) =>
    requestJSON<AdminSubscriptionBillingSweepPayload>(
      "/admin/subscriptions/billing-sweeps",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscriptionBillingSweep),
  runSubscriptionRecurringSweep: (accessToken: string, reason: string) =>
    requestJSON<AdminSubscriptionRecurringSweepPayload>(
      "/admin/subscriptions/recurring-charges",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscriptionRecurringSweep),
  initializeSubscriptionAuthorization: (
    accessToken: string,
    businessId: string,
    input: { callbackUrl: string; reason: string },
  ) =>
    requestJSON<AdminSubscriptionAuthorizationLinkPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(
        businessId,
      )}/authorization-link`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          callback_url: input.callbackUrl,
          reason: input.reason,
        }),
      },
    ).then(mapSubscriptionAuthorizationLink),
  verifySubscriptionAuthorization: (
    accessToken: string,
    businessId: string,
    input: { reference: string; reason: string },
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(
        businessId,
      )}/authorization-verifications`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          reference: input.reference,
          reason: input.reason,
        }),
      },
    ).then(mapSubscription),
};
