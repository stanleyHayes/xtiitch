import { api, type CustomSizeMode, type Design, type ReferralCode, type StoreSummary } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import type { RewardCodes } from "./types";

export function availabilityRangeForRequest() {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 28);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function relatedDesignsFor(current: Design, designs: Design[]): Design[] {
  const sameCollection = (design: Design) =>
    Boolean(current.collection_id) &&
    design.collection_id === current.collection_id;

  return designs
    .filter(
      (design) =>
        design.design_id !== current.design_id &&
        design.handle !== current.handle,
    )
    .sort((a, b) => {
      const collectionDelta =
        Number(sameCollection(b)) - Number(sameCollection(a));
      if (collectionDelta !== 0) {
        return collectionDelta;
      }
      return a.sequence - b.sequence || a.title.localeCompare(b.title);
    })
    .slice(0, 3);
}

export function actionFailure(
  rewardCodes: RewardCodes,
  standardError: string | null,
  customError: string | null,
) {
  return {
    customError,
    rewardCodes,
    standardError,
    waitlistError: null as string | null,
    waitlistSuccess: false,
  };
}

export function toCustomSizeMode(value: string): CustomSizeMode | null {
  if (
    value === "self_measure" ||
    value === "home_visit" ||
    value === "come_to_shop"
  ) {
    return value;
  }
  return null;
}

export function collectMeasurements(form: FormData): Record<string, string> {
  const measurements: Record<string, string> = {};
  for (const rawFieldID of form.getAll("measurement_field_id")) {
    const fieldID = String(rawFieldID).trim();
    const value = String(form.get(`measurement_${fieldID}`) ?? "").trim();
    if (fieldID && value) {
      measurements[fieldID] = value;
    }
  }
  return measurements;
}

export function cleanRewardCode(value: FormDataEntryValue | string | null): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export async function rewardCodesFromRequest(request: Request): Promise<RewardCodes> {
  const url = new URL(request.url);
  const codes = {
    promoCode: cleanRewardCode(
      url.searchParams.get("promo_code") ?? url.searchParams.get("promo"),
    ),
    referralCode: cleanRewardCode(
      url.searchParams.get("referral_code") ??
        url.searchParams.get("referral") ??
        url.searchParams.get("ref"),
    ),
    affiliateCode: cleanRewardCode(
      url.searchParams.get("affiliate_code") ??
        url.searchParams.get("affiliate"),
    ),
    affiliateClickID: String(
      url.searchParams.get("affiliate_click_id") ??
        url.searchParams.get("click_id") ??
        "",
    ).trim(),
    affiliateVisitorID: String(
      url.searchParams.get("affiliate_visitor_id") ??
        url.searchParams.get("visitor_id") ??
        "",
    ).trim(),
  };

  if (!codes.affiliateCode || codes.affiliateClickID) {
    return codes;
  }

  const visitorID = codes.affiliateVisitorID || newAffiliateVisitorID();
  const response = await api
    .recordAffiliateClick(codes.affiliateCode, {
      visitor_id: visitorID,
      landing_url: request.url,
      referrer_url: request.headers.get("referer") ?? "",
    })
    .catch(() => null);

  return {
    ...codes,
    affiliateClickID: response?.ok ? response.result.click_id : "",
    affiliateVisitorID: visitorID,
  };
}

export function rewardCodesFromForm(form: FormData): RewardCodes {
  return {
    promoCode: cleanRewardCode(form.get("promo_code")),
    referralCode: cleanRewardCode(form.get("referral_code")),
    affiliateCode: cleanRewardCode(form.get("affiliate_code")),
    affiliateClickID: String(form.get("affiliate_click_id") ?? "").trim(),
    affiliateVisitorID: String(form.get("affiliate_visitor_id") ?? "").trim(),
  };
}

export function rewardPayload(codes: RewardCodes) {
  return {
    promo_code: codes.promoCode || undefined,
    ...attributionPayload(codes),
  };
}

export function attributionPayload(codes: RewardCodes) {
  return {
    referral_code: codes.referralCode || undefined,
    affiliate_code: codes.affiliateCode || undefined,
    affiliate_click_id: codes.affiliateClickID || undefined,
    affiliate_visitor_id: codes.affiliateVisitorID || undefined,
  };
}

export function customOrderMessage(code: string): string {
  switch (code) {
    case "store_not_verified":
      return "This store needs to finish payment verification before it can take deposit payments.";
    case "store_cannot_take_order":
      return "This store has not enabled this bespoke order route yet.";
    case "promotion_unavailable":
      return "That promo code is not available for this bespoke request. Check the code, remove it, or try a different reward.";
    case "slot_unavailable":
      return "That home-visit slot is no longer available. Pick another open slot.";
    case "invalid_order":
      return "Check the bespoke route, contact details, and measurements, then try again.";
    case "not_found":
      return "This design is not available for bespoke orders right now.";
    default:
      return "The bespoke order could not start. Please try again shortly.";
  }
}

export function newAffiliateVisitorID(): string {
  const randomID = globalThis.crypto?.randomUUID?.();
  if (randomID) {
    return `xtv_${randomID}`;
  }
  return `xtv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function resolveDepositMinor(design: Design, store: StoreSummary): number {
  return design.deposit_override_minor ?? store.default_deposit_minor;
}

export function rewardValueLabel(referral: ReferralCode): string {
  if (referral.reward_type === "percentage") {
    return `${(referral.reward_value / 100).toFixed(0)}%`;
  }
  return formatGHS(referral.reward_value);
}
