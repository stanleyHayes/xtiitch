import type { ReferralCode } from "../../lib/api";

export type RewardCodes = {
  promoCode: string;
  referralCode: string;
  affiliateCode: string;
  affiliateClickID: string;
  affiliateVisitorID: string;
};

export type ActionData = {
  customError: string | null;
  standardError: string | null;
  waitlistError: string | null;
  waitlistSuccess: boolean;
  rewardCodes: RewardCodes;
};

export type { ReferralCode };
