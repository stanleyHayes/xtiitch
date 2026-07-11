import { requestJSON, requestText } from "./utils";
import type { AdminRole } from "./auth";

export type AdminPlatformMetrics = {
  gmvMonthMinor: number;
  platformRevenueMonthMinor: number;
  activeBusinesses: number;
  totalBusinesses: number;
  pendingVerifications: number;
  suspendedBusinesses: number;
  paymentHealthBps: number;
  failedPayments30d: number;
  totalPayments30d: number;
  updatedAt: string;
};

export type AdminOperationsHealthStatus = "ready" | "watch" | "blocked";

export type AdminOperationsHealthSignal = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  targetLabel: string;
};

export type AdminOperationsHealth = {
  healthScore: number;
  blockedCount: number;
  watchCount: number;
  paymentHealthBps: number;
  failedWebhooks: number;
  payoutHolds: number;
  openRiskReviews: number;
  openSupportTickets: number;
  urgentSupportTickets: number;
  auditEvents: number;
  criticalAuditEvents: number;
  signals: AdminOperationsHealthSignal[];
  updatedAt: string;
};

export type AdminNotificationFeedTone =
  | "critical"
  | "warning"
  | "info"
  | "success";

export type AdminNotificationFeedCategory =
  | "verification"
  | "money"
  | "subscriptions"
  | "promotions"
  | "ads"
  | "affiliates"
  | "referrals"
  | "risk"
  | "support"
  | "platform"
  | "audit";

export type AdminNotificationFeedItem = {
  id: string;
  tone: AdminNotificationFeedTone;
  category: AdminNotificationFeedCategory;
  title: string;
  helper: string;
  meta: string;
  source: string;
  target: string;
  targetLabel: string;
};

export type AdminNotificationFeed = {
  notifications: AdminNotificationFeedItem[];
  updatedAt: string;
};

export type AdminReportFeedItem = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  targetLabel: string;
};

export type AdminReportFeed = {
  items: AdminReportFeedItem[];
  updatedAt: string;
};
export type AdminAuditSeverity = "info" | "warning" | "critical";
export type AdminAuditEvent = {
  id: string;
  actor: string;
  actorRole: AdminRole | string;
  action: string;
  targetType: string;
  targetId: string;
  target: string;
  detail: string;
  severity: AdminAuditSeverity;
  createdAt: string;
};
type AdminPlatformMetricsPayload = {
  gmv_month_minor: number;
  platform_revenue_month_minor: number;
  active_businesses: number;
  total_businesses: number;
  pending_verifications: number;
  suspended_businesses: number;
  payment_health_bps: number;
  failed_payments_30d: number;
  total_payments_30d: number;
  updated_at: string;
};

type AdminOperationsHealthSignalPayload = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  target_label: string;
};

type AdminOperationsHealthPayload = {
  health_score: number;
  blocked_count: number;
  watch_count: number;
  payment_health_bps: number;
  failed_webhooks: number;
  payout_holds: number;
  open_risk_reviews: number;
  open_support_tickets: number;
  urgent_support_tickets: number;
  audit_events: number;
  critical_audit_events: number;
  signals: AdminOperationsHealthSignalPayload[];
  updated_at: string;
};

type AdminNotificationFeedItemPayload = {
  id: string;
  tone: AdminNotificationFeedTone;
  category: AdminNotificationFeedCategory;
  title: string;
  helper: string;
  meta: string;
  source: string;
  target: string;
  target_label: string;
};

type AdminNotificationFeedPayload = {
  notifications: AdminNotificationFeedItemPayload[];
  updated_at: string;
};

type AdminReportFeedItemPayload = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  target_label: string;
};

type AdminReportFeedPayload = {
  items: AdminReportFeedItemPayload[];
  updated_at: string;
};

type AdminAuditEventPayload = {
  audit_event_id: string;
  actor_email: string;
  actor_role: AdminRole | string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  summary: string;
  severity: AdminAuditSeverity;
  created_at: string;
};

