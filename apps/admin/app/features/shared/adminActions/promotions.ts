import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import {
  readPromotionDiscountType,
  readPromotionFundingSource,
  readPromotionScope,
  readPromotionEditableStatus,
  readPromotionDiscountValue,
  readOptionalText,
  readOptionalInteger,
  readOptionalGhsPesewas,
  readGhsPesewas,
  readOptionalDateTime,
} from "../formReaders";
import { adminPromotionActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handlePromotionsAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (
    intent === "admin-promotion:create" ||
    intent === "admin-promotion:update" ||
    intent === "admin-promotion:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-promotion:archive") {
        await adminApi.archivePromotion(
          accessToken,
          String(form.get("promotion_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "promotions",
          severity: "success",
          message: "Promotion archived.",
        };
      }

      const discountType = readPromotionDiscountType(form.get("discount_type"));
      const payload = {
        businessId: readOptionalText(form.get("business_id")),
        code: String(form.get("code") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        discountType,
        discountValue: readPromotionDiscountValue(
          discountType,
          form.get("discount_value"),
        ),
        maxDiscountMinor: readOptionalGhsPesewas(form.get("max_discount_ghs")),
        minSpendMinor: readGhsPesewas(form.get("min_spend_ghs")),
        usageLimitGlobal: readOptionalInteger(form.get("usage_limit_global")),
        usageLimitPerCustomer: readOptionalInteger(
          form.get("usage_limit_per_customer"),
        ),
        fundingSource: readPromotionFundingSource(form.get("funding_source")),
        scope: readPromotionScope(form.get("scope")),
        targetCollectionId: readOptionalText(form.get("target_collection_id")),
        targetDesignId: readOptionalText(form.get("target_design_id")),
        status: readPromotionEditableStatus(form.get("status")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
      };

      if (intent === "admin-promotion:create") {
        await adminApi.createPromotion(accessToken, payload);
        return {
          section: "promotions",
          severity: "success",
          message: "Promotion created.",
        };
      }

      await adminApi.updatePromotion(
        accessToken,
        String(form.get("promotion_id") ?? ""),
        payload,
      );
      return {
        section: "promotions",
        severity: "success",
        message: "Promotion updated.",
      };
    } catch (error) {
      return {
        section: "promotions",
        severity: "error",
        message: adminPromotionActionError(error),
      };
    }
  }

  return null;
}
