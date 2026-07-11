import { PLAN_BENEFITS } from "../../lib/api";
import type { AdminPlan, AdminSubscription, AdminPlanEntitlementFeature } from "../shared/types";
import { tokens } from "../../theme";
import { AdminSubscriptionPlanMeta } from "./types";



export function subscriptionPlanFor(plan: string): AdminSubscriptionPlanMeta {
  const normalized = plan.trim().toLowerCase();
  return (
    subscriptionPlanMeta.find(
      (candidate) =>
        normalized === candidate.code ||
        normalized === candidate.name.toLowerCase() ||
        normalized.includes(candidate.code),
    ) ?? freeSubscriptionPlanMeta
  );
}



export function fallbackAdminPlans(): AdminPlan[] {
  return subscriptionPlanMeta.map((plan) => ({
    planId: plan.code,
    code: plan.code,
    name: plan.name,
    monthlyFeeMinor: plan.monthlyFeeMinor,
    yearlyFeeMinor: plan.yearlyFeeMinor,
    commissionBps: plan.commissionBps,
    designLimit: plan.code === "free" ? 10 : undefined,
    features: Object.fromEntries(
      (plan.code === "growth"
        ? [
            "custom_brand_color",
            "custom_logo",
            "custom_banner",
            "custom_layout",
            "design_waitlist",
          ]
        : plan.code === "standard"
          ? ["custom_brand_color"]
          : []
      ).map((key) => [key, true]),
    ),
    isActive: true,
    businessCount: 0,
    activeSubscriptionCount: 0,
    estimatedMrrMinor: 0,
    createdAt: "",
    updatedAt: "",
  }));
}



export function planVisualFor(code: string): { promise: string; tone: string } {
  const normalized = code.trim().toLowerCase();
  const match = subscriptionPlanMeta.find((plan) => plan.code === normalized);
  return {
    promise:
      match?.promise ??
      "Operator-defined package for a specific growth motion.",
    tone: match?.tone ?? tokens.burgundy,
  };
}



export function planDesignLimitLabel(plan: Pick<AdminPlan, "designLimit">): string {
  return typeof plan.designLimit === "number"
    ? `${plan.designLimit} designs`
    : "Unlimited";
}



export function grantedPlanBenefitKeys(features: Record<string, boolean>): string[] {
  return PLAN_BENEFITS.map((benefit) => benefit.key).filter(
    (key) => features[key],
  );
}



export function subscriptionDesignUsageLabel(
  subscription: Pick<AdminSubscription, "designCount" | "designLimit">,
): string {
  if (typeof subscription.designLimit === "number") {
    return `${subscription.designCount}/${subscription.designLimit} active designs`;
  }
  return `${subscription.designCount} active designs`;
}



export function planMonthlyFeeDefault(
  plan: Pick<AdminPlan, "monthlyFeeMinor">,
): string {
  return (plan.monthlyFeeMinor / 100).toFixed(2);
}



export function planYearlyFeeDefault(plan: Pick<AdminPlan, "yearlyFeeMinor">): string {
  return (plan.yearlyFeeMinor / 100).toFixed(2);
}



export function planEntitlementValue(
  feature: AdminPlanEntitlementFeature,
  plan: AdminPlan,
) {
  return feature.values.find(
    (value) => value.planId === plan.planId || value.planCode === plan.code,
  );
}



export function entitlementValueLabel(
  feature: AdminPlanEntitlementFeature,
  plan: AdminPlan,
): string {
  const value = planEntitlementValue(feature, plan);
  if (!value?.enabled) {
    return "Locked";
  }
  if (feature.valueType === "limit") {
    return typeof value.limitValue === "number"
      ? `${value.limitValue} ${feature.unit || ""}`.trim()
      : "Unlimited";
  }
  return "Included";
}
export const freeSubscriptionPlanMeta: AdminSubscriptionPlanMeta = {
  code: "free",
  name: "Free - Get Online",
  monthlyFeeMinor: 0,
  yearlyFeeMinor: 0,
  commissionBps: 300,
  designLimit: "10 designs",
  promise: "Starter storefront, higher commission.",
  tone: tokens.warning,
};

export const subscriptionPlanMeta: AdminSubscriptionPlanMeta[] = [
  freeSubscriptionPlanMeta,
  {
    code: "standard",
    name: "Standard",
    monthlyFeeMinor: 5000,
    yearlyFeeMinor: 60000,
    commissionBps: 100,
    designLimit: "Unlimited",
    promise: "Lower commission for active shops.",
    tone: tokens.info,
  },
  {
    code: "growth",
    name: "Growth",
    monthlyFeeMinor: 12000,
    yearlyFeeMinor: 144000,
    commissionBps: 50,
    designLimit: "Unlimited",
    promise: "Lowest commission for scaling teams.",
    tone: tokens.success,
  },
];
