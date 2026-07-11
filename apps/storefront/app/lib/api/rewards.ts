import { enc, getJSON, postJSON } from "./core";
import type { AffiliateClick, AffiliateClickInput, ReferralCode } from "./types";

export const referral = (code: string) =>
  getJSON<ReferralCode>(`/public/referrals/${enc(code)}`);

export const recordAffiliateClick = (code: string, input: AffiliateClickInput) =>
  postJSON<AffiliateClick>(`/public/affiliates/${enc(code)}/clicks`, input);
