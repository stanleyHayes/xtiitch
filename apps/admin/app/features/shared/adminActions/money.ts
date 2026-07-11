import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { adminMoneyActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleMoneyAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (
    intent === "money:webhook-replay" ||
    intent === "money:payment-reversal" ||
    intent === "money:settlement-hold"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "money:webhook-replay") {
        await adminApi.queueMoneyReplay(accessToken, {
          providerReference: String(form.get("provider_reference") ?? ""),
          reason: String(form.get("reason") ?? ""),
        });
        return {
          section: "money",
          severity: "success",
          message: "Webhook replay review queued.",
        };
      }

      if (intent === "money:payment-reversal") {
        const reversal = await adminApi.reverseMoneyPayment(accessToken, {
          providerReference: String(form.get("provider_reference") ?? ""),
          reason: String(form.get("reason") ?? ""),
        });
        return {
          section: "money",
          severity: "success",
          message: reversal.payment_reversed
            ? "Payment reversal applied."
            : "Payment was already reversed.",
        };
      }

      const hold = String(form.get("hold") ?? "") === "true";
      await adminApi.setSettlementReviewHold(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          hold,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "money",
        severity: "success",
        message: hold
          ? "Settlement review hold placed."
          : "Settlement review hold released.",
      };
    } catch (error) {
      return {
        section: "money",
        severity: "error",
        message: adminMoneyActionError(error),
      };
    }
  }

  return null;
}
