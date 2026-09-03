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

// eslint-disable-next-line complexity, max-lines-per-function -- intent dispatcher with many conditional branches; refactor in follow-up
export async function handleAffiliatesAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-affiliate-programme:update") {
    return handleAffiliateProgrammeUpdate(request, form);
  }

  if (intent === "admin-affiliate-application:decide") {
    return handleAffiliateApplicationDecision(request, form);
  }

  if (intent === "admin-affiliate-application:resend") {
    await requireAdminContext(request);
    try {
      await adminApi.resendAffiliateActivation(String(form.get("email") ?? ""));
      return {
        section: "affiliates",
        severity: "success",
        message: "A fresh 48-hour activation link has been requested.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

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
        purchaseCommissionBps: readAffiliateCommissionValue(
          "percentage",
          form.get("purchase_commission_value"),
        ),
        firstPaidPlanCommissionBps: readAffiliateCommissionValue(
          "percentage",
          form.get("paid_plan_commission_value"),
        ),
        cookieWindowDays: readInt(form.get("cookie_window_days"), 30),
        payoutMode: readAffiliatePayoutMode(form.get("payout_mode")),
        payoutReference: String(form.get("payout_reference") ?? ""),
        status: readAffiliateEditableStatus(form.get("status")),
        notes: String(form.get("notes") ?? ""),
        reason: String(form.get("reason") ?? ""),
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

  if (intent === "admin-affiliate-milestone:update") {
    const { accessToken } = await requireAdminContext(request);
    try {
      await adminApi.updateAffiliateMilestoneAchievement(
        accessToken,
        String(form.get("achievement_id") ?? ""),
        {
          rewardStatus: String(form.get("reward_status") ?? "unfulfilled") as
            | "unfulfilled"
            | "processing"
            | "fulfilled"
            | "declined",
          fulfilmentNote: String(form.get("fulfilment_note") ?? ""),
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "affiliates",
        severity: "success",
        message: "Milestone reward status updated.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-affiliate-attribution:correct") {
    return handleAffiliateAttributionCorrection(request, form);
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

async function handleAffiliateAttributionCorrection(
  request: Request,
  form: FormData,
): Promise<AdminActionFeedback> {
  const { accessToken } = await requireAdminContext(request);
  try {
    await adminApi.correctAffiliateAttribution(
      accessToken,
      String(form.get("business_id") ?? ""),
      {
        affiliateId: String(form.get("affiliate_id") ?? ""),
        reason: String(form.get("reason") ?? ""),
      },
    );
    return {
      section: "affiliates",
      severity: "success",
      message:
        "Affiliate attribution corrected. Existing commission history was preserved.",
    };
  } catch (error) {
    return {
      section: "affiliates",
      severity: "error",
      message: adminAffiliateActionError(error),
    };
  }
}

async function handleAffiliateProgrammeUpdate(
  request: Request,
  form: FormData,
): Promise<AdminActionFeedback> {
  const { accessToken } = await requireAdminContext(request);
  try {
    await adminApi.updateAffiliateProgramme(
      accessToken,
      String(form.get("affiliate_programme_id") ?? ""),
      {
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        status: String(form.get("status") ?? "active") as
          | "draft"
          | "active"
          | "paused"
          | "archived",
        defaultPurchaseCommissionBps: readAffiliateCommissionValue(
          "percentage",
          form.get("purchase_commission_value"),
        ),
        defaultFirstPaidPlanCommissionBps: readAffiliateCommissionValue(
          "percentage",
          form.get("paid_plan_commission_value"),
        ),
        cookieWindowDays: readInt(form.get("cookie_window_days"), 30),
        holdDays: readInt(form.get("hold_days"), 14),
        payoutMode: readAffiliatePayoutMode(form.get("payout_mode")),
        minimumPayoutMinor: Math.round(
          Number(form.get("minimum_payout_value") ?? 0) * 100,
        ),
        allowedTargetScope: String(
          form.get("allowed_target_scope") ?? "platform",
        ) as "platform" | "store" | "collection" | "design" | "product",
        milestones: JSON.parse(String(form.get("milestones") ?? "[]")) as {
          milestoneId: string;
          threshold: number;
          title: string;
          rewardDescription: string;
          status: "active" | "paused" | "archived";
        }[],
      },
    );
    return {
      section: "affiliates",
      severity: "success",
      message: "Affiliate programme policy updated.",
    };
  } catch (error) {
    return {
      section: "affiliates",
      severity: "error",
      message: adminAffiliateActionError(error),
    };
  }
}

async function handleAffiliateApplicationDecision(
  request: Request,
  form: FormData,
): Promise<AdminActionFeedback> {
  const { accessToken } = await requireAdminContext(request);
  const decision =
    String(form.get("decision") ?? "") === "approved" ? "approved" : "rejected";
  try {
    await adminApi.decideAffiliateApplication(
      accessToken,
      String(form.get("application_id") ?? ""),
      {
        decision,
        reviewNote: String(form.get("review_note") ?? ""),
        purchaseCommissionBps: readAffiliateCommissionValue(
          "percentage",
          form.get("purchase_commission_value"),
        ),
        firstPaidPlanCommissionBps: readAffiliateCommissionValue(
          "percentage",
          form.get("paid_plan_commission_value"),
        ),
        cookieWindowDays: readInt(form.get("cookie_window_days"), 30),
        payoutMode: readAffiliatePayoutMode(form.get("payout_mode")),
      },
    );
    return {
      section: "affiliates",
      severity: "success",
      message:
        decision === "approved"
          ? "Affiliate application approved and dashboard invite created."
          : "Affiliate application rejected.",
    };
  } catch (error) {
    return {
      section: "affiliates",
      severity: "error",
      message: adminAffiliateActionError(error),
    };
  }
}
