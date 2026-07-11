import { requestJSON } from "./utils";

export type AdminAdPlacementType =
  | "featured_business"
  | "promoted_design"
  | "homepage_hero";
export type AdminAdCampaignStatus =
  | "pending_review"
  | "active"
  | "paused"
  | "completed"
  | "archived";
export type AdminAdPricingModel = "flat_time";

export type AdminAdCampaign = {
  campaignId: string;
  businessId: string;
  businessName: string;
  businessHandle: string;
  placementType: AdminAdPlacementType;
  targetRefId: string;
  targetLabel: string;
  headline: string;
  description: string;
  status: AdminAdCampaignStatus;
  pricingModel: AdminAdPricingModel;
  budgetMinor: number;
  spendMinor: number;
  dailyCapMinor?: number;
  startsAt: string;
  endsAt: string;
  impressionCount: number;
  clickCount: number;
  clickRateBps: number;
  reviewNote: string;
  payments: AdminAdCampaignPayment[];
  createdAt: string;
  updatedAt: string;
};

export type AdminAdCampaignPayment = {
  paymentId: string;
  campaignId: string;
  businessId: string;
  provider: "paystack";
  providerReference: string;
  paymentUrl: string;
  amountMinor: number;
  currency: string;
  status: "initiated" | "paid" | "failed" | "void";
  paidAt?: string;
  failedAt?: string;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
};
type AdminAdCampaignPayload = {
  campaign_id: string;
  business_id: string;
  business_name: string;
  business_handle: string;
  placement_type: AdminAdPlacementType;
  target_ref_id: string;
  target_label: string;
  headline: string;
  description: string;
  status: AdminAdCampaignStatus;
  pricing_model: AdminAdPricingModel;
  budget_minor: number;
  spend_minor: number;
  daily_cap_minor?: number;
  starts_at: string;
  ends_at: string;
  impression_count: number;
  click_count: number;
  click_rate_bps: number;
  review_note: string;
  payments: AdminAdCampaignPaymentPayload[];
  created_at: string;
  updated_at: string;
};

type AdminAdCampaignPaymentPayload = {
  payment_id: string;
  campaign_id: string;
  business_id: string;
  provider: "paystack";
  provider_reference: string;
  payment_url: string;
  amount_minor: number;
  currency: string;
  status: "initiated" | "paid" | "failed" | "void";
  paid_at?: string;
  failed_at?: string;
  failure_reason: string;
  created_at: string;
  updated_at: string;
};

type AdminAdCampaignPaymentCollectPayload = {
  payment: AdminAdCampaignPaymentPayload;
  created: boolean;
  authorization_url: string;
};
function mapAdCampaign(payload: AdminAdCampaignPayload): AdminAdCampaign {
  return {
    campaignId: payload.campaign_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    placementType: payload.placement_type,
    targetRefId: payload.target_ref_id,
    targetLabel: payload.target_label,
    headline: payload.headline,
    description: payload.description,
    status: payload.status,
    pricingModel: payload.pricing_model,
    budgetMinor: payload.budget_minor,
    spendMinor: payload.spend_minor,
    dailyCapMinor: payload.daily_cap_minor,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    impressionCount: payload.impression_count,
    clickCount: payload.click_count,
    clickRateBps: payload.click_rate_bps,
    reviewNote: payload.review_note,
    payments: (payload.payments ?? []).map(mapAdCampaignPayment),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAdCampaignPayment(
  payload: AdminAdCampaignPaymentPayload,
): AdminAdCampaignPayment {
  return {
    paymentId: payload.payment_id,
    campaignId: payload.campaign_id,
    businessId: payload.business_id,
    provider: payload.provider,
    providerReference: payload.provider_reference,
    paymentUrl: payload.payment_url,
    amountMinor: payload.amount_minor,
    currency: payload.currency,
    status: payload.status,
    paidAt: payload.paid_at,
    failedAt: payload.failed_at,
    failureReason: payload.failure_reason,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const adsApi = {
  adCampaigns: async (accessToken: string) => {
    const payload = await requestJSON<{ campaigns: AdminAdCampaignPayload[] }>(
      "/admin/ad-campaigns",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.campaigns.map(mapAdCampaign);
  },
  createAdCampaign: (
    accessToken: string,
    input: {
      businessId: string;
      placementType: AdminAdPlacementType;
      targetRefId: string;
      headline: string;
      description: string;
      status: Exclude<AdminAdCampaignStatus, "archived">;
      pricingModel: AdminAdPricingModel;
      budgetMinor: number;
      dailyCapMinor?: number;
      startsAt?: string;
      endsAt?: string;
      reviewNote: string;
    },
  ) =>
    requestJSON<AdminAdCampaignPayload>("/admin/ad-campaigns", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        business_id: input.businessId,
        placement_type: input.placementType,
        target_ref_id: input.targetRefId,
        headline: input.headline,
        description: input.description,
        status: input.status,
        pricing_model: input.pricingModel,
        budget_minor: input.budgetMinor,
        daily_cap_minor: input.dailyCapMinor,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        review_note: input.reviewNote,
      }),
    }).then(mapAdCampaign),
  updateAdCampaign: (
    accessToken: string,
    campaignId: string,
    input: {
      businessId: string;
      placementType: AdminAdPlacementType;
      targetRefId: string;
      headline: string;
      description: string;
      status: Exclude<AdminAdCampaignStatus, "archived">;
      pricingModel: AdminAdPricingModel;
      budgetMinor: number;
      dailyCapMinor?: number;
      startsAt?: string;
      endsAt?: string;
      reviewNote: string;
    },
  ) =>
    requestJSON<AdminAdCampaignPayload>(
      `/admin/ad-campaigns/${encodeURIComponent(campaignId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          business_id: input.businessId,
          placement_type: input.placementType,
          target_ref_id: input.targetRefId,
          headline: input.headline,
          description: input.description,
          status: input.status,
          pricing_model: input.pricingModel,
          budget_minor: input.budgetMinor,
          daily_cap_minor: input.dailyCapMinor,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          review_note: input.reviewNote,
        }),
      },
    ).then(mapAdCampaign),
  archiveAdCampaign: (
    accessToken: string,
    campaignId: string,
    reason: string,
  ) =>
    requestJSON<AdminAdCampaignPayload>(
      `/admin/ad-campaigns/${encodeURIComponent(campaignId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapAdCampaign),
  collectAdCampaignPayment: (
    accessToken: string,
    campaignId: string,
    customerEmail: string,
  ) =>
    requestJSON<AdminAdCampaignPaymentCollectPayload>(
      `/admin/ad-campaigns/${encodeURIComponent(campaignId)}/payments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ customer_email: customerEmail }),
      },
    ).then((payload) => ({
      payment: mapAdCampaignPayment(payload.payment),
      created: payload.created,
      authorizationUrl: payload.authorization_url,
    })),
};
