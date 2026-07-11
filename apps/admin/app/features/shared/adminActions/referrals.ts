import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import {
  readReferralAudience,
  readReferralRewardKind,
  readReferralRefereeRewardKind,
  readReferralRewardType,
  readReferralEditableStatus,
  readReferralCodeOwnerType,
  readReferralCodeStatus,
  readReferralRewardValue,
  readGhsPesewas,
  readOptionalGhsPesewas,
  readInt,
  readOptionalDateTime,
} from "../formReaders";
import {
  adminReferralProgrammeActionError,
  referralRewardIssueActionMessage,
} from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleReferralsAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-referral-code:create") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.createReferralCode(
        accessToken,
        String(form.get("programme_id") ?? ""),
        {
          businessId: String(form.get("business_id") ?? "") || undefined,
          ownerType: readReferralCodeOwnerType(form.get("owner_type")),
          code: String(form.get("code") ?? ""),
          status: readReferralCodeStatus(form.get("status")),
        },
      );
      return {
        section: "referrals",
        severity: "success",
        message: "Referral code issued.",
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (intent === "admin-referral-rewards:issue") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const result = await adminApi.issueReferralRewards(
        accessToken,
        readInt(form.get("limit"), 50),
      );
      return {
        section: "referrals",
        severity: "success",
        message: referralRewardIssueActionMessage(result),
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (
    intent === "admin-referral-programme:create" ||
    intent === "admin-referral-programme:update" ||
    intent === "admin-referral-programme:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-referral-programme:archive") {
        await adminApi.archiveReferralProgramme(
          accessToken,
          String(form.get("programme_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "referrals",
          severity: "success",
          message: "Referral programme archived.",
        };
      }

      const rewardType = readReferralRewardType(form.get("reward_type"));
      const payload = {
        title: String(form.get("title") ?? ""),
        codePrefix: String(form.get("code_prefix") ?? ""),
        audience: readReferralAudience(form.get("audience")),
        referrerRewardKind: readReferralRewardKind(
          form.get("referrer_reward_kind"),
        ),
        refereeRewardKind: readReferralRefereeRewardKind(
          form.get("referee_reward_kind"),
        ),
        rewardType,
        rewardValue: readReferralRewardValue(rewardType, form.get("reward_value")),
        maxRewardMinor: readOptionalGhsPesewas(form.get("max_reward_ghs")),
        qualifyingOrderMinMinor: readGhsPesewas(
          form.get("qualifying_order_min_ghs"),
        ),
        rewardHoldDays: readInt(form.get("reward_hold_days"), 14),
        status: readReferralEditableStatus(form.get("status")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
        notes: String(form.get("notes") ?? ""),
      };

      if (intent === "admin-referral-programme:create") {
        await adminApi.createReferralProgramme(accessToken, payload);
        return {
          section: "referrals",
          severity: "success",
          message: "Referral programme created.",
        };
      }

      await adminApi.updateReferralProgramme(
        accessToken,
        String(form.get("programme_id") ?? ""),
        payload,
      );
      return {
        section: "referrals",
        severity: "success",
        message: "Referral programme updated.",
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  return null;
}
