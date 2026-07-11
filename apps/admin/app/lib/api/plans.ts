import { requestJSON } from "./utils";

export const PLAN_BENEFITS: readonly {
  key: string;
  label: string;
  description: string;
}[] = [
  {
    key: "custom_brand_color",
    label: "Storefront accent colour",
    description:
      "Set the storefront's accent colour instead of the Xtiitch wine default.",
  },
  {
    key: "custom_logo",
    label: "Custom storefront logo",
    description:
      "Show the business logo on the storefront in place of the Xtiitch mark.",
  },
  {
    key: "custom_banner",
    label: "Custom hero banner image",
    description:
      "Replace the default storefront hero with the business's own banner image.",
  },
  {
    key: "custom_layout",
    label: "Storefront layout variants",
    description:
      "Choose a storefront hero layout (standard, spotlight or minimal).",
  },
  {
    key: "design_waitlist",
    label: "Design waiting lists",
    description:
      "Open a waiting list on a design so customers can register interest.",
  },
  {
    key: "online_ordering",
    label: "Online ordering & checkout",
    description:
      "Let customers place and pay for orders from the storefront. Without it the store is a catalogue and customers order off-platform.",
  },
];

export type PlanFeatures = Record<string, boolean>;

export type AdminPlan = {
  planId: string;
  code: string;
  name: string;
  monthlyFeeMinor: number;
  yearlyFeeMinor: number;
  commissionBps: number;
  designLimit?: number;
  features: PlanFeatures;
  isActive: boolean;
  businessCount: number;
  activeSubscriptionCount: number;
  estimatedMrrMinor: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminPlanEntitlementValue = {
  planId: string;
  planCode: string;
  enabled: boolean;
  limitValue?: number;
  updatedAt: string;
};

export type AdminPlanEntitlementFeature = {
  featureKey: string;
  label: string;
  description: string;
  category: string;
  valueType: "boolean" | "limit";
  unit: string;
  sortOrder: number;
  isActive: boolean;
  values: AdminPlanEntitlementValue[];
  createdAt: string;
  updatedAt: string;
};
type AdminPlanPayload = {
  plan_id: string;
  code: string;
  name: string;
  monthly_fee_minor: number;
  yearly_fee_minor: number;
  commission_bps: number;
  design_limit?: number;
  features?: Record<string, boolean> | null;
  is_active: boolean;
  business_count: number;
  active_subscription_count: number;
  estimated_mrr_minor: number;
  created_at: string;
  updated_at: string;
};

type AdminPlanEntitlementValuePayload = {
  plan_id: string;
  plan_code: string;
  enabled: boolean;
  limit_value?: number;
  updated_at: string;
};

type AdminPlanEntitlementFeaturePayload = {
  feature_key: string;
  label: string;
  description: string;
  category: string;
  value_type: "boolean" | "limit";
  unit: string;
  sort_order: number;
  is_active: boolean;
  values: AdminPlanEntitlementValuePayload[];
  created_at: string;
  updated_at: string;
};
function mapPlan(payload: AdminPlanPayload): AdminPlan {
  return {
    planId: payload.plan_id,
    code: payload.code,
    name: payload.name,
    monthlyFeeMinor: payload.monthly_fee_minor,
    yearlyFeeMinor: payload.yearly_fee_minor ?? 0,
    commissionBps: payload.commission_bps,
    designLimit: payload.design_limit,
    features: payload.features ?? {},
    isActive: payload.is_active,
    businessCount: payload.business_count,
    activeSubscriptionCount: payload.active_subscription_count,
    estimatedMrrMinor: payload.estimated_mrr_minor,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapPlanEntitlementFeature(
  payload: AdminPlanEntitlementFeaturePayload,
): AdminPlanEntitlementFeature {
  return {
    featureKey: payload.feature_key,
    label: payload.label,
    description: payload.description,
    category: payload.category,
    valueType: payload.value_type,
    unit: payload.unit,
    sortOrder: payload.sort_order,
    isActive: payload.is_active,
    values: payload.values.map((value) => ({
      planId: value.plan_id,
      planCode: value.plan_code,
      enabled: value.enabled,
      limitValue: value.limit_value,
      updatedAt: value.updated_at,
    })),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

export const plansApi = {
  plans: async (accessToken: string) => {
    const payload = await requestJSON<{ plans: AdminPlanPayload[] }>(
      "/admin/plans",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.plans.map(mapPlan);
  },
  createPlan: (
    accessToken: string,
    input: {
      code: string;
      name: string;
      monthlyFeeMinor: number;
      yearlyFeeMinor: number;
      commissionBps: number;
      designLimit?: number;
      features?: Record<string, boolean>;
    },
  ) =>
    requestJSON<AdminPlanPayload>("/admin/plans", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        code: input.code,
        name: input.name,
        monthly_fee_minor: input.monthlyFeeMinor,
        yearly_fee_minor: input.yearlyFeeMinor,
        commission_bps: input.commissionBps,
        design_limit: input.designLimit,
        features: input.features ?? {},
      }),
    }).then(mapPlan),
  updatePlan: (
    accessToken: string,
    planId: string,
    input: {
      name: string;
      monthlyFeeMinor: number;
      yearlyFeeMinor: number;
      commissionBps: number;
      designLimit?: number;
      features?: Record<string, boolean>;
      isActive: boolean;
    },
  ) =>
    requestJSON<AdminPlanPayload>(
      `/admin/plans/${encodeURIComponent(planId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: input.name,
          monthly_fee_minor: input.monthlyFeeMinor,
          yearly_fee_minor: input.yearlyFeeMinor,
          commission_bps: input.commissionBps,
          design_limit: input.designLimit,
          features: input.features ?? {},
          is_active: input.isActive,
        }),
      },
    ).then(mapPlan),
  archivePlan: (accessToken: string, planId: string, reason: string) =>
    requestJSON<AdminPlanPayload>(
      `/admin/plans/${encodeURIComponent(planId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapPlan),
  planEntitlements: async (accessToken: string) => {
    const payload = await requestJSON<{
      features: AdminPlanEntitlementFeaturePayload[];
    }>("/admin/plan-entitlements", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.features.map(mapPlanEntitlementFeature);
  },
  updatePlanEntitlements: (
    accessToken: string,
    input: {
      values: {
        planId: string;
        featureKey: string;
        enabled: boolean;
        limitValue?: number;
      }[];
    },
  ) =>
    requestJSON<{ features: AdminPlanEntitlementFeaturePayload[] }>(
      "/admin/plan-entitlements",
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          values: input.values.map((value) => ({
            plan_id: value.planId,
            feature_key: value.featureKey,
            enabled: value.enabled,
            limit_value: value.limitValue,
          })),
        }),
      },
    ).then((payload) => payload.features.map(mapPlanEntitlementFeature)),
};
