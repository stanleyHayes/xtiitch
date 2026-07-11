import { requestJSON } from "./utils";

export type AdminAffiliateEntityType = "person" | "business" | "agency";
export type AdminAffiliateCommissionModel = "percentage" | "flat";
export type AdminAffiliatePayoutMode =
  | "paystack_split"
  | "paystack_transfer"
  | "voucher"
  | "manual";
export type AdminAffiliateStatus =
  | "pending_review"
  | "active"
  | "paused"
  | "archived";

export type AdminAffiliate = {
  affiliateId: string;
  entityType: AdminAffiliateEntityType;
  code: string;
  displayName: string;
  contactName: string;
  email: string;
  phone: string;
  websiteUrl: string;
  commissionModel: AdminAffiliateCommissionModel;
  commissionRate: number;
  cookieWindowDays: number;
  payoutMode: AdminAffiliatePayoutMode;
  payoutReference: string;
  status: AdminAffiliateStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAffiliateAttribution = {
  affiliateId: string;
  code: string;
  displayName: string;
  clickCount: number;
  conversionCount: number;
  pendingConversionCount: number;
  approvedConversionCount: number;
  settledConversionCount: number;
  reversedConversionCount: number;
  grossMinor: number;
  commissionMinor: number;
  recentConversions: AdminAffiliateConversion[];
  recentPayouts: AdminAffiliatePayout[];
  lastActivityAt?: string;
};

export type AdminAffiliateConversion = {
  conversionId: string;
  affiliateId: string;
  businessId: string;
  businessName: string;
  orderId: string;
  grossMinor: number;
  commissionMinor: number;
  status: "pending" | "approved" | "settled" | "reversed";
  attributionModel: "last_click" | "manual";
  holdUntil?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAffiliatePayout = {
  payoutBatchId: string;
  affiliateId: string;
  displayName: string;
  payoutMode: AdminAffiliatePayoutMode;
  payoutReference: string;
  conversionCount: number;
  grossMinor: number;
  commissionMinor: number;
  status: "settled" | "void";
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type AdminAffiliatePayload = {
  affiliate_id: string;
  entity_type: AdminAffiliateEntityType;
  code: string;
  display_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website_url: string;
  commission_model: AdminAffiliateCommissionModel;
  commission_rate: number;
  cookie_window_days: number;
  payout_mode: AdminAffiliatePayoutMode;
  payout_reference: string;
  status: AdminAffiliateStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

type AdminAffiliateAttributionPayload = {
  affiliate_id: string;
  code: string;
  display_name: string;
  click_count: number;
  conversion_count: number;
  pending_conversion_count: number;
  approved_conversion_count: number;
  settled_conversion_count: number;
  reversed_conversion_count: number;
  gross_minor: number;
  commission_minor: number;
  recent_conversions: AdminAffiliateConversionPayload[];
  recent_payouts: AdminAffiliatePayoutPayload[];
  last_activity_at?: string;
};

type AdminAffiliateConversionPayload = {
  conversion_id: string;
  affiliate_id: string;
  business_id: string;
  business_name: string;
  order_id: string;
  gross_minor: number;
  commission_minor: number;
  status: AdminAffiliateConversion["status"];
  attribution_model: AdminAffiliateConversion["attributionModel"];
  hold_until?: string;
  created_at: string;
  updated_at: string;
};

type AdminAffiliatePayoutPayload = {
  payout_batch_id: string;
  affiliate_id: string;
  display_name: string;
  payout_mode: AdminAffiliatePayoutMode;
  payout_reference: string;
  conversion_count: number;
  gross_minor: number;
  commission_minor: number;
  status: AdminAffiliatePayout["status"];
  notes: string;
  created_at: string;
  updated_at: string;
};
function mapAffiliate(payload: AdminAffiliatePayload): AdminAffiliate {
  return {
    affiliateId: payload.affiliate_id,
    entityType: payload.entity_type,
    code: payload.code,
    displayName: payload.display_name,
    contactName: payload.contact_name,
    email: payload.email,
    phone: payload.phone,
    websiteUrl: payload.website_url,
    commissionModel: payload.commission_model,
    commissionRate: payload.commission_rate,
    cookieWindowDays: payload.cookie_window_days,
    payoutMode: payload.payout_mode,
    payoutReference: payload.payout_reference,
    status: payload.status,
    notes: payload.notes,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAffiliateAttribution(
  payload: AdminAffiliateAttributionPayload,
): AdminAffiliateAttribution {
  return {
    affiliateId: payload.affiliate_id,
    code: payload.code,
    displayName: payload.display_name,
    clickCount: payload.click_count,
    conversionCount: payload.conversion_count,
    pendingConversionCount: payload.pending_conversion_count,
    approvedConversionCount: payload.approved_conversion_count,
    settledConversionCount: payload.settled_conversion_count,
    reversedConversionCount: payload.reversed_conversion_count,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    recentConversions: payload.recent_conversions.map(mapAffiliateConversion),
    recentPayouts: (payload.recent_payouts ?? []).map(mapAffiliatePayout),
    lastActivityAt: payload.last_activity_at,
  };
}

function mapAffiliateConversion(
  payload: AdminAffiliateConversionPayload,
): AdminAffiliateConversion {
  return {
    conversionId: payload.conversion_id,
    affiliateId: payload.affiliate_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    orderId: payload.order_id,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    status: payload.status,
    attributionModel: payload.attribution_model,
    holdUntil: payload.hold_until,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAffiliatePayout(
  payload: AdminAffiliatePayoutPayload,
): AdminAffiliatePayout {
  return {
    payoutBatchId: payload.payout_batch_id,
    affiliateId: payload.affiliate_id,
    displayName: payload.display_name,
    payoutMode: payload.payout_mode,
    payoutReference: payload.payout_reference,
    conversionCount: payload.conversion_count,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    status: payload.status,
    notes: payload.notes,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const affiliatesApi = {
  affiliates: async (accessToken: string) => {
    const payload = await requestJSON<{ affiliates: AdminAffiliatePayload[] }>(
      "/admin/affiliates",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.affiliates.map(mapAffiliate);
  },
  affiliateAttribution: async (accessToken: string) => {
    const payload = await requestJSON<{
      attribution: AdminAffiliateAttributionPayload[];
    }>("/admin/affiliate-attribution", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.attribution.map(mapAffiliateAttribution);
  },
  updateAffiliateConversionStatus: (
    accessToken: string,
    conversionId: string,
    input: {
      status: Exclude<AdminAffiliateConversion["status"], "pending">;
      reason: string;
    },
  ) =>
    requestJSON<AdminAffiliateConversionPayload>(
      `/admin/affiliate-conversions/${encodeURIComponent(conversionId)}/status`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          reason: input.reason,
        }),
      },
    ).then(mapAffiliateConversion),
  createAffiliatePayout: (
    accessToken: string,
    affiliateId: string,
    input: {
      payoutReference: string;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayoutPayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}/payouts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          payout_reference: input.payoutReference,
          notes: input.notes,
        }),
      },
    ).then(mapAffiliatePayout),
  createAffiliate: (
    accessToken: string,
    input: {
      entityType: AdminAffiliateEntityType;
      code: string;
      displayName: string;
      contactName: string;
      email: string;
      phone: string;
      websiteUrl: string;
      commissionModel: AdminAffiliateCommissionModel;
      commissionRate: number;
      cookieWindowDays: number;
      payoutMode: AdminAffiliatePayoutMode;
      payoutReference: string;
      status: Exclude<AdminAffiliateStatus, "archived">;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayload>("/admin/affiliates", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        entity_type: input.entityType,
        code: input.code,
        display_name: input.displayName,
        contact_name: input.contactName,
        email: input.email,
        phone: input.phone,
        website_url: input.websiteUrl,
        commission_model: input.commissionModel,
        commission_rate: input.commissionRate,
        cookie_window_days: input.cookieWindowDays,
        payout_mode: input.payoutMode,
        payout_reference: input.payoutReference,
        status: input.status,
        notes: input.notes,
      }),
    }).then(mapAffiliate),
  updateAffiliate: (
    accessToken: string,
    affiliateId: string,
    input: {
      entityType: AdminAffiliateEntityType;
      code: string;
      displayName: string;
      contactName: string;
      email: string;
      phone: string;
      websiteUrl: string;
      commissionModel: AdminAffiliateCommissionModel;
      commissionRate: number;
      cookieWindowDays: number;
      payoutMode: AdminAffiliatePayoutMode;
      payoutReference: string;
      status: Exclude<AdminAffiliateStatus, "archived">;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          entity_type: input.entityType,
          code: input.code,
          display_name: input.displayName,
          contact_name: input.contactName,
          email: input.email,
          phone: input.phone,
          website_url: input.websiteUrl,
          commission_model: input.commissionModel,
          commission_rate: input.commissionRate,
          cookie_window_days: input.cookieWindowDays,
          payout_mode: input.payoutMode,
          payout_reference: input.payoutReference,
          status: input.status,
          notes: input.notes,
        }),
      },
    ).then(mapAffiliate),
  archiveAffiliate: (
    accessToken: string,
    affiliateId: string,
    reason: string,
  ) =>
    requestJSON<AdminAffiliatePayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapAffiliate),
};
