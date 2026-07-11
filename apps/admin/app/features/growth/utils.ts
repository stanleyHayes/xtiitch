import type {
  AdminPromotionStatus,
  AdminPromotion,
  AdminAdCampaignStatus,
  AdminAdPlacementType,
  AdminAffiliateStatus,
  AdminAffiliateEntityType,
  AdminAffiliatePayoutMode,
  AdminAffiliate,
  AdminReferralAudience,
  AdminReferralRewardKind,
  AdminReferralRefereeRewardKind,
  AdminReferralProgrammeStatus,
  AdminReferralProgramme,
  AdminReferralRewardType,
} from "../../lib/api";
import {
  adCampaignStatusOptions,
  adPlacementOptions,
  affiliateStatusOptions,
  affiliateEntityOptions,
  affiliatePayoutOptions,
  referralAudienceOptions,
  referralRewardKindOptions,
  referralRefereeRewardKindOptions,
  referralStatusOptions,
  referralRewardTypeOptions,
} from "./options";

import { tokens } from "../../theme";
import { formatGHS, formatPercentBps } from "../shared/formatting";
import { shortID } from "../shared/dates";



export function promotionStatusColor(status: AdminPromotionStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "paused":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}



export function promotionDiscountLabel(promotion: AdminPromotion): string {
  if (promotion.discountType === "percentage") {
    return `${(promotion.discountValue / 100).toFixed(1)}%`;
  }
  return formatGHS(promotion.discountValue);
}



export function promotionTargetLabel(promotion: AdminPromotion): string {
  return promotion.businessName
    ? `${promotion.businessName} · ${promotion.businessHandle}`
    : "Platform-wide";
}



export function promotionScopeTargetLabel(promotion: AdminPromotion): string {
  if (promotion.scope === "collection") {
    return promotion.targetCollectionId
      ? `collection ${shortID(promotion.targetCollectionId)}`
      : "collection target";
  }
  if (promotion.scope === "design") {
    return promotion.targetDesignId
      ? `design ${shortID(promotion.targetDesignId)}`
      : "design target";
  }
  return "store";
}



export function promotionValueDefault(promotion: AdminPromotion): string {
  if (promotion.discountType === "percentage") {
    return (promotion.discountValue / 100).toString();
  }
  return (promotion.discountValue / 100).toFixed(2);
}



export function adCampaignStatusLabel(status: AdminAdCampaignStatus): string {
  return (
    adCampaignStatusOptions.find((option) => option.value === status)?.label ??
    (status === "archived" ? "Archived" : status)
  );
}



export function adPlacementLabel(value: AdminAdPlacementType): string {
  return (
    adPlacementOptions.find((option) => option.value === value)?.label ?? value
  );
}



export function adCampaignStatusColor(status: AdminAdCampaignStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "pending_review":
    case "paused":
      return tokens.warning;
    case "completed":
      return tokens.info;
    default:
      return tokens.mutedText;
  }
}



export function adCampaignPaymentStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return tokens.success;
    case "failed":
    case "void":
      return tokens.danger;
    case "initiated":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}



export function affiliateStatusLabel(status: AdminAffiliateStatus): string {
  return (
    affiliateStatusOptions.find((option) => option.value === status)?.label ??
    (status === "archived" ? "Archived" : status)
  );
}



export function affiliateEntityLabel(value: AdminAffiliateEntityType): string {
  return (
    affiliateEntityOptions.find((option) => option.value === value)?.label ??
    value
  );
}



export function affiliatePayoutLabel(value: AdminAffiliatePayoutMode): string {
  return (
    affiliatePayoutOptions.find((option) => option.value === value)?.label ??
    value
  );
}



export function affiliateStatusColor(status: AdminAffiliateStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "pending_review":
    case "paused":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}



export function affiliateCommissionLabel(affiliate: AdminAffiliate): string {
  if (affiliate.commissionModel === "percentage") {
    return formatPercentBps(affiliate.commissionRate);
  }
  return formatGHS(affiliate.commissionRate);
}



export function affiliateCommissionDefault(affiliate: AdminAffiliate): string {
  if (affiliate.commissionModel === "percentage") {
    return (affiliate.commissionRate / 100).toString();
  }
  return (affiliate.commissionRate / 100).toFixed(2);
}



export function referralAudienceLabel(value: AdminReferralAudience): string {
  return (
    referralAudienceOptions.find((option) => option.value === value)?.label ??
    value
  );
}



export function referralRewardKindLabel(value: AdminReferralRewardKind): string {
  return (
    referralRewardKindOptions.find((option) => option.value === value)?.label ??
    value
  );
}



export function referralRefereeRewardKindLabel(
  value: AdminReferralRefereeRewardKind,
): string {
  return (
    referralRefereeRewardKindOptions.find((option) => option.value === value)
      ?.label ?? value
  );
}



export function referralStatusLabel(status: AdminReferralProgrammeStatus): string {
  return (
    referralStatusOptions.find((option) => option.value === status)?.label ??
    (status === "archived" ? "Archived" : status)
  );
}



export function referralStatusColor(status: AdminReferralProgrammeStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "draft":
    case "paused":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}



export function referralRewardLabel(programme: AdminReferralProgramme): string {
  const value =
    programme.rewardType === "percentage"
      ? `${(programme.rewardValue / 100).toFixed(1)}%`
      : formatGHS(programme.rewardValue);
  const cap =
    programme.rewardType === "percentage" &&
    typeof programme.maxRewardMinor === "number"
      ? ` capped at ${formatGHS(programme.maxRewardMinor)}`
      : "";
  return `${value}${cap}`;
}



export function referralRewardDefault(programme: AdminReferralProgramme): string {
  if (programme.rewardType === "percentage") {
    return (programme.rewardValue / 100).toString();
  }
  return (programme.rewardValue / 100).toFixed(2);
}



export function referralRewardTypeLabel(value: AdminReferralRewardType): string {
  return (
    referralRewardTypeOptions.find((option) => option.value === value)?.label ??
    value
  );
}
