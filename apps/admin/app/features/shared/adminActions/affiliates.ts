import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import {
  readAffiliateEntityType,
  readAffiliateCommissionModel,
  readAffiliatePayoutMode,
  readAffiliateEditableStatus,
  readAffiliateConversionStatus,
  readAffiliateCommissionValue,
  readInt,
} from "../formReaders";
import {
  adminAffiliateActionError,
  affiliateConversionActionMessage,
} from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleAffiliatesAction({ // eslint-disable-line complexity -- intent dispatcher with many conditional branches; refactor in follow-up
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (
    intent === "admin-affiliate:create" ||
    intent === "admin-affiliate:update" ||
    intent === "admin-affiliate:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-affiliate:archive") {
        await adminApi.archiveAffiliate(
          accessToken,
          String(form.get("affiliate_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "affiliates",
          severity: "success",
          message: "Affiliate partner archived.",
        };
      }

      const payload = {
        entityType: readAffiliateEntityType(form.get("entity_type")),
        code: String(form.get("code") ?? ""),
        displayName: String(form.get("display_name") ?? ""),
        contactName: String(form.get("contact_name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        websiteUrl: String(form.get("website_url") ?? ""),
        commissionModel: readAffiliateCommissionModel(
          form.get("commission_model"),
        ),
        commissionRate: readAffiliateCommissionValue(
          form.get("commission_model"),
          form.get("commission_value"),
        ),
        cookieWindowDays: readInt(form.get("cookie_window_days"), 30),
        payoutMode: readAffiliatePayoutMode(form.get("payout_mode")),
        payoutReference: String(form.get("payout_reference") ?? ""),
        status: readAffiliateEditableStatus(form.get("status")),
        notes: String(form.get("notes") ?? ""),
      };

      if (intent === "admin-affiliate:create") {
        await adminApi.createAffiliate(accessToken, payload);
        return {
          section: "affiliates",
          severity: "success",
          message: "Affiliate partner created.",
        };
      }

      await adminApi.updateAffiliate(
        accessToken,
        String(form.get("affiliate_id") ?? ""),
        payload,
      );
      return {
        section: "affiliates",
        severity: "success",
        message: "Affiliate partner updated.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-affiliate-conversion:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readAffiliateConversionStatus(form.get("status"));

    try {
      await adminApi.updateAffiliateConversionStatus(
        accessToken,
        String(form.get("conversion_id") ?? ""),
        {
          status,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "affiliates",
        severity: "success",
        message: affiliateConversionActionMessage(status),
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-affiliate-payout:create") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.createAffiliatePayout(
        accessToken,
        String(form.get("affiliate_id") ?? ""),
        {
          payoutReference: String(form.get("payout_reference") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      );
      return {
        section: "affiliates",
        severity: "success",
        message: "Affiliate payout reconciled.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  return null;
}
