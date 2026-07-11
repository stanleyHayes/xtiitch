import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import {
  readAdPlacementType,
  readAdCampaignEditableStatus,
  readAdPricingModel,
  readGhsPesewas,
  readOptionalGhsPesewas,
  readOptionalDateTime,
} from "../formReaders";
import { adminAdCampaignActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleAdsAction({ // eslint-disable-line complexity -- intent dispatcher with many conditional branches; refactor in follow-up
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (
    intent === "admin-ad-campaign:create" ||
    intent === "admin-ad-campaign:update" ||
    intent === "admin-ad-campaign:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-ad-campaign:archive") {
        await adminApi.archiveAdCampaign(
          accessToken,
          String(form.get("campaign_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "ads",
          severity: "success",
          message: "Sponsored placement archived.",
        };
      }

      const payload = {
        businessId: String(form.get("business_id") ?? ""),
        placementType: readAdPlacementType(form.get("placement_type")),
        targetRefId: String(form.get("target_ref_id") ?? ""),
        headline: String(form.get("headline") ?? ""),
        description: String(form.get("description") ?? ""),
        status: readAdCampaignEditableStatus(form.get("status")),
        pricingModel: readAdPricingModel(form.get("pricing_model")),
        budgetMinor: readGhsPesewas(form.get("budget_ghs")),
        dailyCapMinor: readOptionalGhsPesewas(form.get("daily_cap_ghs")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
        reviewNote: String(form.get("review_note") ?? ""),
      };

      if (intent === "admin-ad-campaign:create") {
        await adminApi.createAdCampaign(accessToken, payload);
        return {
          section: "ads",
          severity: "success",
          message: "Sponsored placement created.",
        };
      }

      await adminApi.updateAdCampaign(
        accessToken,
        String(form.get("campaign_id") ?? ""),
        payload,
      );
      return {
        section: "ads",
        severity: "success",
        message: "Sponsored placement updated.",
      };
    } catch (error) {
      return {
        section: "ads",
        severity: "error",
        message: adminAdCampaignActionError(error),
      };
    }
  }

  if (intent === "admin-ad-campaign-payment:collect") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const result = await adminApi.collectAdCampaignPayment(
        accessToken,
        String(form.get("campaign_id") ?? ""),
        String(form.get("customer_email") ?? ""),
      );
      return {
        section: "ads",
        severity: "success",
        message: result.created
          ? "Sponsored placement payment link created."
          : "Existing sponsored placement payment link is still open.",
      };
    } catch (error) {
      return {
        section: "ads",
        severity: "error",
        message: adminAdCampaignActionError(error),
      };
    }
  }

  return null;
}
