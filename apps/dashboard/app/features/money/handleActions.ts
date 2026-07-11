import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import { parseMoneyMinor } from "../shared/utils";

export async function handleMoneyActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "log_taking") {
    const amountMinor = parseMoneyMinor(form.get("amount_ghs"));
    const orderID = String(form.get("order_id") ?? "").trim();
    const method = String(form.get("method") ?? "").trim();
    const whatFor = String(form.get("what_for") ?? "").trim();
    if (amountMinor === null || !method || !whatFor) {
      return {
        moneyError:
          "Add an amount, method, and short reason before logging a taking.",
      };
    }
    const response = await apiFetch(request, "/money/takings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderID,
        amount_minor: amountMinor,
        method,
        what_for: whatFor,
      }),
    });
    if (!response.ok) {
      return {
        moneyError:
          "Could not log that taking. Check the amount, method, and order link.",
      };
    }
    return redirect("/dashboard/money");
  }
  return null;
}
