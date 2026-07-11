import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { readVerificationDecision } from "../formReaders";
import { adminVerificationActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleVerificationsAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-verification:decide") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const decision = readVerificationDecision(form.get("decision"));
      await adminApi.decideVerification(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          decision,
          note: String(form.get("note") ?? ""),
        },
      );
      return {
        section: "verification",
        severity: "success",
        message:
          decision === "approved"
            ? "Business verification approved."
            : decision === "rejected"
              ? "Business verification rejected."
              : "Business verification held for follow-up.",
      };
    } catch (error) {
      return {
        section: "verification",
        severity: "error",
        message: adminVerificationActionError(error),
      };
    }
  }

  return null;
}
