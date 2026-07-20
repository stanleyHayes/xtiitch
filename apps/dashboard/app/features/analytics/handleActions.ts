import { apiFetch } from "../../lib/auth";
import { EXPORT_FORMATS } from "../../lib/entitlements";
import { apiErrorCode } from "../shared/utils";
import type { DashboardActionData } from "../shared/types";

const REPORT_KINDS = new Set(["financial", "sales", "full"]);
const CADENCES = new Set(["daily", "weekly", "monthly"]);

// §14.1 scheduled reports: PUT /v1/reports/schedule. The API re-checks the
// scheduled_reports matrix row (403 scheduled_reports_not_entitled below
// Growth) and the cadence rules, so the client validates shape only.
export async function handleAnalyticsActions(
  request: Request,
  form: FormData,
  intent: string,
): Promise<DashboardActionData | Response | null> {
  if (intent !== "save_report_schedule") {
    return null;
  }

  const report = String(form.get("report") ?? "").trim();
  const format = String(form.get("format") ?? "").trim();
  const cadence = String(form.get("cadence") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const enabled = form.get("enabled") === "on";

  if (
    !REPORT_KINDS.has(report) ||
    !EXPORT_FORMATS.includes(format as (typeof EXPORT_FORMATS)[number]) ||
    !CADENCES.has(cadence) ||
    !email
  ) {
    return {
      analyticsError:
        "Pick a report, format and cadence, and add the email to receive it.",
    };
  }

  const response = await apiFetch(request, "/reports/schedule", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report, format, cadence, email, enabled }),
  });
  if (!response.ok) {
    const code = await apiErrorCode(response);
    if (code === "scheduled_reports_not_entitled") {
      return {
        analyticsError:
          "Scheduled reports start at Growth. Upgrade to set one up.",
      };
    }
    if (code === "export_not_entitled") {
      return {
        analyticsError: "That report format isn't on your plan. Pick another.",
      };
    }
    if (code === "invalid_input") {
      return {
        analyticsError:
          "Check the report, format, cadence and email, then save again.",
      };
    }
    return { analyticsError: "Could not save the report schedule right now." };
  }
  // §1.2: the panel re-mounts from the revalidated schedule; the snackbar
  // confirms via analyticsSuccess.
  return { analyticsSuccess: "Report schedule saved." };
}
