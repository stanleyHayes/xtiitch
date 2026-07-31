export type Dashboard = {
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

export type Conversion = {
  conversion_id: string;
  conversion_type: string;
  gross_minor: number;
  commission_minor: number;
  status: string;
  occurred_at: string;
};

export type Payout = {
  payout_id: string;
  payout_reference: string;
  commission_minor: number;
  status: string;
  created_at: string;
};

export type CampaignLink = {
  campaign_link_id: string;
  name: string;
  slug: string;
  destination_url: string;
};

export type ShareLinks = {
  code: string;
  canonical_url: string;
  cookie_window_days: number;
};

export type PayoutProfile = {
  payout_method: string;
  account_name: string;
  provider_name: string;
  masked_identifier: string;
  status: string;
};

export type NotificationPreferences = {
  conversion_emails: boolean;
  approval_emails: boolean;
  reversal_emails: boolean;
  payout_emails: boolean;
};

// From /affiliate/me. Settings needs the email to show which account is signed
// in and to drive the password-reset request.
export type Account = {
  account_id: string;
  affiliate_id: string;
  email: string;
  display_name: string;
  code: string;
  status: string;
};

export type PortalData = {
  dashboard: Dashboard;
  conversions: Conversion[];
  payouts: Payout[];
  share: ShareLinks;
  campaigns: CampaignLink[];
  profile: PayoutProfile;
  preferences: NotificationPreferences;
  account: Account | null;
  displayName: string | undefined;
};

// `intent` echoes back which form produced the result. Without it every card
// on the page shows the same banner, so saving your payout details also lights
// up "Saved" under the notification card.
export type PortalActionResult = {
  intent?: string;
  success?: string;
  error?: string;
};
