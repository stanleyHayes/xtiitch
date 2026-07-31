import { requestJSON } from "./utils";

export type AdminGrowthReport = {
  from: string;
  to: string;
  metrics: {
    clicks: number;
    customer_signups: number;
    business_signups: number;
    purchase_conversions: number;
    paid_plan_conversions: number;
    gross_eligible_minor: number;
    store_discount_minor: number;
    paid_plan_discount_minor: number;
    pending_commission_minor: number;
    approved_commission_minor: number;
    settled_commission_minor: number;
    reversed_commission_minor: number;
    payout_batches: number;
    payout_commission_minor: number;
  };
};

export const growthReportApi = {
  growthReport: (accessToken: string) =>
    requestJSON<AdminGrowthReport>("/admin/growth-report", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};
