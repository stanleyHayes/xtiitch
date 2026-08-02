import { request } from "./businessApi";

export type PublicPlan = {
  code: string;
  name: string;
  quarterly_first_minor: number;
  quarterly_renewal_minor: number;
  yearly_first_minor: number;
  yearly_renewal_minor: number;
  commission_bps: number;
  design_limit?: number | null;
  vat_rate_bps: number;
};
export type Activation = {
  activated: boolean;
  status: string;
  plan_code: string;
  plan_name: string;
  amount_due_minor: number;
};

export const businessBillingApi = {
  plans: () => request<PublicPlan[]>("/plans"),
  activation: () =>
    request<Activation>("/auth/business/subscription/activation"),
  authorizationLink: (
    planCode: string,
    cadence: "quarterly" | "yearly",
    callbackUrl: string,
  ) =>
    request<{ redirect_url: string; activated: boolean; reference: string }>(
      "/auth/business/subscription/authorization-link",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_code: planCode,
          billing_cadence: cadence,
          callback_url: callbackUrl,
          code: "",
        }),
      },
    ),
  verify: (reference: string) =>
    request<{ status: string }>(
      "/auth/business/subscription/authorization-verifications",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      },
    ),
};
