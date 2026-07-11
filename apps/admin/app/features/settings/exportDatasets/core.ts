import {
  AdminExportDataset,
  AdminPlatformMetrics,
  AdminPlatformSettings,
  AdminProfileSettings,
  AdminUser,
  AdminRoleDefinition,
  AuditEvent,
  AdminLaunchReadiness,
} from "../../shared/types";
import { formatGHS, formatPercentBps } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";

export function buildCoreDatasets({ // eslint-disable-line complexity, max-lines-per-function -- dataset builder with many conditional branches; refactor in follow-up
  platformMetrics,
  platformSettings,
  profileSettings,
  launchReadiness,
  adminUsers,
  roleCatalog,
  auditEvents,
}: {
  platformMetrics: AdminPlatformMetrics | null;
  platformSettings: AdminPlatformSettings;
  profileSettings: AdminProfileSettings;
  launchReadiness: AdminLaunchReadiness | null;
  adminUsers: AdminUser[];
  roleCatalog: AdminRoleDefinition[];
  auditEvents: AuditEvent[];
}): AdminExportDataset[] {
  const timeOrFallback = (value?: string) => (value ? shortTime(value) : "");

  return [
    {
      id: "report-posture",
      title: "Report posture",
      helper: "GMV, commission, policy, and platform queue counts.",
      source: "reports",
      sourceLabel: "Open reports",
      tone: "ready",
      rows: [
        ["Metric", "Value", "Detail"],
        [
          "GMV this month",
          formatGHS(platformMetrics?.gmvMonthMinor ?? 0),
          "Succeeded platform payments",
        ],
        [
          "Commission",
          formatGHS(platformMetrics?.platformRevenueMonthMinor ?? 0),
          "Platform revenue month to date",
        ],
        [
          "Active businesses",
          platformMetrics?.activeBusinesses ?? 0,
          `${platformMetrics?.totalBusinesses ?? 0} total tenants`,
        ],
        [
          "Payment health",
          formatPercentBps(platformMetrics?.paymentHealthBps ?? 0),
          `${platformMetrics?.failedPayments30d ?? 0} failed payments in 30 days`,
        ],
        [
          "Platform policy",
          platformSettings.maintenanceMode ? "Maintenance" : "Live",
          `${platformSettings.verificationSlaHours}h SLA`,
        ],
      ],
    },
    {
      id: "launch-readiness",
      title: "Launch readiness",
      helper:
        "Production gate checklist for credentials, providers, legal review, and quality scan setup.",
      source: "readiness",
      sourceLabel: "Open readiness",
      tone:
        (launchReadiness?.blockedCount ?? 0) > 0
          ? "blocked"
          : (launchReadiness?.watchCount ?? 0) > 0
            ? "watch"
            : "ready",
      rows: [
        [
          "Category",
          "Gate",
          "Status",
          "Summary",
          "Detail",
          "Action",
          "Target",
          "Updated",
        ],
        ...(launchReadiness?.checks ?? []).map((check) => [
          check.category,
          check.label,
          check.status,
          check.summary,
          check.detail,
          check.action,
          check.targetLabel,
          launchReadiness?.updatedAt
            ? shortTime(launchReadiness.updatedAt)
            : "",
        ]),
      ],
    },
    {
      id: "users",
      title: "Admin users",
      helper: "Operator access roster with roles and active state.",
      source: "users",
      sourceLabel: "Open users",
      tone: adminUsers.some((user) => !user.isActive) ? "watch" : "ready",
      rows: [
        ["Name", "Email", "Role", "Active", "Created", "Updated"],
        ...adminUsers.map((user) => [
          user.displayName,
          user.email,
          user.role,
          user.isActive ? "Active" : "Inactive",
          timeOrFallback(user.createdAt),
          timeOrFallback(user.updatedAt),
        ]),
      ],
    },
    {
      id: "roles",
      title: "Roles and permissions",
      helper: "RBAC grant matrix for owner, operator, and support roles.",
      source: "roles",
      sourceLabel: "Open roles",
      tone: roleCatalog.some((role) => role.permissions.length === 0)
        ? "watch"
        : "ready",
      rows: [
        ["Role", "Label", "Permission count", "Permissions"],
        ...roleCatalog.map((role) => [
          role.role,
          role.label,
          role.permissions.length,
          role.permissions.join("; "),
        ]),
      ],
    },
    {
      id: "settings",
      title: "Settings and notifications",
      helper:
        "Operator profile, notification routing, and platform policy controls.",
      source: "settings",
      sourceLabel: "Open settings",
      tone: platformSettings.maintenanceMode ? "watch" : "ready",
      rows: [
        ["Area", "Setting", "Value", "Detail"],
        [
          "Operator profile",
          "Display name",
          profileSettings.user.displayName,
          profileSettings.user.email,
        ],
        [
          "Operator profile",
          "Role",
          profileSettings.user.role,
          profileSettings.user.isActive ? "Active" : "Inactive",
        ],
        [
          "Notification preferences",
          "Email alerts",
          profileSettings.preferences.notifyEmail ? "On" : "Off",
          "Primary operator delivery route",
        ],
        [
          "Notification preferences",
          "SMS alerts",
          profileSettings.preferences.notifySms ? "On" : "Off",
          profileSettings.preferences.phoneNumber || "No phone number",
        ],
        [
          "Notification preferences",
          "Daily digest",
          profileSettings.preferences.dailyDigestTime,
          profileSettings.preferences.timezone,
        ],
        [
          "Notification preferences",
          "Subscription alerts",
          profileSettings.preferences.alertSubscriptions ? "Watched" : "Muted",
          "Subscription billing and plan usage",
        ],
        [
          "Notification preferences",
          "Promotion alerts",
          profileSettings.preferences.alertPromotions ? "Watched" : "Muted",
          "Promotion redemption activity",
        ],
        [
          "Platform policy",
          "Maintenance mode",
          platformSettings.maintenanceMode ? "On" : "Off",
          platformSettings.platformName,
        ],
        [
          "Platform policy",
          "Verification SLA",
          `${platformSettings.verificationSlaHours}h`,
          platformSettings.supportEmail,
        ],
        [
          "Platform policy",
          "Payout review threshold",
          formatGHS(platformSettings.payoutReviewThresholdPesewas),
          "Settlement review threshold",
        ],
      ],
    },
    {
      id: "audit",
      title: "Audit trail",
      helper:
        "Operator evidence for sensitive admin decisions and settings changes.",
      source: "audit",
      sourceLabel: "Open audit",
      tone: auditEvents.some((event) => event.severity === "critical")
        ? "blocked"
        : auditEvents.some((event) => event.severity === "warning")
          ? "watch"
          : "ready",
      rows: [
        ["Action", "Actor", "Role", "Severity", "Target", "Created", "Detail"],
        ...auditEvents.map((event) => [
          event.action,
          event.actor,
          event.actorRole,
          event.severity,
          event.target,
          shortTime(event.createdAt),
          event.detail,
        ]),
      ],
    },
  ];
}
