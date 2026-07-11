import type {
  AdminPromotionDiscountType,
  AdminPromotionFundingSource,
  AdminPromotionScope,
  AdminPromotionStatus,
  AdminAdPlacementType,
  AdminAdCampaignStatus,
  AdminAffiliateEntityType,
  AdminAffiliateCommissionModel,
  AdminAffiliatePayoutMode,
  AdminAffiliateStatus,
  AdminReferralAudience,
  AdminReferralRewardKind,
  AdminReferralRefereeRewardKind,
  AdminReferralRewardType,
  AdminReferralProgrammeStatus,
  AdminReferralCodeOwnerType,
  AdminReferralCodeStatus,
} from "../../lib/api";

export const promotionDiscountTypeOptions: {
  value: AdminPromotionDiscountType;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
];

export const promotionFundingSourceOptions: {
  value: AdminPromotionFundingSource;
  label: string;
}[] = [
  { value: "business", label: "Business funded" },
  { value: "platform", label: "Platform funded" },
  { value: "split", label: "Split funded" },
];

export const promotionScopeOptions: { value: AdminPromotionScope; label: string }[] = [
  { value: "store", label: "Whole store" },
  { value: "collection", label: "Collection" },
  { value: "design", label: "Design" },
];

export const promotionStatusOptions: {
  value: Exclude<AdminPromotionStatus, "archived">;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

export const adPlacementOptions: { value: AdminAdPlacementType; label: string }[] = [
  { value: "featured_business", label: "Featured business" },
  { value: "promoted_design", label: "Promoted design" },
  { value: "homepage_hero", label: "Homepage hero" },
];

export const adCampaignStatusOptions: {
  value: Exclude<AdminAdCampaignStatus, "archived">;
  label: string;
}[] = [
  { value: "pending_review", label: "Pending review" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

export const affiliateEntityOptions: {
  value: AdminAffiliateEntityType;
  label: string;
}[] = [
  { value: "person", label: "Person" },
  { value: "business", label: "Business" },
  { value: "agency", label: "Agency" },
];

export const affiliateCommissionOptions: {
  value: AdminAffiliateCommissionModel;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "flat", label: "Flat fee" },
];

export const affiliatePayoutOptions: {
  value: AdminAffiliatePayoutMode;
  label: string;
}[] = [
  { value: "paystack_split", label: "Paystack split" },
  { value: "paystack_transfer", label: "Paystack transfer" },
  { value: "voucher", label: "Voucher fallback" },
  { value: "manual", label: "Manual review" },
];

export const affiliateStatusOptions: {
  value: Exclude<AdminAffiliateStatus, "archived">;
  label: string;
}[] = [
  { value: "pending_review", label: "Pending review" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

export const referralAudienceOptions: {
  value: AdminReferralAudience;
  label: string;
}[] = [
  { value: "customers", label: "Customers" },
  { value: "businesses", label: "Businesses" },
  { value: "mixed", label: "Customers and businesses" },
];

export const referralRewardKindOptions: {
  value: AdminReferralRewardKind;
  label: string;
}[] = [
  { value: "voucher", label: "Voucher" },
  { value: "commission_rebate", label: "Commission rebate" },
  { value: "none", label: "No referrer reward" },
];

export const referralRefereeRewardKindOptions: {
  value: AdminReferralRefereeRewardKind;
  label: string;
}[] = [
  { value: "voucher", label: "Voucher" },
  { value: "none", label: "No new-customer reward" },
];

export const referralRewardTypeOptions: {
  value: AdminReferralRewardType;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
];

export const referralStatusOptions: {
  value: Exclude<AdminReferralProgrammeStatus, "archived">;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

export const referralCodeOwnerOptions: {
  value: Exclude<AdminReferralCodeOwnerType, "customer">;
  label: string;
}[] = [
  { value: "platform", label: "Platform" },
  { value: "business", label: "Business" },
];

export const referralCodeStatusOptions: {
  value: Exclude<AdminReferralCodeStatus, "archived">;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];