function mapPlatformMetrics(
  payload: AdminPlatformMetricsPayload,
): AdminPlatformMetrics {
  return {
    gmvMonthMinor: payload.gmv_month_minor,
    platformRevenueMonthMinor: payload.platform_revenue_month_minor,
    activeBusinesses: payload.active_businesses,
    totalBusinesses: payload.total_businesses,
    pendingVerifications: payload.pending_verifications,
    suspendedBusinesses: payload.suspended_businesses,
    paymentHealthBps: payload.payment_health_bps,
    failedPayments30d: payload.failed_payments_30d,
    totalPayments30d: payload.total_payments_30d,
    updatedAt: payload.updated_at,
  };
}

function mapOperationsHealth(
  payload: AdminOperationsHealthPayload,
): AdminOperationsHealth {
  return {
    healthScore: payload.health_score,
    blockedCount: payload.blocked_count,
    watchCount: payload.watch_count,
    paymentHealthBps: payload.payment_health_bps,
    failedWebhooks: payload.failed_webhooks,
    payoutHolds: payload.payout_holds,
    openRiskReviews: payload.open_risk_reviews,
    openSupportTickets: payload.open_support_tickets,
    urgentSupportTickets: payload.urgent_support_tickets,
    auditEvents: payload.audit_events,
    criticalAuditEvents: payload.critical_audit_events,
    signals: payload.signals.map((signal) => ({
      id: signal.id,
      label: signal.label,
      value: signal.value,
      helper: signal.helper,
      status: signal.status,
      target: signal.target,
      targetLabel: signal.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}

function mapAdminNotificationFeed(
  payload: AdminNotificationFeedPayload,
): AdminNotificationFeed {
  return {
    notifications: payload.notifications.map((notification) => ({
      id: notification.id,
      tone: notification.tone,
      category: notification.category,
      title: notification.title,
      helper: notification.helper,
      meta: notification.meta,
      source: notification.source,
      target: notification.target,
      targetLabel: notification.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}

function mapAdminReportFeed(payload: AdminReportFeedPayload): AdminReportFeed {
  return {
    items: payload.items.map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      helper: item.helper,
      status: item.status,
      target: item.target,
      targetLabel: item.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}
function mapAuditEvent(payload: AdminAuditEventPayload): AdminAuditEvent {
  return {
    id: payload.audit_event_id,
    actor: payload.actor_email || "system",
    actorRole: payload.actor_role,
    action: payload.action,
    targetType: payload.target_type,
    targetId: payload.target_id,
    target: payload.target_label || payload.target_id,
    detail: payload.summary,
    severity: payload.severity,
    createdAt: payload.created_at,
  };
}

export const operationsApi = {
  platformMetrics: (accessToken: string) =>
    requestJSON<AdminPlatformMetricsPayload>("/admin/platform-metrics", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapPlatformMetrics),
  operationsHealth: (accessToken: string) =>
    requestJSON<AdminOperationsHealthPayload>("/admin/operations-health", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapOperationsHealth),
  adminNotifications: (accessToken: string) =>
    requestJSON<AdminNotificationFeedPayload>("/admin/notifications", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapAdminNotificationFeed),
  adminReports: (accessToken: string) =>
    requestJSON<AdminReportFeedPayload>("/admin/reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapAdminReportFeed),
  auditEvents: async (accessToken: string, severity?: AdminAuditSeverity) => {
    const query = severity ? `?severity=${encodeURIComponent(severity)}` : "";
    const payload = await requestJSON<{ events: AdminAuditEventPayload[] }>(
      `/admin/audit-events${query}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.events.map(mapAuditEvent);
  },
  exportDataset: (accessToken: string, dataset: string) =>
    requestText(`/admin/exports/${encodeURIComponent(dataset)}.csv`, {
      method: "GET",
      headers: {
        Accept: "text/csv",
        Authorization: `Bearer ${accessToken}`,
      },
    }),
};
