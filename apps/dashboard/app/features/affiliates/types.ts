export type BusinessAffiliateProgramme = {
  affiliate_programme_id: string;
  business_id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "archived";
  default_purchase_commission_bps: number;
  default_first_paid_plan_commission_bps: number;
  cookie_window_days: number;
  hold_days: number;
  payout_mode: "manual" | "voucher" | "paystack_transfer" | "paystack_split";
  minimum_payout_minor: number;
  allowed_target_scope: "store" | "collection" | "design" | "product";
  affiliate_count: number;
  created_at: string;
  updated_at: string;
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
  status: "active" | "paused";
  target_scope: "store" | "collection" | "design" | "product";
  target_ref_id?: string;
  created_at: string;
  updated_at: string;
};

export type BusinessAffiliateAttribution = {
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

export type BusinessAffiliateData = {
  programmes: BusinessAffiliateProgramme[];
  affiliates: BusinessAffiliate[];
  attribution: BusinessAffiliateAttribution[];
};

export const defaultBusinessAffiliateData: BusinessAffiliateData = {
  programmes: [],
  affiliates: [],
  attribution: [],
};
