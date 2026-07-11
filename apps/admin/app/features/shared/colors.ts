import { tokens } from "../../theme";
import {
  AdminNotificationTone,
  AdminReportStatus,
  AuditSeverity,
  AdminRiskLevel,
  AdminBusinessStatus,
  AdminVerificationStatus,
  AdminSubscriptionStatus,
} from "./types";



export function riskColor(level: AdminRiskLevel): string {
  switch (level) {
    case "high":
      return tokens.danger;
    case "medium":
      return tokens.warning;
    default:
      return tokens.success;
  }
}



export function statusColor(
  status: AdminBusinessStatus | AdminVerificationStatus,
): string {
  switch (status) {
    case "verified":
      return tokens.success;
    case "pending":
      return tokens.warning;
    case "suspended":
      return tokens.danger;
    default:
      return tokens.mutedText;
  }
}



export function auditColor(severity: AuditSeverity): string {
  switch (severity) {
    case "critical":
      return tokens.danger;
    case "warning":
      return tokens.warning;
    default:
      return tokens.info;
  }
}



export function notificationToneColor(tone: AdminNotificationTone): string {
  switch (tone) {
    case "critical":
      return tokens.danger;
    case "warning":
      return tokens.warning;
    case "success":
      return tokens.success;
    default:
      return tokens.info;
  }
}



export function reportStatusColor(status: AdminReportStatus): string {
  switch (status) {
    case "blocked":
      return tokens.danger;
    case "watch":
      return tokens.warning;
    default:
      return tokens.success;
  }
}



export function subscriptionStatusColor(status: AdminSubscriptionStatus): string {
  switch (status) {
    case "active":
    case "trialing":
      return tokens.success;
    case "past_due":
    case "grace_period":
    case "cancel_at_period_end":
      return tokens.warning;
    case "canceled":
      return tokens.danger;
    default:
      return tokens.info;
  }
}
