import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { uploadBrandLogo } from "../adminApi";
import {
  readBoolean,
  readNumber,
  readGhsPesewas,
} from "../formReaders";
import { adminSettingsActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleSettingsAction({ // eslint-disable-line complexity -- intent dispatcher with many conditional branches; refactor in follow-up
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (
    intent === "admin-profile:update" ||
    intent === "admin-preferences:update" ||
    intent === "admin-platform-settings:update"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-profile:update") {
        await adminApi.updateProfile(accessToken, {
          displayName: String(form.get("display_name") ?? ""),
          email: String(form.get("email") ?? ""),
        });
        return {
          section: "settings",
          severity: "success",
          message: "Profile settings saved.",
        };
      }

      if (intent === "admin-preferences:update") {
        await adminApi.updatePreferences(accessToken, {
          timezone: String(form.get("timezone") ?? ""),
          phoneNumber: String(form.get("phone_number") ?? ""),
          notifyEmail: readBoolean(form, "notify_email"),
          notifySms: readBoolean(form, "notify_sms"),
          alertVerifications: readBoolean(form, "alert_verifications"),
          alertMoneyRails: readBoolean(form, "alert_money_rails"),
          alertSubscriptions: readBoolean(form, "alert_subscriptions"),
          alertPromotions: readBoolean(form, "alert_promotions"),
          alertRisk: readBoolean(form, "alert_risk"),
          alertSupport: readBoolean(form, "alert_support"),
          dailyDigestTime: String(form.get("daily_digest_time") ?? ""),
        });
        return {
          section: "settings",
          severity: "success",
          message: "Notification preferences saved.",
        };
      }

      let brandLogoUrl = String(form.get("brand_logo_url") ?? "");
      if (readBoolean(form, "remove_brand_logo")) {
        brandLogoUrl = "";
      } else {
        const logoFile = form.get("brand_logo_file");
        if (logoFile instanceof File && logoFile.size > 0) {
          const uploaded = await uploadBrandLogo(accessToken, logoFile);
          if (uploaded) { // eslint-disable-line max-depth -- large function with conditional branches; refactor in follow-up
            brandLogoUrl = uploaded;
          }
        }
      }
      await adminApi.updatePlatformSettings(accessToken, {
        platformName: String(form.get("platform_name") ?? ""),
        supportEmail: String(form.get("support_email") ?? ""),
        verificationSlaHours: Math.trunc(
          readNumber(form.get("verification_sla_hours"), 24),
        ),
        payoutReviewThresholdPesewas: readGhsPesewas(
          form.get("payout_review_threshold_ghs"),
        ),
        maintenanceMode: readBoolean(form, "maintenance_mode"),
        aiAssistantAddonEnabled: readBoolean(form, "ai_assistant_addon_enabled"),
        brandLogoUrl,
      });
      return {
        section: "settings",
        severity: "success",
        message: "Platform settings saved.",
      };
    } catch (error) {
      return {
        section: "settings",
        severity: "error",
        message: adminSettingsActionError(error),
      };
    }
  }

  if (intent === "admin-marketing-flags:update") {
    const { accessToken } = await requireAdminContext(request);
    try {
      await adminApi.updateMarketingFlags(accessToken, {
        browseStore: readBoolean(form, "browse_store"),
        discover: readBoolean(form, "discover"),
        createStore: readBoolean(form, "create_store"),
        pricing: readBoolean(form, "pricing"),
      });
      return {
        section: "settings",
        severity: "success",
        message: "Marketing launch flags saved.",
      };
    } catch (error) {
      return {
        section: "settings",
        severity: "error",
        message: adminSettingsActionError(error),
      };
    }
  }

  return null;
}
