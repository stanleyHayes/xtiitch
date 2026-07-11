import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { readRiskReviewStatus } from "../formReaders";
import { adminRiskActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleRiskAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-risk-review:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readRiskReviewStatus(form.get("status"));

    try {
      await adminApi.updateRiskReviewStatus(
        accessToken,
        String(form.get("review_key") ?? ""),
        {
          status,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "risk",
        severity: "success",
        message:
          status === "closed" ? "Risk review closed." : "Risk review reopened.",
      };
    } catch (error) {
      return {
        section: "risk",
        severity: "error",
        message: adminRiskActionError(error),
      };
    }
  }

  return null;
}
