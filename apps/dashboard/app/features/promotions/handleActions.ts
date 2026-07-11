import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import { promotionBodyFromForm, promotionErrorMessage } from "./utils";

export async function handlePromotionsActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "create_promotion" || intent === "update_promotion") {
    const parsed = promotionBodyFromForm(form);
    if (!parsed.ok) {
      return { promotionError: parsed.message };
    }
    const promotionID = String(form.get("promotion_id") ?? "").trim();
    if (intent === "update_promotion" && !promotionID) {
      return { promotionError: "That promotion could not be found." };
    }
    const response = await apiFetch(
      request,
      intent === "create_promotion"
        ? "/promotions"
        : `/promotions/${encodeURIComponent(promotionID)}`,
      {
        method: intent === "create_promotion" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.body),
      },
    );
    if (!response.ok) {
      return {
        promotionError: promotionErrorMessage(response.status),
      };
    }
    return redirect("/dashboard/promotions");
  }

if (intent === "archive_promotion") {
    const promotionID = String(form.get("promotion_id") ?? "").trim();
    if (!promotionID) {
      return { promotionError: "That promotion could not be found." };
    }
    const response = await apiFetch(
      request,
      `/promotions/${encodeURIComponent(promotionID)}/archive`,
      { method: "POST" },
    );
    if (!response.ok) {
      return {
        promotionError: promotionErrorMessage(response.status),
      };
    }
    return redirect("/dashboard/promotions");
  }
  return null;
}
