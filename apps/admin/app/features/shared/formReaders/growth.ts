import type {
  AdminPromotionDiscountType,
  AdminPromotionFundingSource,
  AdminPromotionScope,
  AdminPromotionStatus,
  AdminAdPlacementType,
  AdminAdCampaignStatus,
  AdminAdPricingModel,
  AdminAffiliateEntityType,
  AdminAffiliateCommissionModel,
  AdminAffiliatePayoutMode,
  AdminAffiliateStatus,
  AdminAffiliateConversion,
  AdminReferralAudience,
  AdminReferralRewardKind,
  AdminReferralRefereeRewardKind,
  AdminReferralRewardType,
  AdminReferralProgrammeStatus,
  AdminReferralCodeOwnerType,
  AdminReferralCodeStatus,
} from "../types";
import { readGhsPesewas, readNumber } from "../validation";

export function readPromotionDiscountType(
  value: FormDataEntryValue | null,
): AdminPromotionDiscountType {
  return String(value ?? "") === "fixed" ? "fixed" : "percentage";
}

export function readPromotionFundingSource(
  value: FormDataEntryValue | null,
): AdminPromotionFundingSource {
  const source = String(value ?? "");
  if (source === "platform" || source === "split") {
    return source;
  }
  return "business";
}

export function readPromotionScope(
  value: FormDataEntryValue | null,
): AdminPromotionScope {
  const scope = String(value ?? "");
  if (scope === "collection" || scope === "design") {
    return scope;
  }
  return "store";
}

export function readPromotionEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminPromotionStatus, "archived"> {
  return String(value ?? "") === "paused" ? "paused" : "active";
}

export function readAdPlacementType(
  value: FormDataEntryValue | null,
): AdminAdPlacementType {
  const placement = String(value ?? "");
  if (placement === "promoted_design" || placement === "homepage_hero") {
    return placement;
  }
  return "featured_business";
}

export function readAdCampaignEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminAdCampaignStatus, "archived"> {
  const status = String(value ?? "");
  if (status === "active" || status === "paused" || status === "completed") {
    return status;
  }
  return "pending_review";
}

export function readAdPricingModel(
  _value: FormDataEntryValue | null,
): AdminAdPricingModel {
  return "flat_time";
}

export function readAffiliateEntityType(
  value: FormDataEntryValue | null,
): AdminAffiliateEntityType {
  const entityType = String(value ?? "");
  if (entityType === "business" || entityType === "agency") {
    return entityType;
  }
  return "person";
}

export function readAffiliateCommissionModel(
  value: FormDataEntryValue | null,
): AdminAffiliateCommissionModel {
  return String(value ?? "") === "flat" ? "flat" : "percentage";
}

export function readAffiliatePayoutMode(
  value: FormDataEntryValue | null,
): AdminAffiliatePayoutMode {
  const mode = String(value ?? "");
  if (mode === "paystack_split" || mode === "paystack_transfer" || mode === "manual") {
    return mode;
  }
  return "voucher";
}

export function readAffiliateEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminAffiliateStatus, "archived"> {
  const status = String(value ?? "");
  if (status === "active" || status === "paused") {
    return status;
  }
  return "pending_review";
}

export function readAffiliateConversionStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminAffiliateConversion["status"], "pending"> {
  const status = String(value ?? "");
  if (status === "settled" || status === "reversed") {
    return status;
  }
  return "approved";
}

export function readReferralAudience(
  value: FormDataEntryValue | null,
): AdminReferralAudience {
  const audience = String(value ?? "");
  if (audience === "businesses" || audience === "mixed") {
    return audience;
  }
  return "customers";
}

export function readReferralRewardKind(
  value: FormDataEntryValue | null,
): AdminReferralRewardKind {
  const kind = String(value ?? "");
  if (kind === "commission_rebate" || kind === "none") {
    return kind;
  }
  return "voucher";
}

export function readReferralRefereeRewardKind(
  value: FormDataEntryValue | null,
): AdminReferralRefereeRewardKind {
  return String(value ?? "") === "none" ? "none" : "voucher";
}

export function readReferralRewardType(
  value: FormDataEntryValue | null,
): AdminReferralRewardType {
  return String(value ?? "") === "fixed" ? "fixed" : "percentage";
}

export function readReferralEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminReferralProgrammeStatus, "archived"> {
  const status = String(value ?? "");
  if (status === "active" || status === "paused") {
    return status;
  }
  return "draft";
}

export function readReferralCodeOwnerType(
  value: FormDataEntryValue | null,
): Exclude<AdminReferralCodeOwnerType, "customer"> {
  return String(value ?? "") === "business" ? "business" : "platform";
}

export function readReferralCodeStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminReferralCodeStatus, "archived"> {
  return String(value ?? "") === "paused" ? "paused" : "active";
}

export function readAffiliateCommissionValue(
  modelValue: FormDataEntryValue | null,
  value: FormDataEntryValue | null,
): number {
  if (readAffiliateCommissionModel(modelValue) === "percentage") {
    return Math.round(readNumber(value, 0) * 100);
  }
  return readGhsPesewas(value);
}

export function readReferralRewardValue(
  rewardType: AdminReferralRewardType,
  value: FormDataEntryValue | null,
): number {
  if (rewardType === "percentage") {
    return Math.round(readNumber(value, 0) * 100);
  }
  return readGhsPesewas(value);
}

export function readPromotionDiscountValue(
  discountType: AdminPromotionDiscountType,
  value: FormDataEntryValue | null,
): number {
  if (discountType === "percentage") {
    return Math.round(readNumber(value, 0) * 100);
  }
  return readGhsPesewas(value);
}
