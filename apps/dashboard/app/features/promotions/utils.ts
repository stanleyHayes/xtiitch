import type { Design } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { BusinessPromotion, CollectionSummary, PromotionFormBody } from "../shared/types";
import { shortDate, parseOptionalMoneyMinor, parseOptionalPositiveInt, parsePercentBps, parseMoneyMinor, datetimeLocalToRFC3339 } from "../shared/utils";

export function promotionDiscountLabel(promotion: BusinessPromotion): string {
  if (promotion.discount_type === "percentage") {
    return `${promotion.discount_value / 100}% up to ${formatGHS(promotion.max_discount_minor ?? 0)}`;
  }
  return formatGHS(promotion.discount_value);
}

export function promotionStatusTone(status: string): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "paused":
      return tokens.warning;
    case "archived":
      return tokens.mutedText;
    default:
      return tokens.info;
  }
}

export function promotionScopeLabel(promotion: BusinessPromotion): string {
  switch (promotion.scope) {
    case "collection":
      return "Collection";
    case "design":
      return "Design";
    default:
      return "Store";
  }
}

export function promotionTargetLabel(
  promotion: BusinessPromotion,
  collections: CollectionSummary[],
  designs: Design[],
): string {
  if (promotion.scope === "collection") {
    const collection = collections.find(
      (item) => item.collection_id === promotion.target_collection_id,
    );
    return collection?.name ?? "Collection target";
  }
  if (promotion.scope === "design") {
    const design = designs.find(
      (item) => item.design_id === promotion.target_design_id,
    );
    return design?.title ?? "Design target";
  }
  return "Entire store";
}

export function promotionWindowLabel(promotion: BusinessPromotion): string {
  if (!promotion.starts_at && !promotion.ends_at) {
    return "Always available";
  }
  const start = promotion.starts_at ? shortDate(promotion.starts_at) : "Now";
  const end = promotion.ends_at ? shortDate(promotion.ends_at) : "No end";
  return `${start} to ${end}`;
}

export function promotionPercentInputValue(promotion: BusinessPromotion): string {
  return promotion.discount_type === "percentage"
    ? String(promotion.discount_value / 100)
    : "";
}

export function promotionBodyFromForm(form: FormData): PromotionFormBody {
  const code = String(form.get("code") ?? "")
    .trim()
    .toUpperCase();
  const title = String(form.get("title") ?? "").trim();
  const discountType =
    String(form.get("discount_type") ?? "percentage") === "fixed"
      ? "fixed"
      : "percentage";
  const scope = ["store", "collection", "design"].includes(
    String(form.get("scope") ?? ""),
  )
    ? String(form.get("scope") ?? "")
    : "store";
  const status =
    String(form.get("status") ?? "active") === "paused" ? "paused" : "active";
  const minSpendMinor = parseOptionalMoneyMinor(form.get("min_spend_ghs"));
  const usageLimitGlobal = parseOptionalPositiveInt(
    form.get("usage_limit_global"),
  );
  const usageLimitPerCustomer = parseOptionalPositiveInt(
    form.get("usage_limit_per_customer"),
  );
  if (!code || !title) {
    return { ok: false, message: "Add a code and title for the promotion." };
  }
  if (
    minSpendMinor === null ||
    usageLimitGlobal === undefined ||
    usageLimitPerCustomer === undefined
  ) {
    return {
      ok: false,
      message:
        "Check the spend floor and usage limits. Limits can be blank, but must be positive when set.",
    };
  }

  let maxDiscountMinor: number | null = null;
  const discountValue =
    discountType === "percentage"
      ? parsePercentBps(form.get("percentage_discount"))
      : parseMoneyMinor(form.get("fixed_discount_ghs"));
  if (discountType === "percentage") {
    maxDiscountMinor = parseMoneyMinor(form.get("max_discount_ghs"));
    if (discountValue === null || maxDiscountMinor === null) {
      return {
        ok: false,
        message:
          "Percentage promos need a discount percent and a maximum discount amount.",
      };
    }
  } else {
    if (discountValue === null) {
      return { ok: false, message: "Add a valid fixed discount amount." };
    }
  }

  const startsRaw = String(form.get("starts_at") ?? "").trim();
  const endsRaw = String(form.get("ends_at") ?? "").trim();
  const startsAt = startsRaw ? datetimeLocalToRFC3339(startsRaw) : null;
  const endsAt = endsRaw ? datetimeLocalToRFC3339(endsRaw) : null;
  if ((startsRaw && !startsAt) || (endsRaw && !endsAt)) {
    return { ok: false, message: "Use valid start and end dates." };
  }

  const targetCollectionID =
    scope === "collection"
      ? String(form.get("target_collection_id") ?? "").trim() || null
      : null;
  const targetDesignID =
    scope === "design"
      ? String(form.get("target_design_id") ?? "").trim() || null
      : null;
  if (
    (scope === "collection" && !targetCollectionID) ||
    (scope === "design" && !targetDesignID)
  ) {
    return {
      ok: false,
      message: "Choose the collection or design this promotion targets.",
    };
  }

  return {
    ok: true,
    body: {
      code,
      title,
      description: String(form.get("description") ?? "").trim(),
      discount_type: discountType,
      discount_value: discountValue,
      max_discount_minor: maxDiscountMinor,
      min_spend_minor: minSpendMinor,
      usage_limit_global: usageLimitGlobal,
      usage_limit_per_customer: usageLimitPerCustomer,
      scope,
      target_collection_id: targetCollectionID,
      target_design_id: targetDesignID,
      status,
      starts_at: startsAt ?? "",
      ends_at: endsAt ?? "",
    },
  };
}

export function promotionErrorMessage(status: number): string {
  if (status === 409) {
    return "That promotion code is already in use.";
  }
  if (status === 404) {
    return "That promotion or target could not be found.";
  }
  if (status === 400) {
    return "Check the promotion details, target, discount, and active dates.";
  }
  return "Could not save that promotion yet.";
}