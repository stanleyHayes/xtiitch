import { requestJSON } from "./utils";

export type AdminPromotionDiscountType = "percentage" | "fixed";
export type AdminPromotionFundingSource = "business" | "platform" | "split";
export type AdminPromotionScope = "store" | "collection" | "design";
export type AdminPromotionStatus = "active" | "paused" | "archived";

export type AdminPromotionRedemption = {
  promotionRedemptionId: string;
  promotionId: string;
  businessId: string;
  orderId?: string;
  customerId?: string;
  customerName: string;
  discountMinor: number;
  status: "pending" | "applied" | "void";
  redeemedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPromotion = {
  promotionId: string;
  businessId?: string;
  businessName: string;
  businessHandle: string;
  code: string;
  title: string;
  description: string;
  discountType: AdminPromotionDiscountType;
  discountValue: number;
  maxDiscountMinor?: number;
  minSpendMinor: number;
  usageLimitGlobal?: number;
  usageLimitPerCustomer?: number;
  fundingSource: AdminPromotionFundingSource;
  scope: AdminPromotionScope;
  targetCollectionId?: string;
  targetDesignId?: string;
  status: AdminPromotionStatus;
  startsAt?: string;
  endsAt?: string;
  redemptionCount: number;
  discountRedeemedMinor: number;
  recentRedemptions: AdminPromotionRedemption[];
  createdAt: string;
  updatedAt: string;
};
type AdminPromotionPayload = {
  promotion_id: string;
  business_id?: string;
  business_name: string;
  business_handle: string;
  code: string;
  title: string;
  description: string;
  discount_type: AdminPromotionDiscountType;
  discount_value: number;
  max_discount_minor?: number;
  min_spend_minor: number;
  usage_limit_global?: number;
  usage_limit_per_customer?: number;
  funding_source: AdminPromotionFundingSource;
  scope: AdminPromotionScope;
  target_collection_id?: string;
  target_design_id?: string;
  status: AdminPromotionStatus;
  starts_at?: string;
  ends_at?: string;
  redemption_count: number;
  discount_redeemed_minor: number;
  recent_redemptions: {
    promotion_redemption_id: string;
    promotion_id: string;
    business_id: string;
    order_id?: string;
    customer_id?: string;
    customer_name: string;
    discount_minor: number;
    status: "pending" | "applied" | "void";
    redeemed_at?: string;
    created_at: string;
    updated_at: string;
  }[];
  created_at: string;
  updated_at: string;
};
function mapPromotion(payload: AdminPromotionPayload): AdminPromotion {
  return {
    promotionId: payload.promotion_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    code: payload.code,
    title: payload.title,
    description: payload.description,
    discountType: payload.discount_type,
    discountValue: payload.discount_value,
    maxDiscountMinor: payload.max_discount_minor,
    minSpendMinor: payload.min_spend_minor,
    usageLimitGlobal: payload.usage_limit_global,
    usageLimitPerCustomer: payload.usage_limit_per_customer,
    fundingSource: payload.funding_source,
    scope: payload.scope,
    targetCollectionId: payload.target_collection_id,
    targetDesignId: payload.target_design_id,
    status: payload.status,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    redemptionCount: payload.redemption_count,
    discountRedeemedMinor: payload.discount_redeemed_minor,
    recentRedemptions: (payload.recent_redemptions ?? []).map((redemption) => ({
      promotionRedemptionId: redemption.promotion_redemption_id,
      promotionId: redemption.promotion_id,
      businessId: redemption.business_id,
      orderId: redemption.order_id,
      customerId: redemption.customer_id,
      customerName: redemption.customer_name,
      discountMinor: redemption.discount_minor,
      status: redemption.status,
      redeemedAt: redemption.redeemed_at,
      createdAt: redemption.created_at,
      updatedAt: redemption.updated_at,
    })),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const promotionsApi = {
  promotions: async (accessToken: string) => {
    const payload = await requestJSON<{ promotions: AdminPromotionPayload[] }>(
      "/admin/promotions",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.promotions.map(mapPromotion);
  },
  createPromotion: (
    accessToken: string,
    input: {
      businessId?: string;
      code: string;
      title: string;
      description: string;
      discountType: AdminPromotionDiscountType;
      discountValue: number;
      maxDiscountMinor?: number;
      minSpendMinor: number;
      usageLimitGlobal?: number;
      usageLimitPerCustomer?: number;
      fundingSource: AdminPromotionFundingSource;
      scope: AdminPromotionScope;
      targetCollectionId?: string;
      targetDesignId?: string;
      status: Exclude<AdminPromotionStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
    },
  ) =>
    requestJSON<AdminPromotionPayload>("/admin/promotions", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        business_id: input.businessId,
        code: input.code,
        title: input.title,
        description: input.description,
        discount_type: input.discountType,
        discount_value: input.discountValue,
        max_discount_minor: input.maxDiscountMinor,
        min_spend_minor: input.minSpendMinor,
        usage_limit_global: input.usageLimitGlobal,
        usage_limit_per_customer: input.usageLimitPerCustomer,
        funding_source: input.fundingSource,
        scope: input.scope,
        target_collection_id: input.targetCollectionId,
        target_design_id: input.targetDesignId,
        status: input.status,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
      }),
    }).then(mapPromotion),
  updatePromotion: (
    accessToken: string,
    promotionId: string,
    input: {
      businessId?: string;
      code: string;
      title: string;
      description: string;
      discountType: AdminPromotionDiscountType;
      discountValue: number;
      maxDiscountMinor?: number;
      minSpendMinor: number;
      usageLimitGlobal?: number;
      usageLimitPerCustomer?: number;
      fundingSource: AdminPromotionFundingSource;
      scope: AdminPromotionScope;
      targetCollectionId?: string;
      targetDesignId?: string;
      status: Exclude<AdminPromotionStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
    },
  ) =>
    requestJSON<AdminPromotionPayload>(
      `/admin/promotions/${encodeURIComponent(promotionId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          business_id: input.businessId,
          code: input.code,
          title: input.title,
          description: input.description,
          discount_type: input.discountType,
          discount_value: input.discountValue,
          max_discount_minor: input.maxDiscountMinor,
          min_spend_minor: input.minSpendMinor,
          usage_limit_global: input.usageLimitGlobal,
          usage_limit_per_customer: input.usageLimitPerCustomer,
          funding_source: input.fundingSource,
          scope: input.scope,
          target_collection_id: input.targetCollectionId,
          target_design_id: input.targetDesignId,
          status: input.status,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
        }),
      },
    ).then(mapPromotion),
  archivePromotion: (
    accessToken: string,
    promotionId: string,
    reason: string,
  ) =>
    requestJSON<AdminPromotionPayload>(
      `/admin/promotions/${encodeURIComponent(promotionId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapPromotion),
};
