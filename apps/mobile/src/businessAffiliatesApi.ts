import { request } from "./businessApi";

export type BusinessAffiliateProgramme = {
  affiliate_programme_id: string;
  name: string;
  description: string;
  status: string;
  default_purchase_commission_bps: number;
  default_first_paid_plan_commission_bps: number;
  cookie_window_days: number;
  hold_days: number;
  payout_mode: string;
  minimum_payout_minor: number;
  allowed_target_scope: string;
  affiliate_count: number;
};
export type BusinessAffiliate = {
  affiliate_id: string;
  affiliate_programme_id: string;
  programme_name: string;
  code: string;
  display_name: string;
  contact_name: string;
  email: string;
  phone: string;
  purchase_commission_bps: number;
  first_paid_plan_commission_bps: number;
  cookie_window_days: number;
  status: string;
  target_scope: string;
  target_ref_id?: string;
};
export type AffiliateAttribution = {
  affiliate_id: string;
  code: string;
  display_name: string;
  click_count: number;
  signup_count: number;
  conversion_count: number;
  gross_minor: number;
  commission_minor: number;
  last_activity_at?: string;
};

export const businessAffiliatesApi = {
  programmes: () =>
    request<{ programmes: BusinessAffiliateProgramme[] }>(
      "/business/affiliate-programmes",
    ),
  affiliates: () =>
    request<{ affiliates: BusinessAffiliate[] }>("/business/affiliates"),
  attribution: () =>
    request<{ attribution: AffiliateAttribution[] }>(
      "/business/affiliate-attribution",
    ),
  createProgramme: (
    input: Omit<
      BusinessAffiliateProgramme,
      "affiliate_programme_id" | "affiliate_count"
    >,
  ) =>
    request<BusinessAffiliateProgramme>("/business/affiliate-programmes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateProgramme: (
    id: string,
    input: Omit<
      BusinessAffiliateProgramme,
      "affiliate_programme_id" | "affiliate_count"
    >,
  ) =>
    request<BusinessAffiliateProgramme>(
      `/business/affiliate-programmes/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
  createAffiliate: (
    input: Omit<BusinessAffiliate, "affiliate_id" | "programme_name">,
  ) =>
    request<BusinessAffiliate>("/business/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateAffiliate: (
    id: string,
    input: Omit<BusinessAffiliate, "affiliate_id" | "programme_name">,
  ) =>
    request<BusinessAffiliate>(
      `/business/affiliates/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
  pauseAffiliate: (id: string) =>
    request<BusinessAffiliate>(
      `/business/affiliates/${encodeURIComponent(id)}/pause`,
      { method: "POST" },
    ),
};
