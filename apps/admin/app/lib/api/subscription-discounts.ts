import { requestJSON } from "./utils";

export type AdminSubscriptionDiscountType =
  | "free_period"
  | "percentage"
  | "fixed";

export type AdminSubscriptionDiscountRedemption = {
  redemptionId: string;
  businessId: string;
  businessName: string;
  planCode: string;
  cadence: string;
  accountKey: string;
  status: "pending" | "applied" | "void" | "expired";
  discountMinor: number;
  createdAt: string;
  appliedAt?: string;
};

export type AdminSubscriptionDiscountCode = {
  discountCodeId: string;
  code: string;
  discountType: AdminSubscriptionDiscountType;
  discountValue: number;
  eligiblePlans: string[];
  eligibleCadences: string[];
  firstPurchaseOnly: boolean;
  maxRedemptionsTotal?: number;
  maxPerAccount: number;
  validFrom?: string;
  validUntil?: string;
  active: boolean;
  ownerName: string;
  batchLabel: string;
  stackable: boolean;
  archivedAt?: string;
  redemptionCount: number;
  appliedCount: number;
  discountMinor: number;
  recentRedemptions: AdminSubscriptionDiscountRedemption[];
  createdAt: string;
  updatedAt: string;
};
type AdminSubscriptionDiscountRedemptionPayload = {
  redemption_id: string;
  business_id: string;
  business_name: string;
  plan_code: string;
  cadence: string;
  account_key: string;
  status: "pending" | "applied" | "void" | "expired";
  discount_minor: number;
  created_at: string;
  applied_at?: string;
};

type AdminSubscriptionDiscountCodePayload = {
  discount_code_id: string;
  code: string;
  discount_type: AdminSubscriptionDiscountType;
  discount_value: number;
  eligible_plans: string[];
  eligible_cadences: string[];
  first_purchase_only: boolean;
  max_redemptions_total?: number;
  max_per_account: number;
  valid_from?: string;
  valid_until?: string;
  active: boolean;
  owner_name: string;
  batch_label: string;
  stackable: boolean;
  archived_at?: string;
  redemption_count: number;
  applied_count: number;
  discount_minor: number;
  recent_redemptions: AdminSubscriptionDiscountRedemptionPayload[];
  created_at: string;
  updated_at: string;
};
function mapSubscriptionDiscountCode(
  payload: AdminSubscriptionDiscountCodePayload,
): AdminSubscriptionDiscountCode {
  return {
    discountCodeId: payload.discount_code_id,
    code: payload.code,
    discountType: payload.discount_type,
    discountValue: payload.discount_value,
    eligiblePlans: payload.eligible_plans ?? [],
    eligibleCadences: payload.eligible_cadences ?? [],
    firstPurchaseOnly: payload.first_purchase_only,
    maxRedemptionsTotal: payload.max_redemptions_total,
    maxPerAccount: payload.max_per_account,
    validFrom: payload.valid_from,
    validUntil: payload.valid_until,
    active: payload.active,
    ownerName: payload.owner_name,
    batchLabel: payload.batch_label,
    stackable: payload.stackable,
    archivedAt: payload.archived_at,
    redemptionCount: payload.redemption_count,
    appliedCount: payload.applied_count,
    discountMinor: payload.discount_minor,
    recentRedemptions: payload.recent_redemptions.map((redemption) => ({
      redemptionId: redemption.redemption_id,
      businessId: redemption.business_id,
      businessName: redemption.business_name,
      planCode: redemption.plan_code,
      cadence: redemption.cadence,
      accountKey: redemption.account_key,
      status: redemption.status,
      discountMinor: redemption.discount_minor,
      createdAt: redemption.created_at,
      appliedAt: redemption.applied_at,
    })),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}
function subscriptionDiscountPayload(input: {
  code: string;
  discountType: AdminSubscriptionDiscountType;
  discountValue: number;
  eligiblePlans: string[];
  eligibleCadences: string[];
  firstPurchaseOnly: boolean;
  maxRedemptionsTotal?: number;
  maxPerAccount: number;
  validFrom?: string;
  validUntil?: string;
  active: boolean;
  ownerName: string;
  batchLabel: string;
}) {
  return {
    code: input.code,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    eligible_plans: input.eligiblePlans,
    eligible_cadences: input.eligibleCadences,
    first_purchase_only: input.firstPurchaseOnly,
    max_redemptions_total: input.maxRedemptionsTotal,
    max_per_account: input.maxPerAccount,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
    active: input.active,
    owner_name: input.ownerName,
    batch_label: input.batchLabel,
    stackable: false,
  };
}

export const subscriptionDiscountsApi = {
  subscriptionDiscountCodes: async (accessToken: string) => {
    const payload = await requestJSON<{
      discount_codes: AdminSubscriptionDiscountCodePayload[];
    }>("/admin/subscription-discounts", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.discount_codes.map(mapSubscriptionDiscountCode);
  },
  createSubscriptionDiscountCode: (
    accessToken: string,
    input: {
      code: string;
      discountType: AdminSubscriptionDiscountType;
      discountValue: number;
      eligiblePlans: string[];
      eligibleCadences: string[];
      firstPurchaseOnly: boolean;
      maxRedemptionsTotal?: number;
      maxPerAccount: number;
      validFrom?: string;
      validUntil?: string;
      active: boolean;
      ownerName: string;
      batchLabel: string;
    },
  ) =>
    requestJSON<AdminSubscriptionDiscountCodePayload>(
      "/admin/subscription-discounts",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(subscriptionDiscountPayload(input)),
      },
    ).then(mapSubscriptionDiscountCode),
  updateSubscriptionDiscountCode: (
    accessToken: string,
    discountCodeId: string,
    input: {
      code: string;
      discountType: AdminSubscriptionDiscountType;
      discountValue: number;
      eligiblePlans: string[];
      eligibleCadences: string[];
      firstPurchaseOnly: boolean;
      maxRedemptionsTotal?: number;
      maxPerAccount: number;
      validFrom?: string;
      validUntil?: string;
      active: boolean;
      ownerName: string;
      batchLabel: string;
    },
  ) =>
    requestJSON<AdminSubscriptionDiscountCodePayload>(
      `/admin/subscription-discounts/${encodeURIComponent(discountCodeId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(subscriptionDiscountPayload(input)),
      },
    ).then(mapSubscriptionDiscountCode),
  archiveSubscriptionDiscountCode: (
    accessToken: string,
    discountCodeId: string,
    reason: string,
  ) =>
    requestJSON<AdminSubscriptionDiscountCodePayload>(
      `/admin/subscription-discounts/${encodeURIComponent(discountCodeId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscriptionDiscountCode),
};
