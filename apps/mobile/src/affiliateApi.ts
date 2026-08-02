import { affiliateRequest, type AffiliateAccount } from "./affiliateAuth";

export type AffiliateDashboard = {
  clicks: number;
  customer_signups: number;
  business_signups: number;
  paid_plan_signups: number;
  purchases: number;
  gross_eligible_minor: number;
  click_to_signup_rate_bps: number;
  click_to_purchase_rate_bps: number;
  pending_commission_minor: number;
  available_commission_minor: number;
  paid_commission_minor: number;
  reversed_commission_minor: number;
  lifetime_earnings_minor: number;
};

export type AffiliateConversion = {
  conversion_id: string;
  conversion_type: string;
  gross_minor: number;
  commission_minor: number;
  status: string;
  occurred_at: string;
};

export type AffiliatePayout = {
  payout_id: string;
  payout_reference: string;
  commission_minor: number;
  status: string;
  created_at: string;
};

export type AffiliateShare = {
  code: string;
  canonical_url: string;
  cookie_window_days: number;
};

export type AffiliateCampaign = {
  campaign_link_id: string;
  name: string;
  slug: string;
  destination_url: string;
};

export type AffiliatePayoutProfile = {
  payout_method: string;
  account_name: string;
  provider_name: string;
  masked_identifier: string;
  status: string;
};

export type AffiliatePreferences = {
  conversion_emails: boolean;
  approval_emails: boolean;
  reversal_emails: boolean;
  payout_emails: boolean;
};

const json = (body: unknown): RequestInit => ({
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const affiliateApi = {
  me: () => affiliateRequest<AffiliateAccount>("/affiliate/me"),
  dashboard: () => affiliateRequest<AffiliateDashboard>("/affiliate/dashboard"),
  conversions: () =>
    affiliateRequest<{ conversions: AffiliateConversion[] }>(
      "/affiliate/conversions",
    ),
  payouts: () =>
    affiliateRequest<{ payouts: AffiliatePayout[] }>("/affiliate/payouts"),
  share: () => affiliateRequest<AffiliateShare>("/affiliate/share-links"),
  campaigns: () =>
    affiliateRequest<{ campaign_links: AffiliateCampaign[] }>(
      "/affiliate/campaign-links",
    ),
  createCampaign: (body: {
    name: string;
    slug: string;
    destination_url: string;
  }) =>
    affiliateRequest<AffiliateCampaign>("/affiliate/campaign-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  payoutProfile: () =>
    affiliateRequest<AffiliatePayoutProfile>("/affiliate/payout-profile"),
  updatePayoutProfile: (body: {
    payout_method: string;
    account_name: string;
    provider_name: string;
    account_identifier: string;
  }) =>
    affiliateRequest<AffiliatePayoutProfile>(
      "/affiliate/payout-profile",
      json(body),
    ),
  preferences: () =>
    affiliateRequest<AffiliatePreferences>(
      "/affiliate/notification-preferences",
    ),
  updatePreferences: (body: AffiliatePreferences) =>
    affiliateRequest<AffiliatePreferences>(
      "/affiliate/notification-preferences",
      json(body),
    ),
};
