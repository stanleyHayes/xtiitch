import type {
  AdminVerificationDecision,
  AdminBusinessStatus,
  AdminAuditEvent,
  AdminAuditSeverity,
} from "../../../lib/api";

export type * from "../../../lib/api";
export * from "./navigation";
export * from "./notifications";
export * from "./reports";

export type Decision = AdminVerificationDecision;
export type StatusFilter = "all" | AdminBusinessStatus;
export type AuditEvent = AdminAuditEvent;
export type AuditSeverity = AdminAuditSeverity;
export type AuditFilter = "all" | AuditSeverity;

export type AdminActionFeedback = {
  section?: import("./navigation").Section;
  severity?: "success" | "error" | "warning" | "info";
  message?: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
};

export type EntitlementFormRow = {
  planId: string;
  featureKey: string;
  valueType: "boolean" | "limit";
};

export const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "unverified", label: "Unverified" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

export const auditFilters: { value: AuditFilter; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

export type AdminLoadResult<T> = {
  data: T;
  error: string | null;
};

export const ADMIN_PAGE_SIZE = 8;
