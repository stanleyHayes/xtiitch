import type { DashboardActionData } from "../shared/types";

export type DashboardFeedback = {
  message: string;
  severity: "success" | "error";
} | null;

// One snackbar channel for every section's action feedback. Sections add
// their success/error pair to DashboardActionData and append them here; the
// workspace renders whatever surfaces first. Success-first ordering per
// section pair keeps a stale error from masking a fresh confirmation.
export function dashboardFeedback(action: DashboardActionData): DashboardFeedback {
  if (action.settingsSuccess) {
    return { message: action.settingsSuccess, severity: "success" };
  }
  if (action.settingsError) {
    return { message: action.settingsError, severity: "error" };
  }
  if (action.availabilitySuccess) {
    return { message: action.availabilitySuccess, severity: "success" };
  }
  if (action.availabilityError) {
    return { message: action.availabilityError, severity: "error" };
  }
  // §14 scheduled-report saves.
  if (action.analyticsSuccess) {
    return { message: action.analyticsSuccess, severity: "success" };
  }
  if (action.analyticsError) {
    return { message: action.analyticsError, severity: "error" };
  }
  // §15 note/tag saves.
  if (action.crmSuccess) {
    return { message: action.crmSuccess, severity: "success" };
  }
  if (action.crmError) {
    return { message: action.crmError, severity: "error" };
  }
  return null;
}
