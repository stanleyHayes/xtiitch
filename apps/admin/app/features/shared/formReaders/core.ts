import {
  AdminExportDatasetId,
  Decision,
  EntitlementFormRow,
  serverExportDatasetIds,
} from "../types";
import type {
  AdminRole,
  AdminBusinessOperationalStatus,
  AdminSubscriptionStatus,
  AdminSubscriptionBillingMode,
  AdminSubscriptionDiscountType,
  AdminRiskReviewStatus,
  AdminSupportTicketStatus,
  AdminSupportAssignment,
  PlanCadencePricing,
} from "../types";
import { readGhsPesewas, readNumber, readInt } from "../validation";

export function readAdminRole(value: FormDataEntryValue | null): AdminRole {
  const role = String(value ?? "");
  if (role === "owner" || role === "operator" || role === "support") {
    return role;
  }
  return "support";
}

export function readAdminPermissions(form: FormData): string[] {
  return Array.from(
    new Set(form.getAll("permissions").map((value) => String(value))),
  );
}

export function readAdminExportDataset(
  value: FormDataEntryValue | null,
): AdminExportDatasetId {
  const dataset = String(value ?? "").trim() as AdminExportDatasetId;
  if (serverExportDatasetIds.includes(dataset)) {
    return dataset;
  }
  return "report-posture";
}

export function adminExportFilename(dataset: AdminExportDatasetId): string {
  const safe = dataset.replace(/[^a-z0-9_-]/gi, "");
  return `xtiitch-admin-${safe || "export"}.csv`;
}

export function readVerificationDecision(value: FormDataEntryValue | null): Decision {
  const decision = String(value ?? "");
  if (decision === "approved" || decision === "rejected" || decision === "held") {
    return decision;
  }
  return "held";
}

export function readBusinessOperationalStatus(
  value: FormDataEntryValue | null,
): AdminBusinessOperationalStatus {
  return String(value ?? "") === "suspended" ? "suspended" : "active";
}

export function readSubscriptionStatus(
  value: FormDataEntryValue | null,
): AdminSubscriptionStatus {
  const status = String(value ?? "");
  if (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "grace_period" ||
    status === "cancel_at_period_end" ||
    status === "canceled"
  ) {
    return status;
  }
  return "active";
}

export function readSubscriptionBillingMode(
  value: FormDataEntryValue | null,
): AdminSubscriptionBillingMode {
  const mode = String(value ?? "");
  if (mode === "manual" || mode === "payment_link" || mode === "recurring") {
    return mode;
  }
  return "manual";
}

export function readSubscriptionDiscountType(
  value: FormDataEntryValue | null,
): AdminSubscriptionDiscountType {
  const discountType = String(value ?? "");
  if (discountType === "free_period" || discountType === "fixed") {
    return discountType;
  }
  return "percentage";
}

export function readEntitlementRow(
  value: FormDataEntryValue,
): EntitlementFormRow | null {
  try {
    const parsed = JSON.parse(String(value)) as Partial<EntitlementFormRow>;
    if (
      typeof parsed.planId !== "string" ||
      typeof parsed.featureKey !== "string" ||
      (parsed.valueType !== "boolean" && parsed.valueType !== "limit")
    ) {
      return null;
    }
    return {
      planId: parsed.planId,
      featureKey: parsed.featureKey,
      valueType: parsed.valueType,
    };
  } catch {
    return null;
  }
}

export function readSubscriptionDiscountValue(
  discountTypeValue: FormDataEntryValue | null,
  value: FormDataEntryValue | null,
): number {
  const discountType = readSubscriptionDiscountType(discountTypeValue);
  if (discountType === "percentage") {
    return Math.round(readNumber(value, 0) * 100);
  }
  if (discountType === "fixed") {
    return readGhsPesewas(value);
  }
  return readInt(value, 1);
}

export function readRiskReviewStatus(
  value: FormDataEntryValue | null,
): AdminRiskReviewStatus {
  return String(value ?? "") === "closed" ? "closed" : "open";
}

export function readSupportTicketStatus(
  value: FormDataEntryValue | null,
): AdminSupportTicketStatus {
  return String(value ?? "") === "resolved" ? "resolved" : "open";
}

export function readSupportAssignment(
  value: FormDataEntryValue | null,
): AdminSupportAssignment {
  const assignment = String(value ?? "");
  if (assignment === "self" || assignment === "unassigned") {
    return assignment;
  }
  return "unchanged";
}

// The plan prices that are actually CHARGED: per quarter / per year, discounted
// first cycle vs standard renewal. (The monthly fee is a reference rate only,
// so it is read separately alongside the other plan economics.)
export function readPlanCadence(form: FormData): PlanCadencePricing {
  return {
    quarterlyFirstMinor: readGhsPesewas(form.get("quarterly_first_ghs")),
    quarterlyRenewalMinor: readGhsPesewas(form.get("quarterly_renewal_ghs")),
    yearlyFirstMinor: readGhsPesewas(form.get("yearly_first_ghs")),
    yearlyRenewalMinor: readGhsPesewas(form.get("yearly_renewal_ghs")),
  };
}
