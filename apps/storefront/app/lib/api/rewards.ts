import { enc, getJSON, postJSON, type TenantScope } from "./core";
import type { AffiliateClick, AffiliateClickInput, ReferralCode } from "./types";

export const referral = (code: string, tenant?: TenantScope) =>
  getJSON<ReferralCode>(`/public/referrals/${enc(code)}`, tenant);

export const recordAffiliateClick = (
  code: string,
  input: AffiliateClickInput,
  tenant?: TenantScope,
) =>
  postJSON<AffiliateClick>(`/public/affiliates/${enc(code)}/clicks`, input, tenant);
