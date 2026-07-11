import { apiFetch } from "../../lib/auth";
import { redirect } from "react-router";
import { businessUserErrorMessage } from "../shared/utils";

export async function handleTeamActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<import("../shared/types").DashboardActionData | Response | null> {
if (intent === "create_business_user") {
    const response = await apiFetch(request, "/auth/business/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: String(form.get("display_name") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        role: String(form.get("role") ?? "staff").trim(),
      }),
    });
    if (!response.ok) {
      return { teamError: businessUserErrorMessage(response.status, "create") };
    }
    return redirect("/dashboard/team");
  }

if (intent === "update_business_user") {
    const userID = String(form.get("business_user_id") ?? "").trim();
    if (!userID) {
      return { teamError: "That team member could not be found." };
    }
    const response = await apiFetch(
      request,
      `/auth/business/users/${encodeURIComponent(userID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: String(form.get("display_name") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim(),
          role: String(form.get("role") ?? "staff").trim(),
          is_active: String(form.get("is_active") ?? "false") === "true",
        }),
      },
    );
    if (!response.ok) {
      return { teamError: businessUserErrorMessage(response.status, "update") };
    }
    return redirect("/dashboard/team");
  }

if (intent === "reset_business_user_password") {
    const userID = String(form.get("business_user_id") ?? "").trim();
    if (!userID) {
      return { teamError: "That team member could not be found." };
    }
    const response = await apiFetch(
      request,
      `/auth/business/users/${encodeURIComponent(userID)}/password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: String(form.get("password") ?? ""),
        }),
      },
    );
    if (!response.ok) {
      return { teamError: businessUserErrorMessage(response.status, "reset") };
    }
    return redirect("/dashboard/team");
  }

if (intent === "transfer_owner") {
    const newOwnerUserID = String(form.get("new_owner_user_id") ?? "").trim();
    if (!newOwnerUserID) {
      return { teamError: "Choose an active admin to become the owner." };
    }
    const response = await apiFetch(request, "/auth/business/owner-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        new_owner_user_id: newOwnerUserID,
        confirmation: String(form.get("confirmation") ?? ""),
      }),
    });
    if (!response.ok) {
      return {
        teamError: businessUserErrorMessage(response.status, "transfer"),
      };
    }
    return redirect("/dashboard/team");
  }
  return null;
}
