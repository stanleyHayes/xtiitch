import { apiFetch } from "../../lib/auth";
import { apiErrorCode } from "../shared/utils";
import type { DashboardActionData } from "../shared/types";

// §15.1 CRM annotations: PUT note (Starter+) / PUT tags (Growth+). Both are
// replace-semantics upserts scoped to the tenant by the API — a cross-tenant
// customer id 404s and surfaces as a plain error, never data (§15.3).

async function crmErrorMessage(response: Response, fallback: string) {
  const code = await apiErrorCode(response);
  if (code === "crm_not_entitled") {
    return "That CRM capability isn't on your plan. Upgrade to use it.";
  }
  if (code === "not_found") {
    return "That customer isn't in your list.";
  }
  if (code === "invalid_input") {
    return "Check what you entered and try again.";
  }
  return fallback;
}

export async function handleCrmActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<DashboardActionData | Response | null> {
  const customerId = String(form.get("customer_id") ?? "").trim();

  if (intent === "save_crm_note") {
    const note = String(form.get("note") ?? "").trim();
    if (!customerId || !note) {
      return { crmError: "Write the note before saving." };
    }
    const response = await apiFetch(
      request,
      `/crm/customers/${encodeURIComponent(customerId)}/notes`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      },
    );
    if (!response.ok) {
      return {
        crmError: await crmErrorMessage(
          response,
          "Could not save that note right now.",
        ),
      };
    }
    return { crmSuccess: "Note saved." };
  }

  if (intent === "save_crm_tags") {
    // The owner types comma-separated tags ("VIP, wholesale, bride"); the API
    // replaces the whole set and does its own trim/dedupe/bounds.
    const tags = String(form.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!customerId) {
      return { crmError: "Open a customer before saving tags." };
    }
    const response = await apiFetch(
      request,
      `/crm/customers/${encodeURIComponent(customerId)}/tags`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      },
    );
    if (!response.ok) {
      return {
        crmError: await crmErrorMessage(
          response,
          "Could not save those tags right now.",
        ),
      };
    }
    return { crmSuccess: "Tags saved." };
  }

  return null;
}
