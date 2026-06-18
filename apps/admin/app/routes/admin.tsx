import { Form, redirect } from "react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CancelRounded from "@mui/icons-material/CancelRounded";
import CampaignRounded from "@mui/icons-material/CampaignRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import NotesRounded from "@mui/icons-material/NotesRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import type { Route } from "./+types/admin";
import {
  AdminApiError,
  adminApi,
  type AdminAdCampaign,
  type AdminAdCampaignStatus,
  type AdminAdPlacementType,
  type AdminAdPricingModel,
  type AdminAffiliate,
  type AdminAffiliateAttribution,
  type AdminAffiliateCommissionModel,
  type AdminAffiliateConversion,
  type AdminAffiliateEntityType,
  type AdminAffiliatePayoutMode,
  type AdminAffiliateStatus,
  type AdminAuditEvent,
  type AdminBusiness,
  type AdminBusinessOperationalStatus,
  type AdminBusinessStatus,
  type AdminAuditSeverity,
  type AdminCustomer,
  type AdminLaunchReadiness,
  type AdminMoneyPayoutStatus,
  type AdminMoneyRails,
  type AdminOperationsHealth,
  type AdminPlan,
  type AdminMoneyWebhookStatus,
  type AdminPlatformMetrics,
  type AdminPlatformSettings,
  type AdminPromotion,
  type AdminPromotionDiscountType,
  type AdminPromotionFundingSource,
  type AdminPromotionScope,
  type AdminPromotionStatus,
  type AdminProfileSettings,
  type AdminReferralAudience,
  type AdminReferralCodeOwnerType,
  type AdminReferralCodeStatus,
  type AdminReferralProgramme,
  type AdminReferralProgrammeStatus,
  type AdminReferralRefereeRewardKind,
  type AdminReferralRewardIssue,
  type AdminReferralRewardKind,
  type AdminReferralRewardType,
  type AdminRiskLevel,
  type AdminRiskReview,
  type AdminRiskReviewStatus,
  type AdminSubscription,
  type AdminSubscriptionBillingMode,
  type AdminSubscriptionStatus,
  type AdminSupportAssignment,
  type AdminSupportTicket,
  type AdminSupportTicketStatus,
  type AdminPermissionDefinition,
  type AdminVerificationCase,
  type AdminVerificationDecision,
  type AdminVerificationStatus,
  type AdminRole,
  type AdminRoleDefinition,
  type AdminUser,
} from "../lib/api";
import { logOut, requireAdminContext, type AdminSession } from "../lib/session";
import TextField from "../components/form-text-field";
import { tokens } from "../theme";

type Section =
  | "overview"
  | "notifications"
  | "reports"
  | "exports"
  | "health"
  | "readiness"
  | "subscriptions"
  | "promotions"
  | "ads"
  | "affiliates"
  | "referrals"
  | "users"
  | "roles"
  | "verification"
  | "businesses"
  | "customers"
  | "money"
  | "risk"
  | "support"
  | "settings"
  | "audit";
type Decision = AdminVerificationDecision;
type StatusFilter = "all" | AdminBusinessStatus;
type AuditEvent = AdminAuditEvent;
type AuditSeverity = AdminAuditSeverity;
type AuditFilter = "all" | AuditSeverity;
type AdminActionFeedback = {
  section?: Section;
  severity?: "success" | "error" | "warning" | "info";
  message?: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
};
type AdminNotificationTone = "critical" | "warning" | "info" | "success";
type AdminNotificationCategory =
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
type AdminNotificationFilter = "all" | AdminNotificationCategory;
type AdminNotification = {
  id: string;
  tone: AdminNotificationTone;
  category: AdminNotificationCategory;
  title: string;
  helper: string;
  meta: string;
  source: string;
  target: Section;
  targetLabel: string;
};
type AdminReportStatus = "ready" | "watch" | "blocked";
type AdminExportDatasetId =
  | "report-posture"
  | "launch-readiness"
  | "businesses"
  | "customers"
  | "verification"
  | "money"
  | "risk"
  | "support"
  | "audit"
  | "users"
  | "roles"
  | "settings"
  | "plans"
  | "subscriptions"
  | "promotions"
  | "ad-campaigns"
  | "affiliates"
  | "referral-programmes"
  | "promotion-redemptions";
type AdminReportItem = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminReportStatus;
  target: Section;
  targetLabel: string;
};
type AdminExportDataset = {
  id: AdminExportDatasetId;
  title: string;
  helper: string;
  source: Section;
  sourceLabel: string;
  rows: (string | number)[][];
  tone: AdminReportStatus;
};

type AdminNavItem = {
  id: Section;
  label: string;
  helper: string;
  icon: ReactNode;
};

type AdminNavGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  items: AdminNavItem[];
};

const adminRailWidth = 296;
const adminRailCollapsedWidth = 88;

const navItems: AdminNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    helper: "Platform pulse",
    icon: <TrendingUpRounded />,
  },
  {
    id: "notifications",
    label: "Notifications",
    helper: "Action alerts",
    icon: <NotificationsActiveRounded />,
  },
  {
    id: "reports",
    label: "Reports",
    helper: "Compliance view",
    icon: <ReceiptLongRounded />,
  },
  {
    id: "exports",
    label: "Exports",
    helper: "CSV snapshots",
    icon: <FileDownloadRounded />,
  },
  {
    id: "health",
    label: "Health",
    helper: "System posture",
    icon: <SyncRounded />,
  },
  {
    id: "readiness",
    label: "Readiness",
    helper: "Launch gates",
    icon: <AssignmentTurnedInRounded />,
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    helper: "Plan billing",
    icon: <WorkspacePremiumRounded />,
  },
  {
    id: "promotions",
    label: "Promotions",
    helper: "Vouchers and offers",
    icon: <LocalOfferRounded />,
  },
  {
    id: "ads",
    label: "Ads",
    helper: "Sponsored placements",
    icon: <CampaignRounded />,
  },
  {
    id: "affiliates",
    label: "Affiliates",
    helper: "Partner programmes",
    icon: <WorkspacePremiumRounded />,
  },
  {
    id: "referrals",
    label: "Referrals",
    helper: "Two-sided growth",
    icon: <LocalOfferRounded />,
  },
  {
    id: "users",
    label: "Users",
    helper: "Operators and roles",
    icon: <PersonSearchRounded />,
  },
  {
    id: "roles",
    label: "Roles",
    helper: "Permissions",
    icon: <AdminPanelSettingsRounded />,
  },
  {
    id: "verification",
    label: "Verification",
    helper: "KYC decisions",
    icon: <VerifiedUserRounded />,
  },
  {
    id: "businesses",
    label: "Businesses",
    helper: "Tenant control",
    icon: <StorefrontRounded />,
  },
  {
    id: "customers",
    label: "Customers",
    helper: "Client directory",
    icon: <PeopleAltRounded />,
  },
  {
    id: "money",
    label: "Money rails",
    helper: "Paystack watch",
    icon: <PaymentsRounded />,
  },
  {
    id: "risk",
    label: "Risk",
    helper: "Trust review",
    icon: <ShieldRounded />,
  },
  {
    id: "support",
    label: "Support",
    helper: "Customer issues",
    icon: <SupportAgentRounded />,
  },
  {
    id: "settings",
    label: "Settings",
    helper: "Profile and alerts",
    icon: <SettingsRounded />,
  },
  {
    id: "audit",
    label: "Audit log",
    helper: "Operator trail",
    icon: <HistoryRounded />,
  },
];

function adminNavItem(id: Section): AdminNavItem {
  const item = navItems.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Missing admin nav item: ${id}`);
  }
  return item;
}

function adminNavItems(ids: Section[]): AdminNavItem[] {
  return ids.map((id) => adminNavItem(id));
}

const adminNavGroups: AdminNavGroup[] = [
  {
    id: "command",
    label: "Command",
    icon: <TrendingUpRounded />,
    items: adminNavItems([
      "overview",
      "notifications",
      "reports",
      "exports",
      "health",
      "readiness",
    ]),
  },
  {
    id: "growth",
    label: "Growth",
    icon: <CampaignRounded />,
    items: adminNavItems([
      "subscriptions",
      "promotions",
      "ads",
      "affiliates",
      "referrals",
    ]),
  },
  {
    id: "access",
    label: "Access",
    icon: <PeopleAltRounded />,
    items: adminNavItems([
      "users",
      "roles",
      "verification",
      "businesses",
      "customers",
    ]),
  },
  {
    id: "operations",
    label: "Operations",
    icon: <ShieldRounded />,
    items: adminNavItems(["money", "risk", "support", "settings", "audit"]),
  },
];

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "unverified", label: "Unverified" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

const auditFilters: { value: AuditFilter; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const serverExportDatasetIds: AdminExportDatasetId[] = [
  "report-posture",
  "launch-readiness",
  "businesses",
  "customers",
  "verification",
  "money",
  "risk",
  "support",
  "audit",
  "users",
  "roles",
  "settings",
  "plans",
  "subscriptions",
  "promotions",
  "ad-campaigns",
  "affiliates",
  "referral-programmes",
  "promotion-redemptions",
];

const ghs = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Admin console · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

type AdminLoadResult<T> = {
  data: T;
  error: string | null;
};

async function loadAdminResource<T>(
  load: () => Promise<T>,
  fallback: T,
  permissionMessage: string,
  unavailableMessage: string,
): Promise<AdminLoadResult<T>> {
  try {
    return { data: await load(), error: null };
  } catch (error) {
    if (!(error instanceof AdminApiError)) {
      throw error;
    }

    return {
      data: fallback,
      error: adminLoaderErrorMessage(
        error,
        permissionMessage,
        unavailableMessage,
      ),
    };
  }
}

function adminLoaderErrorMessage(
  error: AdminApiError,
  permissionMessage: string,
  unavailableMessage: string,
): string {
  if (error.status === 401) {
    throw redirect("/login");
  }
  if (error.status === 403) {
    return permissionMessage;
  }
  if (error.code === "admin_api_unavailable") {
    return "Admin API is unavailable. The console shell is open, but this section could not load yet.";
  }

  return unavailableMessage;
}

function fallbackProfileSettings(admin: AdminSession): AdminProfileSettings {
  return {
    user: {
      adminUserId: admin.adminUserId,
      email: admin.adminEmail,
      displayName: admin.adminDisplayName,
      role: admin.adminRole,
      isActive: true,
    },
    preferences: {
      timezone: "Africa/Accra",
      phoneNumber: "",
      notifyEmail: true,
      notifySms: false,
      alertVerifications: true,
      alertMoneyRails: true,
      alertSubscriptions: true,
      alertPromotions: true,
      alertRisk: true,
      alertSupport: true,
      dailyDigestTime: "08:00",
    },
  };
}

function fallbackPlatformSettings(): AdminPlatformSettings {
  return {
    platformName: "Xtiitch",
    supportEmail: "support@xtiitch.com",
    verificationSlaHours: 24,
    payoutReviewThresholdPesewas: 500000,
    maintenanceMode: false,
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  const { admin, accessToken } = await requireAdminContext(request);
  const [profileSettingsResult, platformSettingsResult] = await Promise.all([
    loadAdminResource(
      () => adminApi.profileSettings(accessToken),
      fallbackProfileSettings(admin),
      "Your role cannot view profile settings.",
      "Profile settings could not be loaded. The console is using your signed-in session details.",
    ),
    loadAdminResource(
      () => adminApi.platformSettings(accessToken),
      fallbackPlatformSettings(),
      "Your role cannot view platform settings.",
      "Platform settings could not be loaded. The console is using default policy values.",
    ),
  ]);
  const accessCatalog = await adminApi.roles(accessToken).catch(() => ({
    roles: [] as AdminRoleDefinition[],
    permissions: defaultPermissionCatalog(),
  }));
  const adminUsersResult = await loadAdminResource(
    () => adminApi.listUsers(accessToken),
    [] as AdminUser[],
    "Only platform owners can manage operator access.",
    "Operator access could not be loaded right now.",
  );
  const verificationCasesResult = await loadAdminResource(
    () => adminApi.verificationCases(accessToken),
    [] as AdminVerificationCase[],
    "Your role cannot review business verifications.",
    "Business verification cases could not be loaded right now.",
  );
  const adminBusinessesResult = await loadAdminResource(
    () => adminApi.businesses(accessToken),
    [] as AdminBusiness[],
    "Your role cannot manage business accounts.",
    "Business accounts could not be loaded right now.",
  );
  const adminCustomersResult = await loadAdminResource(
    () => adminApi.customers(accessToken),
    [] as AdminCustomer[],
    "Your role cannot view the customer directory.",
    "Customer directory could not be loaded right now.",
  );
  const platformMetricsResult = await loadAdminResource(
    () => adminApi.platformMetrics(accessToken),
    null as AdminPlatformMetrics | null,
    "Your role cannot view platform-wide metrics.",
    "Platform metrics could not be loaded right now.",
  );
  const operationsHealthResult = await loadAdminResource(
    () => adminApi.operationsHealth(accessToken),
    null as AdminOperationsHealth | null,
    "Your role cannot view the backend health summary.",
    "Operations health could not be loaded right now.",
  );
  const backendNotificationsResult = await loadAdminResource(
    async () => {
      const notificationFeed = await adminApi.adminNotifications(accessToken);
      return notificationFeed.notifications.map((notification) => ({
        ...notification,
        target: notification.target as Section,
      }));
    },
    [] as AdminNotification[],
    "Your role cannot view the backend notification feed.",
    "Backend notifications could not be loaded right now.",
  );
  const backendReportItemsResult = await loadAdminResource(
    async () => {
      const reportFeed = await adminApi.adminReports(accessToken);
      return reportFeed.items.map((item) => ({
        ...item,
        target: item.target as Section,
      }));
    },
    [] as AdminReportItem[],
    "Your role cannot view the backend report feed.",
    "Backend reports could not be loaded right now.",
  );
  const launchReadinessResult = await loadAdminResource(
    () => adminApi.launchReadiness(accessToken),
    null as AdminLaunchReadiness | null,
    "Your role cannot view launch readiness.",
    "Launch readiness could not be loaded right now.",
  );
  const moneyRailsResult = await loadAdminResource(
    () => adminApi.moneyRails(accessToken),
    null as AdminMoneyRails | null,
    "Your role cannot manage money rails.",
    "Money rails could not be loaded right now.",
  );
  const subscriptionsResult = await loadAdminResource(
    () => adminApi.subscriptions(accessToken),
    [] as AdminSubscription[],
    "Your role cannot manage subscriptions.",
    "Subscriptions could not be loaded right now.",
  );
  const plansResult = await loadAdminResource(
    () => adminApi.plans(accessToken),
    [] as AdminPlan[],
    "Your role cannot manage plan packages.",
    "Plan packages could not be loaded right now.",
  );
  const promotionsResult = await loadAdminResource(
    () => adminApi.promotions(accessToken),
    [] as AdminPromotion[],
    "Your role cannot manage promotions.",
    "Promotions could not be loaded right now.",
  );
  const adCampaignsResult = await loadAdminResource(
    () => adminApi.adCampaigns(accessToken),
    [] as AdminAdCampaign[],
    "Your role cannot manage sponsored placements.",
    "Sponsored placements could not be loaded right now.",
  );
  const affiliatesResult = await loadAdminResource(
    () => adminApi.affiliates(accessToken),
    [] as AdminAffiliate[],
    "Your role cannot manage affiliate programmes.",
    "Affiliate programmes could not be loaded right now.",
  );
  const affiliateAttributionResult = await loadAdminResource(
    () => adminApi.affiliateAttribution(accessToken),
    [] as AdminAffiliateAttribution[],
    "Your role cannot view affiliate performance.",
    "Affiliate performance could not be loaded right now.",
  );
  const referralProgrammesResult = await loadAdminResource(
    () => adminApi.referralProgrammes(accessToken),
    [] as AdminReferralProgramme[],
    "Your role cannot manage referral programmes.",
    "Referral programmes could not be loaded right now.",
  );
  const riskReviewsResult = await loadAdminResource(
    () => adminApi.riskReviews(accessToken),
    [] as AdminRiskReview[],
    "Your role cannot manage risk reviews.",
    "Risk reviews could not be loaded right now.",
  );
  const supportTicketsResult = await loadAdminResource(
    () => adminApi.supportTickets(accessToken),
    [] as AdminSupportTicket[],
    "Your role cannot manage the support queue.",
    "Support tickets could not be loaded right now.",
  );
  const auditEventsResult = await loadAdminResource(
    () => adminApi.auditEvents(accessToken),
    [] as AuditEvent[],
    "Your role cannot view the durable audit trail.",
    "Audit events could not be loaded right now.",
  );

  return {
    admin,
    profileSettings: profileSettingsResult.data,
    profileSettingsError: profileSettingsResult.error,
    platformSettings: platformSettingsResult.data,
    platformSettingsError: platformSettingsResult.error,
    adminUsers: adminUsersResult.data,
    roleCatalog: accessCatalog.roles,
    permissionCatalog: accessCatalog.permissions.length
      ? accessCatalog.permissions
      : defaultPermissionCatalog(),
    userManagementError: adminUsersResult.error,
    verificationCases: verificationCasesResult.data,
    verificationQueueError: verificationCasesResult.error,
    adminBusinesses: adminBusinessesResult.data,
    businessManagementError: adminBusinessesResult.error,
    adminCustomers: adminCustomersResult.data,
    customerDirectoryError: adminCustomersResult.error,
    platformMetrics: platformMetricsResult.data,
    platformMetricsError: platformMetricsResult.error,
    operationsHealth: operationsHealthResult.data,
    operationsHealthError: operationsHealthResult.error,
    backendNotifications: backendNotificationsResult.data,
    backendNotificationsError: backendNotificationsResult.error,
    backendReportItems: backendReportItemsResult.data,
    backendReportsError: backendReportItemsResult.error,
    launchReadiness: launchReadinessResult.data,
    launchReadinessError: launchReadinessResult.error,
    moneyRails: moneyRailsResult.data,
    moneyRailsError: moneyRailsResult.error,
    subscriptions: subscriptionsResult.data,
    subscriptionsError: subscriptionsResult.error,
    plans: plansResult.data,
    plansError: plansResult.error,
    promotions: promotionsResult.data,
    promotionsError: promotionsResult.error,
    adCampaigns: adCampaignsResult.data,
    adCampaignsError: adCampaignsResult.error,
    affiliates: affiliatesResult.data,
    affiliatesError: affiliatesResult.error,
    affiliateAttribution: affiliateAttributionResult.data,
    affiliateAttributionError: affiliateAttributionResult.error,
    referralProgrammes: referralProgrammesResult.data,
    referralProgrammesError: referralProgrammesResult.error,
    riskReviews: riskReviewsResult.data,
    riskReviewError: riskReviewsResult.error,
    supportTickets: supportTicketsResult.data,
    supportQueueError: supportTicketsResult.error,
    auditEvents: auditEventsResult.data,
    auditLogError: auditEventsResult.error,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "logout") {
    return logOut(request);
  }

  if (intent === "admin-export:download") {
    const { accessToken } = await requireAdminContext(request);
    const dataset = readAdminExportDataset(form.get("dataset"));
    const csv = await adminApi.exportDataset(accessToken, dataset);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${adminExportFilename(
          dataset,
        )}"`,
      },
    });
  }

  if (intent === "admin-user:create" || intent === "admin-user:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-user:create") {
        await adminApi.createUser(accessToken, {
          displayName: String(form.get("display_name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          role: readAdminRole(form.get("role")),
        });
        return {
          section: "users",
          severity: "success",
          message: "Operator access created.",
        };
      }

      await adminApi.updateUser(
        accessToken,
        String(form.get("admin_user_id") ?? ""),
        {
          displayName: String(form.get("display_name") ?? ""),
          role: readAdminRole(form.get("role")),
          isActive: String(form.get("is_active") ?? "") === "true",
        },
      );
      return {
        section: "users",
        severity: "success",
        message: "Operator access updated.",
      };
    } catch (error) {
      return {
        section: "users",
        severity: "error",
        message: adminUserActionError(error),
      };
    }
  }

  if (
    intent === "admin-profile:update" ||
    intent === "admin-preferences:update" ||
    intent === "admin-platform-settings:update"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-profile:update") {
        await adminApi.updateProfile(accessToken, {
          displayName: String(form.get("display_name") ?? ""),
          email: String(form.get("email") ?? ""),
        });
        return {
          section: "settings",
          severity: "success",
          message: "Profile settings saved.",
        };
      }

      if (intent === "admin-preferences:update") {
        await adminApi.updatePreferences(accessToken, {
          timezone: String(form.get("timezone") ?? ""),
          phoneNumber: String(form.get("phone_number") ?? ""),
          notifyEmail: readBoolean(form, "notify_email"),
          notifySms: readBoolean(form, "notify_sms"),
          alertVerifications: readBoolean(form, "alert_verifications"),
          alertMoneyRails: readBoolean(form, "alert_money_rails"),
          alertSubscriptions: readBoolean(form, "alert_subscriptions"),
          alertPromotions: readBoolean(form, "alert_promotions"),
          alertRisk: readBoolean(form, "alert_risk"),
          alertSupport: readBoolean(form, "alert_support"),
          dailyDigestTime: String(form.get("daily_digest_time") ?? ""),
        });
        return {
          section: "settings",
          severity: "success",
          message: "Notification preferences saved.",
        };
      }

      await adminApi.updatePlatformSettings(accessToken, {
        platformName: String(form.get("platform_name") ?? ""),
        supportEmail: String(form.get("support_email") ?? ""),
        verificationSlaHours: Math.trunc(
          readNumber(form.get("verification_sla_hours"), 24),
        ),
        payoutReviewThresholdPesewas: readGhsPesewas(
          form.get("payout_review_threshold_ghs"),
        ),
        maintenanceMode: readBoolean(form, "maintenance_mode"),
      });
      return {
        section: "settings",
        severity: "success",
        message: "Platform settings saved.",
      };
    } catch (error) {
      return {
        section: "settings",
        severity: "error",
        message: adminSettingsActionError(error),
      };
    }
  }

  if (intent === "admin-verification:decide") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const decision = readVerificationDecision(form.get("decision"));
      await adminApi.decideVerification(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          decision,
          note: String(form.get("note") ?? ""),
        },
      );
      return {
        section: "verification",
        severity: "success",
        message:
          decision === "approved"
            ? "Business verification approved."
            : decision === "rejected"
              ? "Business verification rejected."
              : "Business verification held for follow-up.",
      };
    } catch (error) {
      return {
        section: "verification",
        severity: "error",
        message: adminVerificationActionError(error),
      };
    }
  }

  if (intent === "admin-business-status:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const operationalStatus = readBusinessOperationalStatus(
        form.get("operational_status"),
      );
      await adminApi.updateBusinessStatus(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          operationalStatus,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "businesses",
        severity: "success",
        message:
          operationalStatus === "suspended"
            ? "Business suspended."
            : "Business reactivated.",
      };
    } catch (error) {
      return {
        section: "businesses",
        severity: "error",
        message: adminBusinessActionError(error),
      };
    }
  }

  if (
    intent === "money:webhook-replay" ||
    intent === "money:payment-reversal" ||
    intent === "money:settlement-hold"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "money:webhook-replay") {
        await adminApi.queueMoneyReplay(accessToken, {
          providerReference: String(form.get("provider_reference") ?? ""),
          reason: String(form.get("reason") ?? ""),
        });
        return {
          section: "money",
          severity: "success",
          message: "Webhook replay review queued.",
        };
      }

      if (intent === "money:payment-reversal") {
        const reversal = await adminApi.reverseMoneyPayment(accessToken, {
          providerReference: String(form.get("provider_reference") ?? ""),
          reason: String(form.get("reason") ?? ""),
        });
        return {
          section: "money",
          severity: "success",
          message: reversal.payment_reversed
            ? "Payment reversal applied."
            : "Payment was already reversed.",
        };
      }

      const hold = String(form.get("hold") ?? "") === "true";
      await adminApi.setSettlementReviewHold(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          hold,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "money",
        severity: "success",
        message: hold
          ? "Settlement review hold placed."
          : "Settlement review hold released.",
      };
    } catch (error) {
      return {
        section: "money",
        severity: "error",
        message: adminMoneyActionError(error),
      };
    }
  }

  if (intent === "admin-subscription:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readSubscriptionStatus(form.get("status"));
    const billingMode = readSubscriptionBillingMode(form.get("billing_mode"));

    try {
      await adminApi.updateSubscription(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          status,
          billingMode,
          providerCustomerRef: String(form.get("provider_customer_ref") ?? ""),
          providerSubscriptionRef: String(
            form.get("provider_subscription_ref") ?? "",
          ),
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: "Subscription lifecycle updated.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-subscription-billing:sweep" ||
    intent === "admin-subscription-recurring:sweep"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-subscription-recurring:sweep") {
        const result = await adminApi.runSubscriptionRecurringSweep(
          accessToken,
          String(form.get("reason") ?? ""),
        );
        return {
          section: "subscriptions",
          severity:
            result.chargesFailed > 0 || result.chargesSkipped > 0
              ? "warning"
              : "success",
          message: `Recurring charge sweep complete: ${result.chargesPaid} paid, ${result.chargesPending} pending, ${result.chargesFailed} failed, ${result.chargesSkipped} skipped.`,
        };
      }

      const result = await adminApi.runSubscriptionBillingSweep(
        accessToken,
        String(form.get("reason") ?? ""),
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: `Billing sweep complete: ${result.overdueInvoicesFailed} overdue invoices failed, ${result.subscriptionsCanceled} expired grace subscriptions canceled.`,
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-subscription-authorization:init" ||
    intent === "admin-subscription-authorization:verify"
  ) {
    const { accessToken } = await requireAdminContext(request);
    const businessId = String(form.get("business_id") ?? "");

    try {
      if (intent === "admin-subscription-authorization:init") {
        const result = await adminApi.initializeSubscriptionAuthorization(
          accessToken,
          businessId,
          {
            callbackUrl: String(form.get("callback_url") ?? ""),
            reason: String(form.get("reason") ?? ""),
          },
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: `Authorization link created for ${result.businessName}.`,
          detail: `Reference: ${result.reference} · owner ${result.ownerEmail}`,
          href: result.redirectUrl,
          hrefLabel: "Open Paystack authorization",
        };
      }

      await adminApi.verifySubscriptionAuthorization(accessToken, businessId, {
        reference: String(form.get("reference") ?? ""),
        reason: String(form.get("reason") ?? ""),
      });
      return {
        section: "subscriptions",
        severity: "success",
        message: "Recurring authorization verified and stored.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-subscription-invoice:issue" ||
    intent === "admin-subscription-invoice:paid" ||
    intent === "admin-subscription-invoice:failed"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-subscription-invoice:issue") {
        await adminApi.issueSubscriptionInvoice(
          accessToken,
          String(form.get("business_id") ?? ""),
          {
            providerInvoiceRef: String(form.get("provider_invoice_ref") ?? ""),
            paymentUrl: String(form.get("payment_url") ?? ""),
            dueAt: readOptionalDateTime(form.get("due_at")),
            reason: String(form.get("reason") ?? ""),
          },
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: "Subscription invoice issued.",
        };
      }

      if (intent === "admin-subscription-invoice:paid") {
        await adminApi.markSubscriptionInvoicePaid(
          accessToken,
          String(form.get("invoice_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: "Subscription invoice marked paid.",
        };
      }

      await adminApi.markSubscriptionInvoiceFailed(
        accessToken,
        String(form.get("invoice_id") ?? ""),
        String(form.get("reason") ?? ""),
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: "Subscription invoice marked failed.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-plan:create" ||
    intent === "admin-plan:update" ||
    intent === "admin-plan:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-plan:create") {
        await adminApi.createPlan(accessToken, {
          code: String(form.get("code") ?? ""),
          name: String(form.get("name") ?? ""),
          monthlyFeeMinor: readGhsPesewas(form.get("monthly_fee_ghs")),
          commissionBps: Math.trunc(readNumber(form.get("commission_bps"), 0)),
          designLimit: readOptionalInteger(form.get("design_limit")),
        });
        return {
          section: "subscriptions",
          severity: "success",
          message: "Plan package created.",
        };
      }

      if (intent === "admin-plan:update") {
        await adminApi.updatePlan(
          accessToken,
          String(form.get("plan_id") ?? ""),
          {
            name: String(form.get("name") ?? ""),
            monthlyFeeMinor: readGhsPesewas(form.get("monthly_fee_ghs")),
            commissionBps: Math.trunc(
              readNumber(form.get("commission_bps"), 0),
            ),
            designLimit: readOptionalInteger(form.get("design_limit")),
            isActive: String(form.get("is_active") ?? "") === "true",
          },
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: "Plan package updated.",
        };
      }

      await adminApi.archivePlan(
        accessToken,
        String(form.get("plan_id") ?? ""),
        String(form.get("reason") ?? ""),
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: "Plan package archived.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminPlanActionError(error),
      };
    }
  }

  if (
    intent === "admin-promotion:create" ||
    intent === "admin-promotion:update" ||
    intent === "admin-promotion:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-promotion:archive") {
        await adminApi.archivePromotion(
          accessToken,
          String(form.get("promotion_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "promotions",
          severity: "success",
          message: "Promotion archived.",
        };
      }

      const discountType = readPromotionDiscountType(form.get("discount_type"));
      const payload = {
        businessId: readOptionalText(form.get("business_id")),
        code: String(form.get("code") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        discountType,
        discountValue: readPromotionDiscountValue(
          discountType,
          form.get("discount_value"),
        ),
        maxDiscountMinor: readOptionalGhsPesewas(form.get("max_discount_ghs")),
        minSpendMinor: readGhsPesewas(form.get("min_spend_ghs")),
        usageLimitGlobal: readOptionalInteger(form.get("usage_limit_global")),
        usageLimitPerCustomer: readOptionalInteger(
          form.get("usage_limit_per_customer"),
        ),
        fundingSource: readPromotionFundingSource(form.get("funding_source")),
        scope: readPromotionScope(form.get("scope")),
        targetCollectionId: readOptionalText(form.get("target_collection_id")),
        targetDesignId: readOptionalText(form.get("target_design_id")),
        status: readPromotionEditableStatus(form.get("status")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
      };

      if (intent === "admin-promotion:create") {
        await adminApi.createPromotion(accessToken, payload);
        return {
          section: "promotions",
          severity: "success",
          message: "Promotion created.",
        };
      }

      await adminApi.updatePromotion(
        accessToken,
        String(form.get("promotion_id") ?? ""),
        payload,
      );
      return {
        section: "promotions",
        severity: "success",
        message: "Promotion updated.",
      };
    } catch (error) {
      return {
        section: "promotions",
        severity: "error",
        message: adminPromotionActionError(error),
      };
    }
  }

  if (
    intent === "admin-ad-campaign:create" ||
    intent === "admin-ad-campaign:update" ||
    intent === "admin-ad-campaign:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-ad-campaign:archive") {
        await adminApi.archiveAdCampaign(
          accessToken,
          String(form.get("campaign_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "ads",
          severity: "success",
          message: "Sponsored placement archived.",
        };
      }

      const payload = {
        businessId: String(form.get("business_id") ?? ""),
        placementType: readAdPlacementType(form.get("placement_type")),
        targetRefId: String(form.get("target_ref_id") ?? ""),
        headline: String(form.get("headline") ?? ""),
        description: String(form.get("description") ?? ""),
        status: readAdCampaignEditableStatus(form.get("status")),
        pricingModel: readAdPricingModel(form.get("pricing_model")),
        budgetMinor: readGhsPesewas(form.get("budget_ghs")),
        dailyCapMinor: readOptionalGhsPesewas(form.get("daily_cap_ghs")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
        reviewNote: String(form.get("review_note") ?? ""),
      };

      if (intent === "admin-ad-campaign:create") {
        await adminApi.createAdCampaign(accessToken, payload);
        return {
          section: "ads",
          severity: "success",
          message: "Sponsored placement created.",
        };
      }

      await adminApi.updateAdCampaign(
        accessToken,
        String(form.get("campaign_id") ?? ""),
        payload,
      );
      return {
        section: "ads",
        severity: "success",
        message: "Sponsored placement updated.",
      };
    } catch (error) {
      return {
        section: "ads",
        severity: "error",
        message: adminAdCampaignActionError(error),
      };
    }
  }

  if (intent === "admin-ad-campaign-payment:collect") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const result = await adminApi.collectAdCampaignPayment(
        accessToken,
        String(form.get("campaign_id") ?? ""),
        String(form.get("customer_email") ?? ""),
      );
      return {
        section: "ads",
        severity: "success",
        message: result.created
          ? "Sponsored placement payment link created."
          : "Existing sponsored placement payment link is still open.",
      };
    } catch (error) {
      return {
        section: "ads",
        severity: "error",
        message: adminAdCampaignActionError(error),
      };
    }
  }

  if (
    intent === "admin-affiliate:create" ||
    intent === "admin-affiliate:update" ||
    intent === "admin-affiliate:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-affiliate:archive") {
        await adminApi.archiveAffiliate(
          accessToken,
          String(form.get("affiliate_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "affiliates",
          severity: "success",
          message: "Affiliate partner archived.",
        };
      }

      const payload = {
        entityType: readAffiliateEntityType(form.get("entity_type")),
        code: String(form.get("code") ?? ""),
        displayName: String(form.get("display_name") ?? ""),
        contactName: String(form.get("contact_name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        websiteUrl: String(form.get("website_url") ?? ""),
        commissionModel: readAffiliateCommissionModel(
          form.get("commission_model"),
        ),
        commissionRate: readAffiliateCommissionValue(
          form.get("commission_model"),
          form.get("commission_value"),
        ),
        cookieWindowDays: readInt(form.get("cookie_window_days"), 30),
        payoutMode: readAffiliatePayoutMode(form.get("payout_mode")),
        payoutReference: String(form.get("payout_reference") ?? ""),
        status: readAffiliateEditableStatus(form.get("status")),
        notes: String(form.get("notes") ?? ""),
      };

      if (intent === "admin-affiliate:create") {
        await adminApi.createAffiliate(accessToken, payload);
        return {
          section: "affiliates",
          severity: "success",
          message: "Affiliate partner created.",
        };
      }

      await adminApi.updateAffiliate(
        accessToken,
        String(form.get("affiliate_id") ?? ""),
        payload,
      );
      return {
        section: "affiliates",
        severity: "success",
        message: "Affiliate partner updated.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-affiliate-conversion:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readAffiliateConversionStatus(form.get("status"));

    try {
      await adminApi.updateAffiliateConversionStatus(
        accessToken,
        String(form.get("conversion_id") ?? ""),
        {
          status,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "affiliates",
        severity: "success",
        message: affiliateConversionActionMessage(status),
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-affiliate-payout:create") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.createAffiliatePayout(
        accessToken,
        String(form.get("affiliate_id") ?? ""),
        {
          payoutReference: String(form.get("payout_reference") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      );
      return {
        section: "affiliates",
        severity: "success",
        message: "Affiliate payout reconciled.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-referral-code:create") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.createReferralCode(
        accessToken,
        String(form.get("programme_id") ?? ""),
        {
          businessId: String(form.get("business_id") ?? "") || undefined,
          ownerType: readReferralCodeOwnerType(form.get("owner_type")),
          code: String(form.get("code") ?? ""),
          status: readReferralCodeStatus(form.get("status")),
        },
      );
      return {
        section: "referrals",
        severity: "success",
        message: "Referral code issued.",
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (intent === "admin-referral-rewards:issue") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const result = await adminApi.issueReferralRewards(
        accessToken,
        readInt(form.get("limit"), 50),
      );
      return {
        section: "referrals",
        severity: "success",
        message: referralRewardIssueActionMessage(result),
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (
    intent === "admin-referral-programme:create" ||
    intent === "admin-referral-programme:update" ||
    intent === "admin-referral-programme:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-referral-programme:archive") {
        await adminApi.archiveReferralProgramme(
          accessToken,
          String(form.get("programme_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "referrals",
          severity: "success",
          message: "Referral programme archived.",
        };
      }

      const rewardType = readReferralRewardType(form.get("reward_type"));
      const payload = {
        title: String(form.get("title") ?? ""),
        codePrefix: String(form.get("code_prefix") ?? ""),
        audience: readReferralAudience(form.get("audience")),
        referrerRewardKind: readReferralRewardKind(
          form.get("referrer_reward_kind"),
        ),
        refereeRewardKind: readReferralRefereeRewardKind(
          form.get("referee_reward_kind"),
        ),
        rewardType,
        rewardValue: readReferralRewardValue(
          rewardType,
          form.get("reward_value"),
        ),
        maxRewardMinor: readOptionalGhsPesewas(form.get("max_reward_ghs")),
        qualifyingOrderMinMinor: readGhsPesewas(
          form.get("qualifying_order_min_ghs"),
        ),
        rewardHoldDays: readInt(form.get("reward_hold_days"), 14),
        status: readReferralEditableStatus(form.get("status")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
        notes: String(form.get("notes") ?? ""),
      };

      if (intent === "admin-referral-programme:create") {
        await adminApi.createReferralProgramme(accessToken, payload);
        return {
          section: "referrals",
          severity: "success",
          message: "Referral programme created.",
        };
      }

      await adminApi.updateReferralProgramme(
        accessToken,
        String(form.get("programme_id") ?? ""),
        payload,
      );
      return {
        section: "referrals",
        severity: "success",
        message: "Referral programme updated.",
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (intent === "admin-risk-review:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readRiskReviewStatus(form.get("status"));

    try {
      await adminApi.updateRiskReviewStatus(
        accessToken,
        String(form.get("review_key") ?? ""),
        {
          status,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "risk",
        severity: "success",
        message:
          status === "closed" ? "Risk review closed." : "Risk review reopened.",
      };
    } catch (error) {
      return {
        section: "risk",
        severity: "error",
        message: adminRiskActionError(error),
      };
    }
  }

  if (intent === "admin-support-ticket:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readSupportTicketStatus(form.get("status"));
    const assignment = readSupportAssignment(form.get("assignment"));

    try {
      await adminApi.updateSupportTicket(
        accessToken,
        String(form.get("ticket_key") ?? ""),
        {
          status,
          assignment,
          note: String(form.get("note") ?? ""),
        },
      );
      return {
        section: "support",
        severity: "success",
        message: supportActionMessage(status, assignment),
      };
    } catch (error) {
      return {
        section: "support",
        severity: "error",
        message: adminSupportActionError(error),
      };
    }
  }

  if (intent === "admin-role-permissions:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.updateRolePermissions(
        accessToken,
        readAdminRole(form.get("role")),
        readAdminPermissions(form),
      );
      return {
        section: "roles",
        severity: "success",
        message: "Role permissions updated.",
      };
    } catch (error) {
      return {
        section: "roles",
        severity: "error",
        message: adminRoleActionError(error),
      };
    }
  }
  return redirect("/admin");
}

function readAdminRole(value: FormDataEntryValue | null): AdminRole {
  const role = String(value ?? "");
  if (role === "owner" || role === "operator" || role === "support") {
    return role;
  }
  return "support";
}

function readAdminPermissions(form: FormData): string[] {
  return Array.from(
    new Set(form.getAll("permissions").map((value) => String(value))),
  );
}

function readAdminExportDataset(
  value: FormDataEntryValue | null,
): AdminExportDatasetId {
  const dataset = String(value ?? "").trim() as AdminExportDatasetId;
  if (serverExportDatasetIds.includes(dataset)) {
    return dataset;
  }
  return "report-posture";
}

function adminExportFilename(dataset: AdminExportDatasetId): string {
  const safe = dataset.replace(/[^a-z0-9_-]/gi, "");
  return `xtiitch-admin-${safe || "export"}.csv`;
}

function readVerificationDecision(value: FormDataEntryValue | null): Decision {
  const decision = String(value ?? "");
  if (
    decision === "approved" ||
    decision === "rejected" ||
    decision === "held"
  ) {
    return decision;
  }
  return "held";
}

function readBusinessOperationalStatus(
  value: FormDataEntryValue | null,
): AdminBusinessOperationalStatus {
  return String(value ?? "") === "suspended" ? "suspended" : "active";
}

function readSubscriptionStatus(
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

function readSubscriptionBillingMode(
  value: FormDataEntryValue | null,
): AdminSubscriptionBillingMode {
  const mode = String(value ?? "");
  if (mode === "manual" || mode === "payment_link" || mode === "recurring") {
    return mode;
  }
  return "manual";
}

function readPromotionDiscountType(
  value: FormDataEntryValue | null,
): AdminPromotionDiscountType {
  return String(value ?? "") === "fixed" ? "fixed" : "percentage";
}

function readPromotionFundingSource(
  value: FormDataEntryValue | null,
): AdminPromotionFundingSource {
  const source = String(value ?? "");
  if (source === "platform" || source === "split") {
    return source;
  }
  return "business";
}

function readPromotionScope(
  value: FormDataEntryValue | null,
): AdminPromotionScope {
  const scope = String(value ?? "");
  if (scope === "collection" || scope === "design") {
    return scope;
  }
  return "store";
}

function readPromotionEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminPromotionStatus, "archived"> {
  return String(value ?? "") === "paused" ? "paused" : "active";
}

function readAdPlacementType(
  value: FormDataEntryValue | null,
): AdminAdPlacementType {
  const placement = String(value ?? "");
  if (placement === "promoted_design" || placement === "homepage_hero") {
    return placement;
  }
  return "featured_business";
}

function readAdCampaignEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminAdCampaignStatus, "archived"> {
  const status = String(value ?? "");
  if (status === "active" || status === "paused" || status === "completed") {
    return status;
  }
  return "pending_review";
}

function readAdPricingModel(
  _value: FormDataEntryValue | null,
): AdminAdPricingModel {
  return "flat_time";
}

function readAffiliateEntityType(
  value: FormDataEntryValue | null,
): AdminAffiliateEntityType {
  const entityType = String(value ?? "");
  if (entityType === "business" || entityType === "agency") {
    return entityType;
  }
  return "person";
}

function readAffiliateCommissionModel(
  value: FormDataEntryValue | null,
): AdminAffiliateCommissionModel {
  return String(value ?? "") === "flat" ? "flat" : "percentage";
}

function readAffiliatePayoutMode(
  value: FormDataEntryValue | null,
): AdminAffiliatePayoutMode {
  const mode = String(value ?? "");
  if (
    mode === "paystack_split" ||
    mode === "paystack_transfer" ||
    mode === "manual"
  ) {
    return mode;
  }
  return "voucher";
}

function readAffiliateEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminAffiliateStatus, "archived"> {
  const status = String(value ?? "");
  if (status === "active" || status === "paused") {
    return status;
  }
  return "pending_review";
}

function readAffiliateConversionStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminAffiliateConversion["status"], "pending"> {
  const status = String(value ?? "");
  if (status === "settled" || status === "reversed") {
    return status;
  }
  return "approved";
}

function readReferralAudience(
  value: FormDataEntryValue | null,
): AdminReferralAudience {
  const audience = String(value ?? "");
  if (audience === "businesses" || audience === "mixed") {
    return audience;
  }
  return "customers";
}

function readReferralRewardKind(
  value: FormDataEntryValue | null,
): AdminReferralRewardKind {
  const kind = String(value ?? "");
  if (kind === "commission_rebate" || kind === "none") {
    return kind;
  }
  return "voucher";
}

function readReferralRefereeRewardKind(
  value: FormDataEntryValue | null,
): AdminReferralRefereeRewardKind {
  return String(value ?? "") === "none" ? "none" : "voucher";
}

function readReferralRewardType(
  value: FormDataEntryValue | null,
): AdminReferralRewardType {
  return String(value ?? "") === "fixed" ? "fixed" : "percentage";
}

function readReferralEditableStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminReferralProgrammeStatus, "archived"> {
  const status = String(value ?? "");
  if (status === "active" || status === "paused") {
    return status;
  }
  return "draft";
}

function readReferralCodeOwnerType(
  value: FormDataEntryValue | null,
): Exclude<AdminReferralCodeOwnerType, "customer"> {
  return String(value ?? "") === "business" ? "business" : "platform";
}

function readReferralCodeStatus(
  value: FormDataEntryValue | null,
): Exclude<AdminReferralCodeStatus, "archived"> {
  return String(value ?? "") === "paused" ? "paused" : "active";
}

function readAffiliateCommissionValue(
  modelValue: FormDataEntryValue | null,
  value: FormDataEntryValue | null,
): number {
  if (readAffiliateCommissionModel(modelValue) === "percentage") {
    return Math.round(readNumber(value, 0) * 100);
  }
  return readGhsPesewas(value);
}

function readReferralRewardValue(
  rewardType: AdminReferralRewardType,
  value: FormDataEntryValue | null,
): number {
  if (rewardType === "percentage") {
    return Math.round(readNumber(value, 0) * 100);
  }
  return readGhsPesewas(value);
}

function readPromotionDiscountValue(
  discountType: AdminPromotionDiscountType,
  value: FormDataEntryValue | null,
): number {
  if (discountType === "percentage") {
    return Math.round(readNumber(value, 0) * 100);
  }
  return readGhsPesewas(value);
}

function readRiskReviewStatus(
  value: FormDataEntryValue | null,
): AdminRiskReviewStatus {
  return String(value ?? "") === "closed" ? "closed" : "open";
}

function readSupportTicketStatus(
  value: FormDataEntryValue | null,
): AdminSupportTicketStatus {
  return String(value ?? "") === "resolved" ? "resolved" : "open";
}

function readSupportAssignment(
  value: FormDataEntryValue | null,
): AdminSupportAssignment {
  const assignment = String(value ?? "");
  if (assignment === "self" || assignment === "unassigned") {
    return assignment;
  }
  return "unchanged";
}

function supportActionMessage(
  status: AdminSupportTicketStatus,
  assignment: AdminSupportAssignment,
): string {
  if (status === "resolved") {
    return "Support ticket resolved.";
  }
  if (assignment === "self") {
    return "Support ticket assigned to you.";
  }
  if (assignment === "unassigned") {
    return "Support ticket unassigned.";
  }
  return "Support ticket reopened.";
}

function readBoolean(form: FormData, name: string): boolean {
  return form
    .getAll(name)
    .map((value) => String(value))
    .includes("true");
}

function readNumber(
  value: FormDataEntryValue | null,
  fallback: number,
): number {
  const parsed = Number(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readInt(value: FormDataEntryValue | null, fallback: number): number {
  return Math.trunc(readNumber(value, fallback));
}

function readOptionalText(
  value: FormDataEntryValue | null,
): string | undefined {
  const raw = String(value ?? "").trim();
  return raw || undefined;
}

function readOptionalInteger(
  value: FormDataEntryValue | null,
): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function readGhsPesewas(value: FormDataEntryValue | null): number {
  return Math.round(readNumber(value, 0) * 100);
}

function readOptionalGhsPesewas(
  value: FormDataEntryValue | null,
): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }
  return Math.round(readNumber(value, 0) * 100);
}

function readOptionalDateTime(
  value: FormDataEntryValue | null,
): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function adminUserActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "admin_user_email_taken":
        return "That operator email already has admin access.";
      case "forbidden":
        return "Only platform owners can make that operator change.";
      case "invalid_input":
        return "Check the name, email, password length, and selected role.";
      case "not_found":
        return "That operator account was not found.";
      default:
        return "The operator change could not be saved.";
    }
  }
  return "The operator change could not be saved.";
}

function adminRoleActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Only operators with role-management permission can edit grants.";
      case "invalid_input":
        return "Check the selected role and keep owner recovery permissions enabled.";
      default:
        return "The role permissions could not be saved.";
    }
  }
  return "The role permissions could not be saved.";
}

function adminSettingsActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "admin_user_email_taken":
        return "That email is already used by another admin account.";
      case "forbidden":
        return "Your role does not have permission to change platform settings.";
      case "invalid_input":
        return "Check the email, digest time, SLA hours, and payout threshold.";
      case "not_found":
        return "Those settings could not be found.";
      default:
        return "The settings change could not be saved.";
    }
  }
  return "The settings change could not be saved.";
}

function adminVerificationActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot review business verifications.";
      case "invalid_input":
        return "Choose a valid verification decision and try again.";
      case "not_found":
        return "That business could not be found.";
      default:
        return "The verification decision could not be saved.";
    }
  }
  return "The verification decision could not be saved.";
}

function adminBusinessActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage business accounts.";
      case "invalid_input":
        return "Choose a valid business status and try again.";
      case "not_found":
        return "That business could not be found.";
      default:
        return "The business status change could not be saved.";
    }
  }
  return "The business status change could not be saved.";
}

function adminMoneyActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage money rails.";
      case "invalid_input":
        return "Check the provider reference, business, and reason.";
      case "not_found":
        return "That payment reference or business could not be found.";
      default:
        return "The money rails action could not be saved.";
    }
  }
  return "The money rails action could not be saved.";
}

function adminSubscriptionActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage subscriptions.";
      case "invalid_input":
        return "Choose valid subscription billing details.";
      case "not_found":
        return "That subscription or invoice could not be found.";
      case "subscription_billing_unavailable":
        return "That subscription is not currently billable.";
      case "subscription_invoice_open":
        return "That subscription already has an open invoice.";
      default:
        return "The subscription change could not be saved.";
    }
  }
  return "The subscription change could not be saved.";
}

function adminPlanActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage plan packages.";
      case "invalid_input":
        return "Check the package code, name, monthly fee, commission, and design limit.";
      case "not_found":
        return "That plan package could not be found.";
      default:
        return "The plan package change could not be saved.";
    }
  }
  return "The plan package change could not be saved.";
}

function adminPromotionActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage promotions.";
      case "invalid_input":
        return "Check the code, title, discount, cap, limits, funding source, and date window.";
      case "not_found":
        return "That promotion could not be found.";
      default:
        return "The promotion change could not be saved.";
    }
  }
  return "The promotion change could not be saved.";
}

function adminAdCampaignActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage sponsored placements.";
      case "invalid_input":
        return "Check the business, placement, headline, budget, and date window.";
      case "payment_in_flight":
        return "That placement already has an open payment link.";
      case "not_found":
        return "That campaign or eligible verified business could not be found.";
      default:
        return "The sponsored placement change could not be saved.";
    }
  }
  return "The sponsored placement change could not be saved.";
}

function adminAffiliateActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage affiliate programmes.";
      case "invalid_input":
        return "Check the affiliate fields or conversion status transition.";
      case "not_found":
        return "That affiliate partner or conversion could not be found.";
      default:
        return "The affiliate programme change could not be saved.";
    }
  }
  return "The affiliate programme change could not be saved.";
}

function affiliateConversionActionMessage(
  status: Exclude<AdminAffiliateConversion["status"], "pending">,
): string {
  if (status === "settled") {
    return "Affiliate conversion marked settled.";
  }
  if (status === "reversed") {
    return "Affiliate conversion reversed.";
  }
  return "Affiliate conversion approved.";
}

function affiliateConversionActions(
  status: AdminAffiliateConversion["status"],
): {
  status: Exclude<AdminAffiliateConversion["status"], "pending">;
  label: string;
}[] {
  if (status === "pending") {
    return [
      { status: "approved", label: "Approve" },
      { status: "reversed", label: "Reverse" },
    ];
  }
  if (status === "approved") {
    return [
      { status: "settled", label: "Settle" },
      { status: "reversed", label: "Reverse" },
    ];
  }
  return [];
}

function adminReferralProgrammeActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage referral programmes.";
      case "invalid_input":
        return "Check the code prefix, rewards, limits, status, and date window.";
      case "not_found":
        return "That referral programme could not be found.";
      default:
        return "The referral programme change could not be saved.";
    }
  }
  return "The referral programme change could not be saved.";
}

function referralRewardIssueActionMessage(
  result: AdminReferralRewardIssue,
): string {
  if (result.rewardCount === 0) {
    return "No due referral rewards were ready to issue.";
  }

  return `Issued ${result.rewardCount} referral rewards across ${result.referralCount} referrals: ${result.voucherCount} vouchers, ${result.commissionRebateCount} commission rebates, ${formatGHS(result.totalRewardMinor)} fixed reward value.`;
}

function adminRiskActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage risk reviews.";
      case "invalid_input":
        return "Choose a valid risk review status and reason.";
      case "not_found":
        return "That risk review is no longer active.";
      default:
        return "The risk review action could not be saved.";
    }
  }
  return "The risk review action could not be saved.";
}

function adminSupportActionError(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "forbidden":
        return "Your role cannot manage the support queue.";
      case "invalid_input":
        return "Choose a valid support status or assignment.";
      case "not_found":
        return "That support ticket is no longer active.";
      default:
        return "The support ticket action could not be saved.";
    }
  }
  return "The support ticket action could not be saved.";
}

function formatGHS(minor: number): string {
  return ghs.format(minor / 100);
}

function formatPercentBps(value: number): string {
  return `${(value / 100).toFixed(1)}%`;
}

function riskColor(level: AdminRiskLevel): string {
  switch (level) {
    case "high":
      return tokens.danger;
    case "medium":
      return tokens.warning;
    default:
      return tokens.success;
  }
}

function statusColor(
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

function webhookColor(status: AdminMoneyWebhookStatus): string {
  switch (status) {
    case "verified":
      return tokens.success;
    case "replayed":
      return tokens.info;
    case "reversed":
      return tokens.warning;
    default:
      return tokens.danger;
  }
}

function payoutColor(status: AdminMoneyPayoutStatus): string {
  switch (status) {
    case "ready":
      return tokens.success;
    case "review":
      return tokens.warning;
    default:
      return tokens.danger;
  }
}

function auditColor(severity: AuditSeverity): string {
  switch (severity) {
    case "critical":
      return tokens.danger;
    case "warning":
      return tokens.warning;
    default:
      return tokens.info;
  }
}

function notificationToneColor(tone: AdminNotificationTone): string {
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

function notificationCategoryLabel(
  category: AdminNotificationCategory,
): string {
  switch (category) {
    case "verification":
      return "Verification";
    case "money":
      return "Money rails";
    case "subscriptions":
      return "Subscriptions";
    case "promotions":
      return "Promotions";
    case "ads":
      return "Sponsored placements";
    case "affiliates":
      return "Affiliate programmes";
    case "referrals":
      return "Referral programmes";
    case "risk":
      return "Risk";
    case "support":
      return "Support";
    case "audit":
      return "Audit";
    default:
      return "Platform";
  }
}

function notificationCategoryWatched(
  category: AdminNotificationCategory,
  preferences: AdminProfileSettings["preferences"],
): boolean {
  switch (category) {
    case "verification":
      return preferences.alertVerifications;
    case "money":
      return preferences.alertMoneyRails;
    case "subscriptions":
      return preferences.alertSubscriptions;
    case "promotions":
      return preferences.alertPromotions;
    case "ads":
      return preferences.alertPromotions;
    case "affiliates":
      return preferences.alertPromotions;
    case "referrals":
      return preferences.alertPromotions;
    case "risk":
      return preferences.alertRisk;
    case "support":
      return preferences.alertSupport;
    default:
      return true;
  }
}

function reportStatusColor(status: AdminReportStatus): string {
  switch (status) {
    case "blocked":
      return tokens.danger;
    case "watch":
      return tokens.warning;
    default:
      return tokens.success;
  }
}

function shortTime(value: string): string {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function shortID(value: string): string {
  return value.slice(0, 8);
}

function buildAdminNotifications({
  verificationCases,
  moneyRails,
  platformMetrics,
  platformSettings,
  subscriptions,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  riskReviews,
  supportTickets,
  auditEvents,
}: {
  verificationCases: AdminVerificationCase[];
  moneyRails: AdminMoneyRails | null;
  platformMetrics: AdminPlatformMetrics | null;
  platformSettings: AdminPlatformSettings;
  subscriptions: AdminSubscription[];
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
  auditEvents: AuditEvent[];
}): AdminNotification[] {
  const notifications: AdminNotification[] = [];

  verificationCases
    .filter((item) => item.status === "pending" || item.status === "unverified")
    .slice(0, 4)
    .forEach((item) => {
      notifications.push({
        id: `verification-${item.id}`,
        tone: item.riskLevel === "high" ? "critical" : "warning",
        category: "verification",
        title: `${item.businessName} needs verification`,
        helper: `${item.documents.length} documents submitted for ${item.plan}.`,
        meta: `Updated ${shortTime(item.updatedAt)}`,
        source: `${item.handle}.xtiitch.com`,
        target: "verification",
        targetLabel: "Review case",
      });
    });

  moneyRails?.webhookEvents
    .filter((event) => event.status !== "verified")
    .slice(0, 3)
    .forEach((event) => {
      notifications.push({
        id: `webhook-${event.id}`,
        tone: event.status === "failed" ? "critical" : "info",
        category: "money",
        title: `Webhook ${event.status}: ${event.providerReference}`,
        helper: `${event.business} · ${event.purpose} · ${formatGHS(event.amountMinor)}`,
        meta: `${event.attempts} attempts · ${shortTime(event.receivedAt)}`,
        source: event.business,
        target: "money",
        targetLabel: "Open money rails",
      });
    });

  moneyRails?.payoutReviews
    .filter((review) => review.holdActive || review.status !== "ready")
    .slice(0, 3)
    .forEach((review) => {
      notifications.push({
        id: `payout-${review.id}`,
        tone:
          review.holdActive || review.status === "blocked"
            ? "critical"
            : "warning",
        category: "money",
        title: `${review.business} payout needs review`,
        helper: review.nextAction,
        meta: `${formatGHS(review.settlementMinor)} settlement`,
        source: review.subaccountRef,
        target: "money",
        targetLabel: "Review payout",
      });
    });

  subscriptions
    .filter((subscription) => {
      const overDesignLimit =
        typeof subscription.designLimit === "number" &&
        subscription.designCount > subscription.designLimit;
      return (
        overDesignLimit ||
        subscription.status === "past_due" ||
        subscription.status === "grace_period" ||
        subscription.status === "cancel_at_period_end"
      );
    })
    .slice(0, 4)
    .forEach((subscription) => {
      const overDesignLimit =
        typeof subscription.designLimit === "number" &&
        subscription.designCount > subscription.designLimit;
      notifications.push({
        id: `subscription-${subscription.businessId}`,
        tone:
          overDesignLimit ||
          subscription.status === "past_due" ||
          subscription.status === "grace_period"
            ? "critical"
            : "warning",
        category: "subscriptions",
        title: overDesignLimit
          ? `${subscription.businessName} is over plan usage`
          : `${subscription.businessName} billing needs attention`,
        helper: overDesignLimit
          ? `${subscription.designCount}/${subscription.designLimit} designs on ${subscription.planName}.`
          : `${subscriptionStatusLabel(subscription.status)} · ${billingModeLabel(subscription.billingMode)} · ${formatGHS(subscription.monthlyFeeMinor)}`,
        meta: subscription.nextBillingAt
          ? `Next billing ${shortTime(subscription.nextBillingAt)}`
          : `Updated ${shortTime(subscription.updatedAt)}`,
        source: subscription.handle,
        target: "subscriptions",
        targetLabel: "Open subscriptions",
      });
    });

  promotions
    .flatMap((promotion) =>
      promotion.recentRedemptions
        .filter((redemption) => redemption.status === "pending")
        .map((redemption) => ({ promotion, redemption })),
    )
    .slice(0, 4)
    .forEach(({ promotion, redemption }) => {
      notifications.push({
        id: `promotion-redemption-${redemption.promotionRedemptionId}`,
        tone: "warning",
        category: "promotions",
        title: `${promotion.title} has a pending redemption`,
        helper: `${redemption.customerName || "Unknown customer"} · ${formatGHS(redemption.discountMinor)} discount`,
        meta: `Created ${shortTime(redemption.createdAt)}`,
        source: promotion.businessName || "Platform-wide",
        target: "promotions",
        targetLabel: "Open promotions",
      });
    });

  adCampaigns
    .filter((campaign) => campaign.status === "pending_review")
    .slice(0, 4)
    .forEach((campaign) => {
      notifications.push({
        id: `ad-campaign-${campaign.campaignId}`,
        tone: "warning",
        category: "ads",
        title: `${campaign.headline} needs placement review`,
        helper: `${campaign.businessName} · ${adPlacementLabel(
          campaign.placementType,
        )} · ${formatGHS(campaign.budgetMinor)} budget`,
        meta: `Starts ${shortTime(campaign.startsAt)}`,
        source: campaign.businessHandle,
        target: "ads",
        targetLabel: "Open ads",
      });
    });

  affiliates
    .filter((affiliate) => affiliate.status === "pending_review")
    .slice(0, 4)
    .forEach((affiliate) => {
      notifications.push({
        id: `affiliate-${affiliate.affiliateId}`,
        tone: "warning",
        category: "affiliates",
        title: `${affiliate.displayName} needs affiliate review`,
        helper: `${affiliate.code} · ${affiliateCommissionLabel(
          affiliate,
        )} · ${affiliatePayoutLabel(affiliate.payoutMode)}`,
        meta: `${affiliate.cookieWindowDays} day cookie window`,
        source: affiliate.email || affiliate.phone || affiliate.entityType,
        target: "affiliates",
        targetLabel: "Open affiliates",
      });
    });

  referralProgrammes
    .filter(
      (programme) =>
        programme.status === "draft" || programme.status === "paused",
    )
    .slice(0, 4)
    .forEach((programme) => {
      notifications.push({
        id: `referral-programme-${programme.programmeId}`,
        tone: programme.status === "draft" ? "warning" : "info",
        category: "referrals",
        title: `${programme.title} is ${referralStatusLabel(programme.status)}`,
        helper: `${programme.codePrefix} · ${referralRewardLabel(
          programme,
        )} · ${referralAudienceLabel(programme.audience)}`,
        meta: `${formatGHS(
          programme.qualifyingOrderMinMinor,
        )} qualifying order`,
        source: programme.codePrefix,
        target: "referrals",
        targetLabel: "Open referrals",
      });
    });

  riskReviews
    .filter((review) => review.status === "open")
    .slice(0, 4)
    .forEach((review) => {
      notifications.push({
        id: `risk-${review.id}`,
        tone: review.level === "high" ? "critical" : "warning",
        category: "risk",
        title: review.title,
        helper: `${review.business} · ${review.reason}`,
        meta: `Owner ${review.owner} · ${shortTime(review.updatedAt)}`,
        source: review.business,
        target: "risk",
        targetLabel: "Open risk review",
      });
    });

  supportTickets
    .filter((ticket) => ticket.status === "open")
    .slice(0, 4)
    .forEach((ticket) => {
      notifications.push({
        id: `support-${ticket.id}`,
        tone: ticket.priority === "urgent" ? "critical" : "info",
        category: "support",
        title: ticket.subject,
        helper: `${ticket.business} · ${ticket.summary}`,
        meta: `${ticket.priority} · ${shortTime(ticket.createdAt)}`,
        source: ticket.business,
        target: "support",
        targetLabel: "Open ticket",
      });
    });

  if ((platformMetrics?.failedPayments30d ?? 0) > 0) {
    notifications.push({
      id: "payment-health",
      tone:
        (platformMetrics?.failedPayments30d ?? 0) > 5 ? "critical" : "warning",
      category: "money",
      title: "Payment failures detected",
      helper: `${platformMetrics?.failedPayments30d ?? 0} failed payments in the last 30 days.`,
      meta: "Platform health",
      source: "Payment processor",
      target: "money",
      targetLabel: "Check payments",
    });
  }

  if (platformSettings.maintenanceMode) {
    notifications.push({
      id: "maintenance-mode",
      tone: "warning",
      category: "platform",
      title: "Maintenance mode is active",
      helper: "Platform-facing settings are currently set to maintenance mode.",
      meta: "Platform setting",
      source: platformSettings.platformName,
      target: "settings",
      targetLabel: "Open settings",
    });
  }

  auditEvents
    .filter((event) => event.severity === "critical")
    .slice(0, 3)
    .forEach((event) => {
      notifications.push({
        id: `audit-${event.id}`,
        tone: "critical",
        category: "audit",
        title: event.action,
        helper: event.detail,
        meta: `${event.actor} · ${shortTime(event.createdAt)}`,
        source: event.target,
        target: "audit",
        targetLabel: "Open audit",
      });
    });

  if (notifications.length === 0) {
    notifications.push({
      id: "all-clear",
      tone: "success",
      category: "platform",
      title: "No admin alerts waiting",
      helper:
        "Verification, money rails, ads, affiliates, referrals, risk, and support are clear right now.",
      meta: "Live queue",
      source: "Admin console",
      target: "overview",
      targetLabel: "Back to overview",
    });
  }

  const toneRank: Record<AdminNotificationTone, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return notifications
    .sort((first, second) => {
      const toneDelta = toneRank[first.tone] - toneRank[second.tone];
      if (toneDelta !== 0) {
        return toneDelta;
      }
      return first.title.localeCompare(second.title);
    })
    .slice(0, 18);
}

function Panel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: 2,
        bgcolor: alpha(tokens.white, 0.96),
        backgroundImage: `linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})`,
        boxShadow: `0 22px 60px ${alpha(tokens.ink, 0.065)}`,
        backdropFilter: "blur(10px)",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "adminSurfaceIn 420ms ease both",
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function MetricCard({
  label,
  value,
  helper,
  trend,
}: {
  label: string;
  value: string;
  helper: string;
  trend: string;
}) {
  return (
    <Panel
      sx={{
        p: 2.5,
        minHeight: 176,
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        borderColor: alpha(tokens.burgundy, 0.16),
        backgroundImage: `
          radial-gradient(circle at 88% 18%, ${alpha(tokens.warning, 0.18)} 0, transparent 30%),
          linear-gradient(135deg, ${alpha(tokens.burgundy, 0.1)}, transparent 48%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.74)})
        `,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto auto 0",
          height: 3,
          width: "100%",
          bgcolor: tokens.burgundy,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          right: -22,
          bottom: -28,
          width: 104,
          height: 104,
          borderRadius: "50%",
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.12),
          boxShadow: `inset 0 0 0 18px ${alpha(tokens.white, 0.42)}`,
        },
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(tokens.burgundy, 0.28),
          boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.11)}`,
        },
      }}
    >
      <Stack spacing={1.2} sx={{ position: "relative", zIndex: 1, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 900,
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          {label}
        </Typography>
        <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "flex-end",
            justifyContent: "space-between",
            mt: "auto",
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", maxWidth: 180 }}
          >
            {helper}
          </Typography>
          <Chip
            size="small"
            label={trend}
            sx={{
              bgcolor: alpha(tokens.success, 0.12),
              color: tokens.success,
              border: "1px solid",
              borderColor: alpha(tokens.success, 0.22),
            }}
          />
        </Stack>
      </Stack>
    </Panel>
  );
}

function RiskChip({ level }: { level: AdminRiskLevel }) {
  return (
    <Chip
      size="small"
      label={`${level} risk`}
      sx={{
        bgcolor: alpha(riskColor(level), 0.12),
        color: riskColor(level),
        border: "1px solid",
        borderColor: alpha(riskColor(level), 0.24),
        textTransform: "capitalize",
      }}
    />
  );
}

function StatusChip({
  status,
}: {
  status: AdminBusinessStatus | AdminVerificationStatus;
}) {
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        bgcolor: alpha(statusColor(status), 0.12),
        color: statusColor(status),
        border: "1px solid",
        borderColor: alpha(statusColor(status), 0.24),
        textTransform: "capitalize",
      }}
    />
  );
}

function VerificationCard({
  item,
  note,
  onNoteChange,
}: {
  item: AdminVerificationCase;
  note: string;
  onNoteChange: (id: string, value: string) => void;
}) {
  const accent = riskColor(item.riskLevel);
  const isHeld = item.status === "pending";

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        position: "relative",
        borderColor: alpha(accent, 0.2),
        backgroundImage: `
          linear-gradient(135deg, ${alpha(accent, 0.08)}, transparent 38%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
        `,
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(accent, 0.34),
          boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
        },
      }}
    >
      <Form method="post" style={{ display: "contents" }}>
        <input type="hidden" name="intent" value="admin-verification:decide" />
        <input type="hidden" name="business_id" value={item.id} />
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="h6">{item.businessName}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {item.handle}.xtiitch.com · {item.ownerName} · {item.ownerEmail}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <RiskChip level={item.riskLevel} />
              <StatusChip status={item.status} />
              <Chip size="small" label={item.plan} variant="outlined" />
            </Stack>
          </Stack>
          <Typography sx={{ color: "text.secondary" }}>{item.notes}</Typography>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <Box
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                borderRadius: 1.5,
                bgcolor: alpha(tokens.white, 0.62),
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Documents
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 1 }}
              >
                {item.documents.map((documentName) => (
                  <Chip
                    key={documentName}
                    size="small"
                    icon={<ReceiptLongRounded />}
                    label={documentName}
                  />
                ))}
              </Stack>
            </Box>
            <Box
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                borderRadius: 1.5,
                bgcolor: alpha(tokens.white, 0.62),
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Checks
              </Typography>
              <Stack spacing={0.75}>
                {item.checks.map((check) => (
                  <Stack
                    key={check}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <CheckCircleRounded
                      sx={{ color: tokens.success, fontSize: 18 }}
                    />
                    <Typography variant="body2">{check}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <Box
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                borderRadius: 1.5,
                bgcolor: alpha(tokens.white, 0.62),
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Evidence
              </Typography>
              <Stack spacing={0.75}>
                {item.evidence.map((line) => (
                  <Stack
                    key={line}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "flex-start" }}
                  >
                    <NotesRounded
                      sx={{ color: tokens.info, fontSize: 18, mt: 0.2 }}
                    />
                    <Typography variant="body2">{line}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
            <TextField
              name="note"
              label="Operator note"
              value={note}
              onChange={(event) => onNoteChange(item.id, event.target.value)}
              placeholder="Record why this case is approved, rejected, or held."
              multiline
              minRows={3}
              fullWidth
            />
          </Box>
          <Divider />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Submitted {shortTime(item.submittedAt)}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                type="submit"
                name="decision"
                value="rejected"
                variant="outlined"
                color="error"
                startIcon={<CancelRounded />}
                disabled={item.status === "rejected"}
              >
                Reject
              </Button>
              <Button
                type="submit"
                name="decision"
                value="held"
                variant="outlined"
                color="warning"
                startIcon={<BlockRounded />}
                disabled={isHeld}
              >
                Hold
              </Button>
              <Button
                type="submit"
                name="decision"
                value="approved"
                variant="contained"
                startIcon={<CheckCircleRounded />}
                disabled={item.status === "verified"}
              >
                Approve
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Form>
    </Panel>
  );
}

function CustomerDirectoryPanel({
  customers,
  visibleCustomers,
  selectedCustomer,
  query,
  error,
  onQueryChange,
  onInspect,
  onCloseInspector,
}: {
  customers: AdminCustomer[];
  visibleCustomers: AdminCustomer[];
  selectedCustomer: AdminCustomer | null;
  query: string;
  error: string | null;
  onQueryChange: (value: string) => void;
  onInspect: (customer: AdminCustomer) => void;
  onCloseInspector: () => void;
}) {
  const multiBusinessCustomers = customers.filter(
    (customer) => customer.tenantCount > 1,
  ).length;
  const customOrderCustomers = customers.filter(
    (customer) => customer.customOrderCount > 0,
  ).length;
  const totalGMVMinor = customers.reduce(
    (sum, customer) => sum + customer.gmvMinor,
    0,
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Customer operations"
        title="Customers"
        helper="Search client identities, cross-business relationships, custom-order volume, and payment activity."
      />
      {error ? <Alert severity="warning">{error}</Alert> : null}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <CustomerStat
          label="Customers"
          value={String(customers.length)}
          helper={`${visibleCustomers.length} in current view`}
        />
        <CustomerStat
          label="Multi-business"
          value={String(multiBusinessCustomers)}
          helper="Customers seen across tenants"
        />
        <CustomerStat
          label="Custom orders"
          value={String(customOrderCustomers)}
          helper="Customers with bespoke demand"
        />
        <CustomerStat
          label="Customer GMV"
          value={formatGHS(totalGMVMinor)}
          helper="Succeeded platform payments"
        />
      </Box>
      <Panel sx={{ p: 2 }}>
        <TextField
          label="Search customer"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
          }}
        />
      </Panel>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1fr) 380px",
          },
          alignItems: "start",
        }}
      >
        <Stack spacing={1.5}>
          {visibleCustomers.map((customer) => (
            <CustomerRow
              key={customer.id}
              customer={customer}
              selected={selectedCustomer?.id === customer.id}
              onInspect={onInspect}
            />
          ))}
          {!error && visibleCustomers.length === 0 ? (
            <Panel sx={{ p: 3, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 800 }}>
                No customers match this view.
              </Typography>
              <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                Clear the search to return to the full customer directory.
              </Typography>
            </Panel>
          ) : null}
        </Stack>
        <CustomerInspector
          customer={selectedCustomer}
          onClose={onCloseInspector}
        />
      </Box>
    </Stack>
  );
}

function CustomerStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Panel sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
        {helper}
      </Typography>
    </Panel>
  );
}

function CustomerRow({
  customer,
  selected,
  onInspect,
}: {
  customer: AdminCustomer;
  selected: boolean;
  onInspect: (customer: AdminCustomer) => void;
}) {
  const contact = customer.email || customer.phone || "No contact on file";
  const lastBusiness = customer.lastBusinessName
    ? `${customer.lastBusinessName} · ${customer.lastBusinessHandle}`
    : "No linked business activity";

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.25 },
        borderColor: selected
          ? alpha(tokens.burgundy, 0.42)
          : alpha(tokens.ink, 0.08),
        backgroundImage: selected
          ? `linear-gradient(90deg, ${alpha(tokens.burgundy, 0.08)}, transparent 36%)`
          : undefined,
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: "stretch" }}
      >
        <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
          <Avatar
            sx={{
              bgcolor: alpha(tokens.burgundy, 0.12),
              color: tokens.burgundy,
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.18),
            }}
          >
            <PeopleAltRounded />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
              {customer.displayName || contact}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
            >
              {contact}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ mt: 1, flexWrap: "wrap" }}
            >
              <Chip
                size="small"
                label={`${customer.tenantCount} businesses`}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`${customer.orderCount} orders`}
                variant="outlined"
              />
              {customer.customOrderCount > 0 ? (
                <Chip
                  size="small"
                  label={`${customer.customOrderCount} custom`}
                  sx={{
                    bgcolor: alpha(tokens.warning, 0.16),
                    color: tokens.ink,
                  }}
                />
              ) : null}
            </Stack>
          </Box>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(3, minmax(0, 1fr)) auto",
            },
            minWidth: { lg: 520 },
            alignItems: "center",
          }}
        >
          <DetailLine label="GMV" value={formatGHS(customer.gmvMinor)} />
          <DetailLine label="Last business" value={lastBusiness} />
          <DetailLine
            label="Last active"
            value={shortTime(customer.lastActive)}
          />
          <Button
            type="button"
            variant={selected ? "contained" : "outlined"}
            endIcon={<ArrowForwardRounded />}
            onClick={() => onInspect(customer)}
          >
            Inspect
          </Button>
        </Box>
      </Stack>
    </Panel>
  );
}

function CustomerInspector({
  customer,
  onClose,
}: {
  customer: AdminCustomer | null;
  onClose: () => void;
}) {
  if (!customer) {
    return (
      <Panel sx={{ p: 3, position: { xl: "sticky" }, top: 88 }}>
        <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
          <Avatar
            sx={{
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <PeopleAltRounded />
          </Avatar>
          <Typography variant="h6">Select a customer</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Inspect contact, order volume, linked businesses, and customer GMV.
          </Typography>
        </Stack>
      </Panel>
    );
  }

  const contact = customer.email || customer.phone || "No contact on file";
  const lastBusiness = customer.lastBusinessName
    ? `${customer.lastBusinessName} · ${customer.lastBusinessHandle}`
    : "No linked business activity";

  return (
    <Panel sx={{ p: 2.5, position: { xl: "sticky" }, top: 88 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
          <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: tokens.burgundy }}>
              <PeopleAltRounded />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
                {customer.displayName || contact}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
              >
                {shortID(customer.id)}
              </Typography>
            </Box>
          </Stack>
          <IconButton aria-label="Close customer inspector" onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
        <Divider />
        <DetailLine label="Contact" value={contact} />
        <DetailLine label="Phone" value={customer.phone || "Not provided"} />
        <DetailLine
          label="Linked businesses"
          value={String(customer.tenantCount)}
        />
        <DetailLine label="Orders" value={String(customer.orderCount)} />
        <DetailLine
          label="Custom orders"
          value={String(customer.customOrderCount)}
        />
        <DetailLine label="Customer GMV" value={formatGHS(customer.gmvMinor)} />
        <DetailLine label="Last business" value={lastBusiness} />
        <DetailLine
          label="Last active"
          value={shortTime(customer.lastActive)}
        />
        <DetailLine label="Created" value={shortTime(customer.createdAt)} />
        <DetailLine label="Updated" value={shortTime(customer.updatedAt)} />
      </Stack>
    </Panel>
  );
}

function BusinessRow({
  business,
  selected,
  onInspect,
}: {
  business: AdminBusiness;
  selected: boolean;
  onInspect: (business: AdminBusiness) => void;
}) {
  const isSuspended = business.operationalStatus === "suspended";
  const accent = statusColor(business.status);
  const nextStatus: AdminBusinessOperationalStatus = isSuspended
    ? "active"
    : "suspended";

  return (
    <Panel
      sx={{
        p: 2,
        position: "relative",
        borderColor: selected
          ? alpha(tokens.burgundy, 0.42)
          : alpha(accent, 0.2),
        backgroundImage: `
          linear-gradient(90deg, ${alpha(accent, selected ? 0.11 : 0.065)}, transparent 34%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
        `,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "14px auto 14px 0",
          width: 4,
          borderRadius: "0 8px 8px 0",
          bgcolor: selected ? tokens.burgundy : alpha(accent, 0.68),
        },
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: selected
            ? alpha(tokens.burgundy, 0.52)
            : alpha(accent, 0.32),
          boxShadow: `0 20px 52px ${alpha(tokens.ink, 0.09)}`,
        },
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(220px, 1.4fr) repeat(3, minmax(120px, 0.7fr)) auto",
          },
          alignItems: "center",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {business.name}
            </Typography>
            <StatusChip status={business.status} />
            <RiskChip level={business.riskLevel} />
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mt: 0.5, overflowWrap: "anywhere" }}
          >
            {business.handle}.xtiitch.com · {business.ownerEmail}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            GMV
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>
            {formatGHS(business.gmvMinor)}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            Commission
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>
            {formatGHS(business.commissionMinor)}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            Last active
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>
            {shortTime(business.lastActive)}
          </Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row", md: "column" }}
          spacing={1}
        >
          <Button
            variant={selected ? "contained" : "outlined"}
            startIcon={<PersonSearchRounded />}
            onClick={() => onInspect(business)}
          >
            Inspect
          </Button>
          <Button
            variant={isSuspended ? "contained" : "outlined"}
            color={isSuspended ? "primary" : "error"}
            type="submit"
            form={`business-status-${business.id}`}
          >
            {isSuspended ? "Reactivate" : "Suspend"}
          </Button>
          <Form
            id={`business-status-${business.id}`}
            method="post"
            style={{ display: "contents" }}
          >
            <input
              type="hidden"
              name="intent"
              value="admin-business-status:update"
            />
            <input type="hidden" name="business_id" value={business.id} />
            <input type="hidden" name="operational_status" value={nextStatus} />
            <input
              type="hidden"
              name="reason"
              value={
                isSuspended
                  ? "Quick reactivation from the businesses list."
                  : "Quick suspension from the businesses list."
              }
            />
          </Form>
        </Stack>
      </Box>
    </Panel>
  );
}

function BusinessInspector({
  business,
  onReviewPayments,
  onOpenAudit,
  onClose,
}: {
  business: AdminBusiness | null;
  onReviewPayments: () => void;
  onOpenAudit: () => void;
  onClose: () => void;
}) {
  if (!business) {
    return (
      <Panel
        sx={{
          p: 2.5,
          position: { xl: "sticky" },
          top: { xl: 118 },
          borderColor: alpha(tokens.burgundy, 0.16),
          backgroundImage: `
            radial-gradient(circle at 92% 0%, ${alpha(tokens.burgundy, 0.12)}, transparent 34%),
            linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
          `,
        }}
      >
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <PersonSearchRounded />
          </Box>
          <Typography variant="h6">Select a business</Typography>
          <Typography sx={{ color: "text.secondary" }}>
            Inspect one tenant to see its settlement reference, activity, risk
            posture, and admin-safe actions.
          </Typography>
        </Stack>
      </Panel>
    );
  }

  const isSuspended = business.operationalStatus === "suspended";
  const accent = statusColor(business.status);

  return (
    <Panel
      sx={{
        p: 2.5,
        position: { xl: "sticky" },
        top: { xl: 118 },
        borderColor: alpha(accent, 0.24),
        backgroundImage: `
          radial-gradient(circle at 95% 5%, ${alpha(accent, 0.14)}, transparent 32%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
        `,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">{business.name}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {business.handle}.xtiitch.com
            </Typography>
          </Box>
          <Button size="small" onClick={onClose}>
            Close
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <StatusChip status={business.status} />
          <RiskChip level={business.riskLevel} />
          <Chip size="small" label={business.plan} variant="outlined" />
        </Stack>
        <Divider />
        <Stack spacing={1.25}>
          <DetailLine label="Owner" value={business.ownerEmail} />
          <DetailLine
            label="Subaccount"
            value={business.subaccountRef || "Not provisioned"}
          />
          <DetailLine label="Orders" value={String(business.orders)} />
          <DetailLine label="GMV" value={formatGHS(business.gmvMinor)} />
          <DetailLine
            label="Commission"
            value={formatGHS(business.commissionMinor)}
          />
          <DetailLine
            label="Last active"
            value={shortTime(business.lastActive)}
          />
          {business.suspensionReason ? (
            <DetailLine
              label="Suspension reason"
              value={business.suspensionReason}
            />
          ) : null}
        </Stack>
        <Divider />
        <Stack spacing={1}>
          <Typography variant="subtitle2">Admin-safe actions</Typography>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-business-status:update"
            />
            <input type="hidden" name="business_id" value={business.id} />
            <input
              type="hidden"
              name="operational_status"
              value={isSuspended ? "active" : "suspended"}
            />
            <Stack spacing={1}>
              {!isSuspended ? (
                <TextField
                  name="reason"
                  label="Suspension reason"
                  placeholder="Why should this tenant be paused?"
                  multiline
                  minRows={2}
                  fullWidth
                />
              ) : (
                <input
                  type="hidden"
                  name="reason"
                  value="Operator reactivated tenant activity after review."
                />
              )}
              <Button
                type="submit"
                variant="outlined"
                color={isSuspended ? "primary" : "error"}
                startIcon={
                  isSuspended ? <CheckCircleRounded /> : <BlockRounded />
                }
              >
                {isSuspended ? "Reactivate business" : "Suspend business"}
              </Button>
            </Stack>
          </Form>
          <Button
            variant="outlined"
            startIcon={<PaymentsRounded />}
            onClick={onReviewPayments}
          >
            Review payments
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryRounded />}
            onClick={onOpenAudit}
          >
            Open audit trail
          </Button>
          <Button
            variant="outlined"
            startIcon={<StorefrontRounded />}
            href={`https://${business.handle}.xtiitch.com`}
          >
            View public storefront
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ justifyContent: "space-between", gap: 2 }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 800, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function NotificationsSection({
  notifications,
  notificationsError,
  preferences,
  onSelect,
}: {
  notifications: AdminNotification[];
  notificationsError: string | null;
  preferences: AdminProfileSettings["preferences"];
  onSelect: (section: Section) => void;
}) {
  const [filter, setFilter] = useState<AdminNotificationFilter>("all");
  const notificationFilters: {
    value: AdminNotificationFilter;
    label: string;
  }[] = [
    { value: "all", label: "All" },
    { value: "verification", label: "Verification" },
    { value: "money", label: "Money" },
    { value: "subscriptions", label: "Subscriptions" },
    { value: "promotions", label: "Promotions" },
    { value: "ads", label: "Ads" },
    { value: "affiliates", label: "Affiliates" },
    { value: "referrals", label: "Referrals" },
    { value: "risk", label: "Risk" },
    { value: "support", label: "Support" },
    { value: "platform", label: "Platform" },
    { value: "audit", label: "Audit" },
  ];
  const actionableNotifications = notifications.filter(
    (notification) =>
      notification.id !== "all-clear" &&
      notificationCategoryWatched(notification.category, preferences),
  );
  const mutedNotifications = notifications.filter(
    (notification) =>
      notification.id !== "all-clear" &&
      !notificationCategoryWatched(notification.category, preferences),
  ).length;
  const actionableCount = actionableNotifications.length;
  const criticalCount = actionableNotifications.filter(
    (notification) => notification.tone === "critical",
  ).length;
  const visibleNotifications = notifications.filter(
    (notification) => filter === "all" || notification.category === filter,
  );
  const categoryRows = notificationFilters
    .filter(
      (
        item,
      ): item is {
        value: AdminNotificationCategory;
        label: string;
      } => item.value !== "all",
    )
    .map((item) => {
      const count = notifications.filter(
        (notification) => notification.category === item.value,
      ).length;
      return {
        ...item,
        count: count === 1 && notifications[0]?.id === "all-clear" ? 0 : count,
        watched: notificationCategoryWatched(item.value, preferences),
      };
    });
  const routeRows = [
    {
      label: "Email",
      value: preferences.notifyEmail ? "On" : "Off",
      active: preferences.notifyEmail,
    },
    {
      label: "SMS",
      value: preferences.notifySms ? "On" : "Off",
      active: preferences.notifySms,
    },
    {
      label: "Verification",
      value: preferences.alertVerifications ? "Watched" : "Muted",
      active: preferences.alertVerifications,
    },
    {
      label: "Money rails",
      value: preferences.alertMoneyRails ? "Watched" : "Muted",
      active: preferences.alertMoneyRails,
    },
    {
      label: "Subscriptions",
      value: preferences.alertSubscriptions ? "Watched" : "Muted",
      active: preferences.alertSubscriptions,
    },
    {
      label: "Promotions",
      value: preferences.alertPromotions ? "Watched" : "Muted",
      active: preferences.alertPromotions,
    },
    {
      label: "Risk",
      value: preferences.alertRisk ? "Watched" : "Muted",
      active: preferences.alertRisk,
    },
    {
      label: "Support",
      value: preferences.alertSupport ? "Watched" : "Muted",
      active: preferences.alertSupport,
    },
  ];

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Admin alerts"
        title="Notifications"
        helper="A live action center for verification, money rails, risk, and support signals."
      />
      {notificationsError ? (
        <Alert severity="warning">{notificationsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MetricCard
          label="Open alerts"
          value={String(actionableCount)}
          helper="Watched queue signals"
          trend={criticalCount > 0 ? `${criticalCount} critical` : "Stable"}
        />
        <MetricCard
          label="Muted signals"
          value={String(mutedNotifications)}
          helper="Visible, not routed"
          trend={mutedNotifications > 0 ? "Preferences" : "None muted"}
        />
        <MetricCard
          label="Digest time"
          value={preferences.dailyDigestTime}
          helper={preferences.timezone}
          trend={preferences.notifyEmail ? "Email on" : "Email off"}
        />
        <MetricCard
          label="Alert routing"
          value={
            routeRows.filter((row) => row.active).length === routeRows.length
              ? "Full"
              : "Custom"
          }
          helper={`${routeRows.filter((row) => row.active).length} active routes`}
          trend={preferences.notifySms ? "SMS on" : "SMS off"}
        />
      </Box>

      <Panel sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          sx={{ alignItems: { lg: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">Triage lanes</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {actionableCount} watched alerts · {mutedNotifications} muted
              signals
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, nextFilter: AdminNotificationFilter | null) => {
              if (nextFilter) {
                setFilter(nextFilter);
              }
            }}
            sx={{
              flexWrap: "wrap",
              gap: 0.75,
              "& .MuiToggleButton-root": {
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.12),
                borderRadius: 1.25,
                px: 1.4,
                fontWeight: 900,
                "&.Mui-selected": {
                  bgcolor: alpha(tokens.burgundy, 0.1),
                  color: tokens.burgundy,
                },
              },
              "& .MuiToggleButtonGroup-grouped": {
                m: 0,
                borderRadius: 1.25,
              },
            }}
          >
            {notificationFilters.map((item) => (
              <ToggleButton key={item.value} value={item.value}>
                {item.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Panel>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.25fr) 360px" },
          alignItems: "start",
        }}
      >
        <Stack spacing={1.5}>
          {visibleNotifications.map((notification) => {
            const color = notificationToneColor(notification.tone);
            const watched = notificationCategoryWatched(
              notification.category,
              preferences,
            );
            return (
              <Panel
                key={notification.id}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(color, 0.22),
                  backgroundImage: `
                    linear-gradient(90deg, ${alpha(color, 0.08)}, transparent 38%),
                    linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                  `,
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: alpha(color, 0.36),
                    boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
                  },
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: alpha(color, 0.12),
                        color,
                        flex: "0 0 auto",
                      }}
                    >
                      <NotificationsActiveRounded />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          {notification.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={notificationCategoryLabel(
                            notification.category,
                          )}
                          variant="outlined"
                          sx={{
                            borderColor: alpha(color, 0.28),
                            color,
                            fontWeight: 900,
                          }}
                        />
                        <Chip
                          size="small"
                          label={watched ? notification.tone : "muted"}
                          sx={{
                            bgcolor: alpha(watched ? color : tokens.ink, 0.1),
                            color: watched ? color : "text.secondary",
                            textTransform: "capitalize",
                            fontWeight: 900,
                          }}
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {notification.source} · {notification.meta}
                      </Typography>
                      <Typography sx={{ mt: 0.75 }}>
                        {notification.helper}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    variant={
                      notification.tone === "success" || !watched
                        ? "outlined"
                        : "contained"
                    }
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => onSelect(notification.target)}
                    sx={{
                      alignSelf: { xs: "flex-start", md: "center" },
                      whiteSpace: "nowrap",
                    }}
                  >
                    {notification.targetLabel}
                  </Button>
                </Stack>
              </Panel>
            );
          })}
          {visibleNotifications.length === 0 ? (
            <Panel sx={{ p: 3, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 900 }}>
                No alerts in this lane.
              </Typography>
              <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                Choose another triage lane or return to all alerts.
              </Typography>
            </Panel>
          ) : null}
        </Stack>

        <Panel
          sx={{
            p: { xs: 2, md: 2.5 },
            borderColor: alpha(tokens.warning, 0.18),
            backgroundImage: `
              radial-gradient(circle at 96% 0%, ${alpha(tokens.warning, 0.16)}, transparent 36%),
              linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
            `,
          }}
        >
          <Stack spacing={1.75}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <NotificationsActiveRounded sx={{ color: tokens.burgundy }} />
              <Box>
                <Typography variant="h6">Notification routing</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Current delivery and watched categories for this operator.
                </Typography>
              </Box>
            </Stack>
            <Divider />
            <Stack spacing={1}>
              {categoryRows.map((row) => (
                <Box
                  key={row.value}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: alpha(
                      row.watched ? tokens.info : tokens.ink,
                      row.watched ? 0.18 : 0.12,
                    ),
                    bgcolor: row.watched
                      ? alpha(tokens.info, 0.045)
                      : alpha(tokens.ink, 0.025),
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>
                        {row.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontWeight: 800 }}
                      >
                        {row.count} signals
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={row.watched ? "Watched" : "Muted"}
                      sx={{
                        bgcolor: alpha(
                          row.watched ? tokens.info : tokens.ink,
                          row.watched ? 0.12 : 0.08,
                        ),
                        color: row.watched ? tokens.info : "text.secondary",
                        fontWeight: 900,
                      }}
                    />
                  </Stack>
                </Box>
              ))}
              <Divider />
              {routeRows.map((row) => (
                <Box
                  key={row.label}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: alpha(
                      row.active ? tokens.success : tokens.ink,
                      row.active ? 0.18 : 0.12,
                    ),
                    bgcolor: row.active
                      ? alpha(tokens.success, 0.055)
                      : alpha(tokens.ink, 0.025),
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      {row.label}
                    </Typography>
                    <Chip
                      size="small"
                      label={row.value}
                      sx={{
                        bgcolor: alpha(
                          row.active ? tokens.success : tokens.ink,
                          row.active ? 0.12 : 0.08,
                        ),
                        color: row.active ? tokens.success : "text.secondary",
                        fontWeight: 900,
                      }}
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
            <Button
              variant="outlined"
              startIcon={<SettingsRounded />}
              onClick={() => onSelect("settings")}
            >
              Edit notification settings
            </Button>
          </Stack>
        </Panel>
      </Box>
    </Stack>
  );
}

function ReportsSection({
  platformMetrics,
  platformSettings,
  backendReportItems,
  backendReportsError,
  adminBusinesses,
  verificationCases,
  moneyRails,
  subscriptions,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  riskReviews,
  supportTickets,
  auditEvents,
  onSelect,
}: {
  platformMetrics: AdminPlatformMetrics | null;
  platformSettings: AdminPlatformSettings;
  backendReportItems: AdminReportItem[];
  backendReportsError: string | null;
  adminBusinesses: AdminBusiness[];
  verificationCases: AdminVerificationCase[];
  moneyRails: AdminMoneyRails | null;
  subscriptions: AdminSubscription[];
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
  auditEvents: AuditEvent[];
  onSelect: (section: Section) => void;
}) {
  const pendingKyc = verificationCases.filter(
    (item) => item.status === "pending" || item.status === "unverified",
  ).length;
  const highRiskKyc = verificationCases.filter(
    (item) => item.riskLevel === "high" && item.status !== "verified",
  ).length;
  const payoutReviews =
    moneyRails?.payoutReviews.filter(
      (review) => review.holdActive || review.status !== "ready",
    ) ?? [];
  const failedWebhooks =
    moneyRails?.webhookEvents.filter((event) => event.status === "failed") ??
    [];
  const subscriptionsNeedingAttention = subscriptions.filter(
    (subscription) =>
      subscription.status === "past_due" ||
      subscription.status === "grace_period" ||
      subscription.status === "cancel_at_period_end" ||
      (typeof subscription.designLimit === "number" &&
        subscription.designCount > subscription.designLimit),
  );
  const overDesignLimitSubscriptions = subscriptions.filter(
    (subscription) =>
      typeof subscription.designLimit === "number" &&
      subscription.designCount > subscription.designLimit,
  );
  const activeSubscriptionMrrMinor = subscriptions.reduce(
    (total, subscription) =>
      subscription.status !== "canceled"
        ? total + subscription.monthlyFeeMinor
        : total,
    0,
  );
  const activePromotions = promotions.filter(
    (promotion) => promotion.status === "active",
  );
  const pendingPromotionRedemptions = promotions.reduce(
    (total, promotion) =>
      total +
      promotion.recentRedemptions.filter(
        (redemption) => redemption.status === "pending",
      ).length,
    0,
  );
  const promotionRedeemedMinor = promotions.reduce(
    (total, promotion) => total + promotion.discountRedeemedMinor,
    0,
  );
  const pendingAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const activeAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "active",
  );
  const adBookedMinor = adCampaigns
    .filter((campaign) => campaign.status !== "archived")
    .reduce((total, campaign) => total + campaign.budgetMinor, 0);
  const adSpendMinor = adCampaigns.reduce(
    (total, campaign) => total + campaign.spendMinor,
    0,
  );
  const pendingAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "pending_review",
  );
  const activeAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "active",
  );
  const paystackAffiliates = affiliates.filter((affiliate) =>
    affiliate.payoutMode.startsWith("paystack"),
  );
  const activeReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "active",
  );
  const draftReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "draft",
  );
  const pausedReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "paused",
  );
  const archivedReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "archived",
  );
  const openRisks = riskReviews.filter((review) => review.status === "open");
  const urgentSupport = supportTickets.filter(
    (ticket) => ticket.priority === "urgent" && ticket.status === "open",
  );
  const openSupport = supportTickets.filter(
    (ticket) => ticket.status === "open",
  );
  const suspendedBusinesses = adminBusinesses.filter(
    (business) => business.operationalStatus === "suspended",
  );
  const criticalAudit = auditEvents.filter(
    (event) => event.severity === "critical",
  );
  const warningAudit = auditEvents.filter(
    (event) => event.severity === "warning",
  );
  const derivedReportItems: AdminReportItem[] = [
    {
      id: "kyc",
      label: "Business verification",
      value: `${pendingKyc} pending`,
      helper:
        highRiskKyc > 0
          ? `${highRiskKyc} high-risk verification cases need owner attention.`
          : "KYC queue is within normal review posture.",
      status: highRiskKyc > 0 ? "blocked" : pendingKyc > 0 ? "watch" : "ready",
      target: "verification",
      targetLabel: "Review KYC",
    },
    {
      id: "money",
      label: "Money rails",
      value: `${payoutReviews.length + failedWebhooks.length} signals`,
      helper:
        payoutReviews.length > 0
          ? `${payoutReviews.length} settlement rows are held or under review.`
          : `${failedWebhooks.length} webhook events need operator attention.`,
      status:
        payoutReviews.length > 0 || failedWebhooks.length > 0
          ? "blocked"
          : "ready",
      target: "money",
      targetLabel: "Open money",
    },
    {
      id: "subscriptions",
      label: "Subscription billing",
      value: `${subscriptionsNeedingAttention.length} signals`,
      helper:
        subscriptionsNeedingAttention.length > 0
          ? `${overDesignLimitSubscriptions.length} businesses are over plan usage · ${formatGHS(activeSubscriptionMrrMinor)} active MRR snapshot.`
          : `${formatGHS(activeSubscriptionMrrMinor)} active MRR snapshot with no billing alerts.`,
      status:
        subscriptions.some(
          (subscription) =>
            subscription.status === "past_due" ||
            subscription.status === "grace_period",
        ) || overDesignLimitSubscriptions.length > 0
          ? "blocked"
          : subscriptionsNeedingAttention.length > 0
            ? "watch"
            : "ready",
      target: "subscriptions",
      targetLabel: "Open subscriptions",
    },
    {
      id: "promotions",
      label: "Promotion activity",
      value: `${pendingPromotionRedemptions} pending`,
      helper:
        pendingPromotionRedemptions > 0
          ? `${activePromotions.length} active offers · ${formatGHS(promotionRedeemedMinor)} redeemed discount needs review.`
          : `${activePromotions.length} active offers · ${formatGHS(promotionRedeemedMinor)} redeemed discount.`,
      status: pendingPromotionRedemptions > 0 ? "watch" : "ready",
      target: "promotions",
      targetLabel: "Open promotions",
    },
    {
      id: "ads",
      label: "Sponsored placements",
      value: `${pendingAdCampaigns.length} pending`,
      helper:
        pendingAdCampaigns.length > 0
          ? `${activeAdCampaigns.length} active placements · ${formatGHS(adBookedMinor)} booked ad budget.`
          : `${activeAdCampaigns.length} active placements · ${formatGHS(adSpendMinor)} spent so far.`,
      status: pendingAdCampaigns.length > 0 ? "watch" : "ready",
      target: "ads",
      targetLabel: "Open ads",
    },
    {
      id: "affiliates",
      label: "Affiliate programmes",
      value: `${pendingAffiliates.length} pending`,
      helper:
        pendingAffiliates.length > 0
          ? `${activeAffiliates.length} active partners · ${paystackAffiliates.length} Paystack-ready payout rails.`
          : `${activeAffiliates.length} active partners with no pending review.`,
      status: pendingAffiliates.length > 0 ? "watch" : "ready",
      target: "affiliates",
      targetLabel: "Open affiliates",
    },
    {
      id: "referrals",
      label: "Referral programmes",
      value: `${draftReferralProgrammes.length + pausedReferralProgrammes.length} signals`,
      helper:
        draftReferralProgrammes.length > 0
          ? `${activeReferralProgrammes.length} active programmes · ${draftReferralProgrammes.length} drafts need final review.`
          : `${activeReferralProgrammes.length} active programmes · ${archivedReferralProgrammes.length} archived.`,
      status: draftReferralProgrammes.length > 0 ? "watch" : "ready",
      target: "referrals",
      targetLabel: "Open referrals",
    },
    {
      id: "risk",
      label: "Risk and safety",
      value: `${openRisks.length} open`,
      helper:
        openRisks.length > 0
          ? `${openRisks.filter((review) => review.level === "high").length} high-risk review rows are still open.`
          : "No active risk reviews are waiting.",
      status: openRisks.some((review) => review.level === "high")
        ? "blocked"
        : openRisks.length > 0
          ? "watch"
          : "ready",
      target: "risk",
      targetLabel: "Open risk",
    },
    {
      id: "support",
      label: "Support exposure",
      value: `${openSupport.length} open`,
      helper:
        urgentSupport.length > 0
          ? `${urgentSupport.length} urgent support tickets are still open.`
          : "Support queue has no urgent open tickets.",
      status:
        urgentSupport.length > 0
          ? "blocked"
          : openSupport.length > 0
            ? "watch"
            : "ready",
      target: "support",
      targetLabel: "Open support",
    },
    {
      id: "audit",
      label: "Audit posture",
      value: `${criticalAudit.length + warningAudit.length} flagged`,
      helper:
        criticalAudit.length > 0
          ? `${criticalAudit.length} critical audit events are visible in the current feed.`
          : `${warningAudit.length} warning audit events are visible in the current feed.`,
      status:
        criticalAudit.length > 0
          ? "blocked"
          : warningAudit.length > 0
            ? "watch"
            : "ready",
      target: "audit",
      targetLabel: "Open audit",
    },
    {
      id: "policy",
      label: "Platform policy",
      value: platformSettings.maintenanceMode ? "Maintenance" : "Live",
      helper: `${platformSettings.verificationSlaHours}h verification SLA · ${formatGHS(
        platformSettings.payoutReviewThresholdPesewas,
      )} payout review threshold.`,
      status: platformSettings.maintenanceMode ? "watch" : "ready",
      target: "settings",
      targetLabel: "Open settings",
    },
  ];
  const reportItems =
    backendReportItems.length > 0 ? backendReportItems : derivedReportItems;
  const blockedCount = reportItems.filter(
    (item) => item.status === "blocked",
  ).length;
  const watchCount = reportItems.filter(
    (item) => item.status === "watch",
  ).length;
  const latestAuditEvents = auditEvents.slice(0, 5);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Operator reporting"
        title="Reports"
        helper="A compact posture view for compliance, money controls, platform policy, and operator follow-up."
      />
      {backendReportsError ? (
        <Alert severity="warning">{backendReportsError}</Alert>
      ) : null}
      <Form method="post" reloadDocument style={{ alignSelf: "flex-start" }}>
        <input type="hidden" name="intent" value="admin-export:download" />
        <input type="hidden" name="dataset" value="report-posture" />
        <Button
          type="submit"
          variant="outlined"
          startIcon={<FileDownloadRounded />}
        >
          Download CSV
        </Button>
      </Form>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="GMV this month"
          value={formatGHS(platformMetrics?.gmvMonthMinor ?? 0)}
          helper="Succeeded platform payments"
          trend={`${platformMetrics?.totalPayments30d ?? 0} payments`}
        />
        <MetricCard
          label="Commission"
          value={formatGHS(platformMetrics?.platformRevenueMonthMinor ?? 0)}
          helper="Platform revenue month to date"
          trend="MTD"
        />
        <MetricCard
          label="Report flags"
          value={String(blockedCount + watchCount)}
          helper={`${blockedCount} blocked · ${watchCount} watch`}
          trend={blockedCount > 0 ? "Action" : "Stable"}
        />
        <MetricCard
          label="Active tenants"
          value={String(platformMetrics?.activeBusinesses ?? 0)}
          helper={`${suspendedBusinesses.length} suspended stores`}
          trend={formatPercentBps(platformMetrics?.paymentHealthBps ?? 0)}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.25fr) 380px" },
          alignItems: "start",
        }}
      >
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <ReceiptLongRounded sx={{ color: tokens.burgundy }} />
              <Box>
                <Typography variant="h6">Operational report</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Current posture by admin workflow.
                </Typography>
              </Box>
            </Stack>
            <Divider />
            <Stack spacing={1.25}>
              {reportItems.map((item) => {
                const color = reportStatusColor(item.status);
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: alpha(color, 0.2),
                      bgcolor: alpha(color, 0.045),
                      backgroundImage: `linear-gradient(90deg, ${alpha(
                        color,
                        0.07,
                      )}, transparent 36%)`,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      sx={{
                        alignItems: { md: "center" },
                        justifyContent: "space-between",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", flexWrap: "wrap" }}
                        >
                          <Typography sx={{ fontWeight: 900 }}>
                            {item.label}
                          </Typography>
                          <Chip
                            size="small"
                            label={item.status}
                            sx={{
                              bgcolor: alpha(color, 0.12),
                              color,
                              textTransform: "capitalize",
                              fontWeight: 900,
                            }}
                          />
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary", fontWeight: 900 }}
                          >
                            {item.value}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.65, color: "text.secondary" }}
                        >
                          {item.helper}
                        </Typography>
                      </Box>
                      <Button
                        variant={
                          item.status === "blocked" ? "contained" : "outlined"
                        }
                        size="small"
                        endIcon={<ArrowForwardRounded />}
                        onClick={() => onSelect(item.target)}
                        sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                      >
                        {item.targetLabel}
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        </Panel>

        <Stack spacing={2.5}>
          <Panel
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(tokens.info, 0.16),
              backgroundImage: `
                radial-gradient(circle at 96% 0%, ${alpha(tokens.info, 0.14)}, transparent 34%),
                linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
              `,
            }}
          >
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                <ShieldRounded sx={{ color: tokens.burgundy }} />
                <Box>
                  <Typography variant="h6">Compliance snapshot</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    KYC, settlement, support, and operator traceability.
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <DetailLine label="Pending KYC" value={String(pendingKyc)} />
              <DetailLine
                label="Payout holds"
                value={String(payoutReviews.length)}
              />
              <DetailLine
                label="Failed webhooks"
                value={String(failedWebhooks.length)}
              />
              <DetailLine label="Open risks" value={String(openRisks.length)} />
              <DetailLine
                label="Urgent support"
                value={String(urgentSupport.length)}
              />
              <DetailLine
                label="Policy updated"
                value={
                  platformSettings.updatedAt
                    ? shortTime(platformSettings.updatedAt)
                    : "Default"
                }
              />
            </Stack>
          </Panel>

          <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                <HistoryRounded sx={{ color: tokens.burgundy }} />
                <Box>
                  <Typography variant="h6">Recent audit evidence</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Latest durable operator events.
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              {latestAuditEvents.map((event) => {
                const color = auditColor(event.severity);
                return (
                  <Box
                    key={event.id}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: alpha(color, 0.16),
                      bgcolor: alpha(color, 0.045),
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          {event.action}
                        </Typography>
                        <Chip
                          size="small"
                          label={event.severity}
                          sx={{
                            bgcolor: alpha(color, 0.12),
                            color,
                            textTransform: "capitalize",
                          }}
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {event.actor} · {shortTime(event.createdAt)}
                      </Typography>
                    </Stack>
                  </Box>
                );
              })}
              {latestAuditEvents.length === 0 ? (
                <Alert severity="info">No audit events are visible yet.</Alert>
              ) : null}
              <Button
                variant="outlined"
                startIcon={<HistoryRounded />}
                onClick={() => onSelect("audit")}
              >
                Open audit log
              </Button>
            </Stack>
          </Panel>
        </Stack>
      </Box>
    </Stack>
  );
}

function ExportsSection({
  platformMetrics,
  platformSettings,
  profileSettings,
  launchReadiness,
  adminUsers,
  adminBusinesses,
  adminCustomers,
  verificationCases,
  moneyRails,
  roleCatalog,
  plans,
  subscriptions,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  riskReviews,
  supportTickets,
  auditEvents,
  onSelect,
}: {
  platformMetrics: AdminPlatformMetrics | null;
  platformSettings: AdminPlatformSettings;
  profileSettings: AdminProfileSettings;
  launchReadiness: AdminLaunchReadiness | null;
  adminUsers: AdminUser[];
  adminBusinesses: AdminBusiness[];
  adminCustomers: AdminCustomer[];
  verificationCases: AdminVerificationCase[];
  moneyRails: AdminMoneyRails | null;
  roleCatalog: AdminRoleDefinition[];
  plans: AdminPlan[];
  subscriptions: AdminSubscription[];
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
  auditEvents: AuditEvent[];
  onSelect: (section: Section) => void;
}) {
  const timeOrFallback = (value?: string) => (value ? shortTime(value) : "");
  const moneyWebhookEvents = moneyRails?.webhookEvents ?? [];
  const moneyPayoutReviews = moneyRails?.payoutReviews ?? [];
  const promotionRedemptions = promotions.flatMap((promotion) =>
    promotion.recentRedemptions.map((redemption) => ({
      promotion,
      redemption,
    })),
  );
  const pendingAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const pendingAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "pending_review",
  );
  const draftReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "draft",
  );
  const exportDatasets: AdminExportDataset[] = [
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
          `${platformMetrics?.totalBusinesses ?? adminBusinesses.length} total tenants`,
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
      id: "businesses",
      title: "Businesses",
      helper:
        "Tenant status, owner, GMV, commission, risk, and subaccount data.",
      source: "businesses",
      sourceLabel: "Open businesses",
      tone: adminBusinesses.some(
        (business) => business.operationalStatus === "suspended",
      )
        ? "watch"
        : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Owner",
          "Status",
          "Operational",
          "Plan",
          "Orders",
          "GMV",
          "Commission",
          "Risk",
          "Subaccount",
          "Last active",
        ],
        ...adminBusinesses.map((business) => [
          business.name,
          business.handle,
          business.ownerEmail,
          business.status,
          business.operationalStatus,
          business.plan,
          business.orders,
          formatGHS(business.gmvMinor),
          formatGHS(business.commissionMinor),
          business.riskLevel,
          business.subaccountRef || "Not provisioned",
          shortTime(business.lastActive),
        ]),
      ],
    },
    {
      id: "customers",
      title: "Customers",
      helper:
        "Client identity, contact, cross-tenant relationships, order volume, and GMV.",
      source: "customers",
      sourceLabel: "Open customers",
      tone: adminCustomers.some((customer) => customer.tenantCount > 1)
        ? "watch"
        : "ready",
      rows: [
        [
          "Customer",
          "Email",
          "Phone",
          "Businesses",
          "Orders",
          "Custom orders",
          "GMV",
          "Last business",
          "Last active",
        ],
        ...adminCustomers.map((customer) => [
          customer.displayName || customer.id,
          customer.email,
          customer.phone,
          customer.tenantCount,
          customer.orderCount,
          customer.customOrderCount,
          formatGHS(customer.gmvMinor),
          customer.lastBusinessName || customer.lastBusinessHandle,
          shortTime(customer.lastActive),
        ]),
      ],
    },
    {
      id: "verification",
      title: "Verification queue",
      helper: "KYC status, risk level, owner contact, documents, and notes.",
      source: "verification",
      sourceLabel: "Open KYC",
      tone: verificationCases.some(
        (item) => item.riskLevel === "high" && item.status !== "verified",
      )
        ? "blocked"
        : verificationCases.length > 0
          ? "watch"
          : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Owner",
          "Email",
          "Status",
          "Risk",
          "Plan",
          "Documents",
          "Submitted",
          "Updated",
          "Notes",
        ],
        ...verificationCases.map((item) => [
          item.businessName,
          item.handle,
          item.ownerName,
          item.ownerEmail,
          item.status,
          item.riskLevel,
          item.plan,
          item.documents.join("; "),
          shortTime(item.submittedAt),
          shortTime(item.updatedAt),
          item.notes,
        ]),
      ],
    },
    {
      id: "money",
      title: "Money rails",
      helper:
        "Webhook events and settlement review rows for Paystack operations.",
      source: "money",
      sourceLabel: "Open money",
      tone:
        moneyWebhookEvents.some((event) => event.status === "failed") ||
        moneyPayoutReviews.some(
          (review) => review.holdActive || review.status === "blocked",
        )
          ? "blocked"
          : moneyWebhookEvents.length + moneyPayoutReviews.length > 0
            ? "watch"
            : "ready",
      rows: [
        [
          "Kind",
          "Business",
          "Reference",
          "Status",
          "Amount",
          "Attempts",
          "Received/Updated",
          "Note",
        ],
        ...moneyWebhookEvents.map((event) => [
          "Webhook",
          event.business,
          event.providerReference,
          event.status,
          formatGHS(event.amountMinor),
          event.attempts,
          shortTime(event.receivedAt),
          event.note,
        ]),
        ...moneyPayoutReviews.map((review) => [
          "Settlement",
          review.business,
          review.subaccountRef,
          review.holdActive ? "held" : review.status,
          formatGHS(review.settlementMinor),
          "",
          timeOrFallback(review.holdUpdatedAt),
          review.holdReason || review.nextAction,
        ]),
      ],
    },
    {
      id: "risk",
      title: "Risk reviews",
      helper:
        "Open and closed trust, safety, payout, and verification signals.",
      source: "risk",
      sourceLabel: "Open risk",
      tone: riskReviews.some(
        (review) => review.level === "high" && review.status === "open",
      )
        ? "blocked"
        : riskReviews.some((review) => review.status === "open")
          ? "watch"
          : "ready",
      rows: [
        ["Title", "Business", "Level", "Status", "Owner", "Updated", "Reason"],
        ...riskReviews.map((review) => [
          review.title,
          review.business,
          review.level,
          review.status,
          review.owner,
          shortTime(review.updatedAt),
          review.reason,
        ]),
      ],
    },
    {
      id: "support",
      title: "Support tickets",
      helper: "Priority, assignment, status, category, and issue summary.",
      source: "support",
      sourceLabel: "Open support",
      tone: supportTickets.some(
        (ticket) => ticket.priority === "urgent" && ticket.status === "open",
      )
        ? "blocked"
        : supportTickets.some((ticket) => ticket.status === "open")
          ? "watch"
          : "ready",
      rows: [
        [
          "Subject",
          "Business",
          "Category",
          "Priority",
          "Status",
          "Assigned",
          "Created",
          "Updated",
          "Summary",
        ],
        ...supportTickets.map((ticket) => [
          ticket.subject,
          ticket.business,
          ticket.category,
          ticket.priority,
          ticket.status,
          ticket.assignedAdminName || ticket.assignedAdminEmail || "Unassigned",
          shortTime(ticket.createdAt),
          shortTime(ticket.updatedAt),
          ticket.summary,
        ]),
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
      id: "plans",
      title: "Plan packages",
      helper: "Package pricing, commission, tenant count, and MRR snapshot.",
      source: "subscriptions",
      sourceLabel: "Open plans",
      tone: plans.some((plan) => !plan.isActive) ? "watch" : "ready",
      rows: [
        [
          "Name",
          "Code",
          "Active",
          "Monthly fee",
          "Commission",
          "Design limit",
          "Businesses",
          "Active subscriptions",
          "Estimated MRR",
          "Created",
          "Updated",
        ],
        ...plans.map((plan) => [
          plan.name,
          plan.code,
          plan.isActive ? "Active" : "Archived",
          formatGHS(plan.monthlyFeeMinor),
          `${(plan.commissionBps / 100).toFixed(2)}%`,
          typeof plan.designLimit === "number" ? plan.designLimit : "Unlimited",
          plan.businessCount,
          plan.activeSubscriptionCount,
          formatGHS(plan.estimatedMrrMinor),
          shortTime(plan.createdAt),
          shortTime(plan.updatedAt),
        ]),
      ],
    },
    {
      id: "subscriptions",
      title: "Subscriptions",
      helper: "Plan, billing state, invoices, usage, and renewal timing.",
      source: "subscriptions",
      sourceLabel: "Open subscriptions",
      tone: subscriptions.some(
        (subscription) =>
          subscription.status === "past_due" ||
          subscription.status === "grace_period",
      )
        ? "blocked"
        : subscriptions.some(
              (subscription) =>
                subscription.status === "cancel_at_period_end" ||
                subscription.status === "canceled",
            )
          ? "watch"
          : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Plan",
          "Status",
          "Billing mode",
          "Monthly fee",
          "Design usage",
          "Last invoice",
          "Last payment",
          "Next billing",
        ],
        ...subscriptions.map((subscription) => [
          subscription.businessName,
          subscription.handle,
          subscription.planName,
          subscriptionStatusLabel(subscription.status),
          billingModeLabel(subscription.billingMode),
          formatGHS(subscription.monthlyFeeMinor),
          typeof subscription.designLimit === "number"
            ? `${subscription.designCount}/${subscription.designLimit}`
            : `${subscription.designCount}/unlimited`,
          subscription.lastInvoiceRef,
          timeOrFallback(subscription.lastPaymentAt),
          timeOrFallback(subscription.nextBillingAt),
        ]),
      ],
    },
    {
      id: "promotions",
      title: "Promotions",
      helper: "Voucher rules, targeting, funding, usage, and redeemed value.",
      source: "promotions",
      sourceLabel: "Open promotions",
      tone: promotions.some((promotion) => promotion.status === "paused")
        ? "watch"
        : "ready",
      rows: [
        [
          "Title",
          "Code",
          "Business",
          "Status",
          "Type",
          "Value",
          "Funding",
          "Scope",
          "Redemptions",
          "Discount redeemed",
        ],
        ...promotions.map((promotion) => [
          promotion.title,
          promotion.code,
          promotion.businessName || "Platform-wide",
          promotion.status,
          promotion.discountType,
          promotion.discountType === "percentage"
            ? `${(promotion.discountValue / 100).toFixed(1)}%`
            : formatGHS(promotion.discountValue),
          promotion.fundingSource,
          promotion.scope,
          promotion.redemptionCount,
          formatGHS(promotion.discountRedeemedMinor),
        ]),
      ],
    },
    {
      id: "ad-campaigns",
      title: "Sponsored placements",
      helper:
        "Campaign status, advertiser, placement, budget, spend, and engagement.",
      source: "ads",
      sourceLabel: "Open ads",
      tone: pendingAdCampaigns.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Campaign",
          "Business",
          "Handle",
          "Placement",
          "Target",
          "Status",
          "Pricing",
          "Budget",
          "Spend",
          "Daily cap",
          "Starts",
          "Ends",
          "Impressions",
          "Clicks",
          "CTR",
          "Review note",
          "Updated",
        ],
        ...adCampaigns.map((campaign) => [
          campaign.headline,
          campaign.businessName,
          campaign.businessHandle,
          adPlacementLabel(campaign.placementType),
          campaign.targetLabel || campaign.targetRefId || "Business storefront",
          adCampaignStatusLabel(campaign.status),
          campaign.pricingModel,
          formatGHS(campaign.budgetMinor),
          formatGHS(campaign.spendMinor),
          typeof campaign.dailyCapMinor === "number"
            ? formatGHS(campaign.dailyCapMinor)
            : "",
          shortTime(campaign.startsAt),
          shortTime(campaign.endsAt),
          campaign.impressionCount,
          campaign.clickCount,
          formatPercentBps(campaign.clickRateBps),
          campaign.reviewNote,
          shortTime(campaign.updatedAt),
        ]),
      ],
    },
    {
      id: "affiliates",
      title: "Affiliate programmes",
      helper:
        "Partner codes, contact details, commission terms, payout rails, cookie windows, and status.",
      source: "affiliates",
      sourceLabel: "Open affiliates",
      tone: pendingAffiliates.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Affiliate",
          "Code",
          "Entity",
          "Contact",
          "Email",
          "Phone",
          "Website",
          "Commission",
          "Cookie window",
          "Payout mode",
          "Payout reference",
          "Status",
          "Notes",
          "Updated",
        ],
        ...affiliates.map((affiliate) => [
          affiliate.displayName,
          affiliate.code,
          affiliateEntityLabel(affiliate.entityType),
          affiliate.contactName,
          affiliate.email,
          affiliate.phone,
          affiliate.websiteUrl,
          affiliateCommissionLabel(affiliate),
          `${affiliate.cookieWindowDays} days`,
          affiliatePayoutLabel(affiliate.payoutMode),
          affiliate.payoutReference,
          affiliateStatusLabel(affiliate.status),
          affiliate.notes,
          shortTime(affiliate.updatedAt),
        ]),
      ],
    },
    {
      id: "referral-programmes",
      title: "Referral programmes",
      helper:
        "Code prefixes, audiences, reward economics, qualifying order minimums, hold windows, schedules, and status.",
      source: "referrals",
      sourceLabel: "Open referrals",
      tone: draftReferralProgrammes.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Programme",
          "Code prefix",
          "Audience",
          "Referrer reward",
          "New customer reward",
          "Reward",
          "Minimum order",
          "Hold days",
          "Status",
          "Starts",
          "Ends",
          "Notes",
          "Updated",
        ],
        ...referralProgrammes.map((programme) => [
          programme.title,
          programme.codePrefix,
          referralAudienceLabel(programme.audience),
          referralRewardKindLabel(programme.referrerRewardKind),
          referralRefereeRewardKindLabel(programme.refereeRewardKind),
          referralRewardLabel(programme),
          formatGHS(programme.qualifyingOrderMinMinor),
          programme.rewardHoldDays,
          referralStatusLabel(programme.status),
          programme.startsAt ? shortTime(programme.startsAt) : "",
          programme.endsAt ? shortTime(programme.endsAt) : "",
          programme.notes,
          shortTime(programme.updatedAt),
        ]),
      ],
    },
    {
      id: "promotion-redemptions",
      title: "Recent promotion redemptions",
      helper:
        "Latest redemption rows per voucher with customer and order evidence.",
      source: "promotions",
      sourceLabel: "Open promotions",
      tone: promotionRedemptions.some(
        ({ redemption }) => redemption.status === "pending",
      )
        ? "watch"
        : "ready",
      rows: [
        [
          "Promotion",
          "Code",
          "Business",
          "Business ID",
          "Customer",
          "Customer ID",
          "Order ID",
          "Status",
          "Discount",
          "Redeemed at",
          "Created at",
          "Updated at",
        ],
        ...promotionRedemptions.map(({ promotion, redemption }) => [
          promotion.title,
          promotion.code,
          promotion.businessName || "Platform-wide",
          redemption.businessId,
          redemption.customerName || "Unknown customer",
          redemption.customerId ?? "",
          redemption.orderId ?? "",
          redemption.status,
          formatGHS(redemption.discountMinor),
          timeOrFallback(redemption.redeemedAt),
          shortTime(redemption.createdAt),
          shortTime(redemption.updatedAt),
        ]),
      ],
    },
  ];
  const exportRowCount = exportDatasets.reduce(
    (sum, dataset) => sum + Math.max(dataset.rows.length - 1, 0),
    0,
  );
  const blockedCount = exportDatasets.filter(
    (dataset) => dataset.tone === "blocked",
  ).length;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Operator exports"
        title="Exports"
        helper="Download CSV snapshots from the current admin read models for reporting, review, and compliance handoff."
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="Export packs"
          value={String(exportDatasets.length)}
          helper="Current admin datasets"
          trend="CSV"
        />
        <MetricCard
          label="Rows available"
          value={String(exportRowCount)}
          helper="Across all export files"
          trend="Live"
        />
        <MetricCard
          label="Blocked packs"
          value={String(blockedCount)}
          helper="Need operator attention"
          trend={blockedCount > 0 ? "Review" : "Clear"}
        />
        <MetricCard
          label="Audit rows"
          value={String(auditEvents.length)}
          helper="Durable admin evidence"
          trend="Traceable"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {exportDatasets.map((dataset) => {
          const color = reportStatusColor(dataset.tone);
          const rowCount = Math.max(dataset.rows.length - 1, 0);
          return (
            <Panel
              key={dataset.id}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderColor: alpha(color, 0.2),
                backgroundImage: `
                  linear-gradient(90deg, ${alpha(color, 0.07)}, transparent 34%),
                  linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                `,
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "flex-start" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(color, 0.12),
                      color,
                      flex: "0 0 auto",
                    }}
                  >
                    <FileDownloadRounded />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="h6">{dataset.title}</Typography>
                      <Chip
                        size="small"
                        label={dataset.tone}
                        sx={{
                          bgcolor: alpha(color, 0.12),
                          color,
                          textTransform: "capitalize",
                          fontWeight: 900,
                        }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {rowCount} rows · {dataset.helper}
                    </Typography>
                  </Box>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ flexWrap: "wrap" }}
                >
                  <Form method="post" reloadDocument>
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-export:download"
                    />
                    <input type="hidden" name="dataset" value={dataset.id} />
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<FileDownloadRounded />}
                    >
                      Download CSV
                    </Button>
                  </Form>
                  <Button
                    variant="outlined"
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => onSelect(dataset.source)}
                  >
                    {dataset.sourceLabel}
                  </Button>
                </Stack>
              </Stack>
            </Panel>
          );
        })}
      </Box>
    </Stack>
  );
}

function HealthSection({
  platformMetrics,
  platformSettings,
  adminUsers,
  adminBusinesses,
  verificationCases,
  moneyRails,
  subscriptions,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  riskReviews,
  supportTickets,
  auditEvents,
  operationsHealth,
  operationsHealthError,
  onSelect,
}: {
  platformMetrics: AdminPlatformMetrics | null;
  platformSettings: AdminPlatformSettings;
  adminUsers: AdminUser[];
  adminBusinesses: AdminBusiness[];
  verificationCases: AdminVerificationCase[];
  moneyRails: AdminMoneyRails | null;
  subscriptions: AdminSubscription[];
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
  auditEvents: AuditEvent[];
  operationsHealth: AdminOperationsHealth | null;
  operationsHealthError: string | null;
  onSelect: (section: Section) => void;
}) {
  const failedWebhooks =
    moneyRails?.webhookEvents.filter((event) => event.status === "failed") ??
    [];
  const payoutHolds =
    moneyRails?.payoutReviews.filter(
      (review) => review.holdActive || review.status === "blocked",
    ) ?? [];
  const pendingKyc = verificationCases.filter(
    (item) => item.status === "pending" || item.status === "unverified",
  );
  const highRiskKyc = pendingKyc.filter((item) => item.riskLevel === "high");
  const suspendedBusinesses = adminBusinesses.filter(
    (business) => business.operationalStatus === "suspended",
  );
  const openRisks = riskReviews.filter((review) => review.status === "open");
  const highOpenRisks = openRisks.filter((review) => review.level === "high");
  const openSupport = supportTickets.filter(
    (ticket) => ticket.status === "open",
  );
  const urgentSupport = openSupport.filter(
    (ticket) => ticket.priority === "urgent",
  );
  const criticalAudit = auditEvents.filter(
    (event) => event.severity === "critical",
  );
  const inactiveUsers = adminUsers.filter((user) => !user.isActive);
  const subscriptionsAtRisk = subscriptions.filter(
    (subscription) =>
      subscription.status === "past_due" ||
      subscription.status === "grace_period" ||
      (typeof subscription.designLimit === "number" &&
        subscription.designCount > subscription.designLimit),
  );
  const subscriptionsOnWatch = subscriptions.filter(
    (subscription) => subscription.status === "cancel_at_period_end",
  );
  const activePromotions = promotions.filter(
    (promotion) => promotion.status === "active",
  );
  const pendingPromotionRedemptions = promotions.reduce(
    (total, promotion) =>
      total +
      promotion.recentRedemptions.filter(
        (redemption) => redemption.status === "pending",
      ).length,
    0,
  );
  const pendingAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const activeAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "active",
  );
  const pendingAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "pending_review",
  );
  const activeAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "active",
  );
  const manualPayoutAffiliates = affiliates.filter(
    (affiliate) => affiliate.payoutMode === "manual",
  );
  const activeReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "active",
  );
  const draftReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "draft",
  );
  const pausedReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "paused",
  );
  const paymentHealth = platformMetrics?.paymentHealthBps ?? 0;
  const derivedHealthSignals: AdminReportItem[] = [
    {
      id: "payments",
      label: "Payment rails",
      value: formatPercentBps(paymentHealth),
      helper:
        failedWebhooks.length > 0
          ? `${failedWebhooks.length} failed webhook events need review.`
          : `${platformMetrics?.failedPayments30d ?? 0} failed payments in the last 30 days.`,
      status:
        failedWebhooks.length > 0 || payoutHolds.length > 0
          ? "blocked"
          : (platformMetrics?.failedPayments30d ?? 0) > 0
            ? "watch"
            : "ready",
      target: "money",
      targetLabel: "Open money rails",
    },
    {
      id: "subscriptions",
      label: "Subscription health",
      value: `${subscriptionsAtRisk.length} at risk`,
      helper:
        subscriptionsAtRisk.length > 0
          ? "Past-due, grace-period, or over-plan businesses need follow-up."
          : `${subscriptionsOnWatch.length} subscriptions are scheduled to cancel at period end.`,
      status:
        subscriptionsAtRisk.length > 0
          ? "blocked"
          : subscriptionsOnWatch.length > 0
            ? "watch"
            : "ready",
      target: "subscriptions",
      targetLabel: "Open subscriptions",
    },
    {
      id: "promotions",
      label: "Promotion controls",
      value: `${activePromotions.length} active`,
      helper:
        pendingPromotionRedemptions > 0
          ? `${pendingPromotionRedemptions} pending redemptions need operator review.`
          : "No pending promotion redemptions are visible.",
      status: pendingPromotionRedemptions > 0 ? "watch" : "ready",
      target: "promotions",
      targetLabel: "Open promotions",
    },
    {
      id: "ads",
      label: "Sponsored placements",
      value: `${pendingAdCampaigns.length} pending`,
      helper:
        pendingAdCampaigns.length > 0
          ? `${pendingAdCampaigns.length} advertiser placements need operator approval.`
          : `${activeAdCampaigns.length} active placements are cleared for approved windows.`,
      status: pendingAdCampaigns.length > 0 ? "watch" : "ready",
      target: "ads",
      targetLabel: "Open ads",
    },
    {
      id: "affiliates",
      label: "Affiliate programmes",
      value: `${pendingAffiliates.length} pending`,
      helper:
        pendingAffiliates.length > 0
          ? `${pendingAffiliates.length} partners need operator review before attribution.`
          : `${activeAffiliates.length} active partners · ${manualPayoutAffiliates.length} manual payout rails.`,
      status:
        pendingAffiliates.length > 0 || manualPayoutAffiliates.length > 0
          ? "watch"
          : "ready",
      target: "affiliates",
      targetLabel: "Open affiliates",
    },
    {
      id: "referrals",
      label: "Referral programmes",
      value: `${activeReferralProgrammes.length} active`,
      helper:
        draftReferralProgrammes.length > 0
          ? `${draftReferralProgrammes.length} draft programmes need operator review before launch.`
          : `${pausedReferralProgrammes.length} paused programmes are retained for audit and future relaunch.`,
      status: draftReferralProgrammes.length > 0 ? "watch" : "ready",
      target: "referrals",
      targetLabel: "Open referrals",
    },
    {
      id: "kyc",
      label: "Business verification",
      value: `${pendingKyc.length} pending`,
      helper:
        highRiskKyc.length > 0
          ? `${highRiskKyc.length} high-risk verification cases are pending.`
          : "Verification queue has no high-risk pending cases.",
      status:
        highRiskKyc.length > 0
          ? "blocked"
          : pendingKyc.length > 0
            ? "watch"
            : "ready",
      target: "verification",
      targetLabel: "Open KYC",
    },
    {
      id: "tenants",
      label: "Tenant operations",
      value: `${suspendedBusinesses.length} suspended`,
      helper:
        suspendedBusinesses.length > 0
          ? "Suspended businesses need follow-up notes or reactivation review."
          : "No stores are suspended right now.",
      status: suspendedBusinesses.length > 0 ? "watch" : "ready",
      target: "businesses",
      targetLabel: "Open businesses",
    },
    {
      id: "trust",
      label: "Risk and support",
      value: `${openRisks.length + openSupport.length} open`,
      helper:
        highOpenRisks.length > 0 || urgentSupport.length > 0
          ? `${highOpenRisks.length} high risk and ${urgentSupport.length} urgent support signals are open.`
          : "No critical trust/support exposure is open.",
      status:
        highOpenRisks.length > 0 || urgentSupport.length > 0
          ? "blocked"
          : openRisks.length + openSupport.length > 0
            ? "watch"
            : "ready",
      target: highOpenRisks.length > 0 ? "risk" : "support",
      targetLabel: "Open queue",
    },
    {
      id: "audit",
      label: "Audit evidence",
      value: `${auditEvents.length} events`,
      helper:
        criticalAudit.length > 0
          ? `${criticalAudit.length} critical audit events are visible.`
          : "Sensitive operator actions have durable trace coverage.",
      status:
        criticalAudit.length > 0
          ? "blocked"
          : auditEvents.length === 0
            ? "watch"
            : "ready",
      target: "audit",
      targetLabel: "Open audit",
    },
    {
      id: "policy",
      label: "Platform policy",
      value: platformSettings.maintenanceMode ? "Maintenance" : "Live",
      helper: `${platformSettings.verificationSlaHours}h KYC SLA and ${formatGHS(
        platformSettings.payoutReviewThresholdPesewas,
      )} payout threshold.`,
      status: platformSettings.maintenanceMode ? "watch" : "ready",
      target: "settings",
      targetLabel: "Open settings",
    },
    {
      id: "access",
      label: "Operator access",
      value: `${adminUsers.length} users`,
      helper:
        inactiveUsers.length > 0
          ? `${inactiveUsers.length} inactive operators remain visible for review.`
          : "All loaded operator accounts are active.",
      status: inactiveUsers.length > 0 ? "watch" : "ready",
      target: "users",
      targetLabel: "Open users",
    },
    {
      id: "exports",
      label: "Export readiness",
      value: "Ready",
      helper:
        "CSV snapshots are available for report posture and admin queues.",
      status: "ready",
      target: "exports",
      targetLabel: "Open exports",
    },
  ];
  const healthSignals: AdminReportItem[] =
    operationsHealth?.signals.map((signal) => ({
      id: signal.id,
      label: signal.label,
      value: signal.value,
      helper: signal.helper,
      status: signal.status,
      target: signal.target as Section,
      targetLabel: signal.targetLabel,
    })) ?? derivedHealthSignals;
  const blockedCount = operationsHealth
    ? operationsHealth.blockedCount
    : healthSignals.filter((signal) => signal.status === "blocked").length;
  const watchCount = operationsHealth
    ? operationsHealth.watchCount
    : healthSignals.filter((signal) => signal.status === "watch").length;
  const healthScore = operationsHealth
    ? operationsHealth.healthScore
    : Math.max(0, 100 - blockedCount * 15 - watchCount * 7);
  const paymentHealthMetric =
    operationsHealth?.paymentHealthBps ?? paymentHealth;
  const failedWebhookMetric =
    operationsHealth?.failedWebhooks ?? failedWebhooks.length;
  const payoutHoldMetric = operationsHealth?.payoutHolds ?? payoutHolds.length;
  const trustPressureMetric =
    (operationsHealth?.openRiskReviews ?? openRisks.length) +
    (operationsHealth?.openSupportTickets ?? openSupport.length);
  const urgentSupportMetric =
    operationsHealth?.urgentSupportTickets ?? urgentSupport.length;
  const auditEventMetric = operationsHealth?.auditEvents ?? auditEvents.length;
  const criticalAuditMetric =
    operationsHealth?.criticalAuditEvents ?? criticalAudit.length;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Platform health"
        title="Operations health"
        helper="A command view for payment posture, tenant exposure, support/risk pressure, audit coverage, and operator readiness."
      />
      {operationsHealthError ? (
        <Alert severity="warning">{operationsHealthError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="Health score"
          value={`${healthScore}/100`}
          helper={`${blockedCount} blocked · ${watchCount} watch`}
          trend={blockedCount > 0 ? "Action" : "Steady"}
        />
        <MetricCard
          label="Payment health"
          value={formatPercentBps(paymentHealthMetric)}
          helper={`${failedWebhookMetric} failed webhooks`}
          trend={`${payoutHoldMetric} holds`}
        />
        <MetricCard
          label="Trust pressure"
          value={String(trustPressureMetric)}
          helper="Open risk and support rows"
          trend={`${urgentSupportMetric} urgent`}
        />
        <MetricCard
          label="Audit events"
          value={String(auditEventMetric)}
          helper="Loaded durable evidence"
          trend={criticalAuditMetric > 0 ? "Critical" : "Traceable"}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {healthSignals.map((signal) => {
          const color = reportStatusColor(signal.status);
          return (
            <Panel
              key={signal.id}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderColor: alpha(color, 0.2),
                backgroundImage: `
                  linear-gradient(90deg, ${alpha(color, 0.08)}, transparent 36%),
                  linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                `,
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: alpha(color, 0.34),
                  boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.09)}`,
                },
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(color, 0.12),
                      color,
                      flex: "0 0 auto",
                    }}
                  >
                    <SyncRounded />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="h6">{signal.label}</Typography>
                      <Chip
                        size="small"
                        label={signal.status}
                        sx={{
                          bgcolor: alpha(color, 0.12),
                          color,
                          textTransform: "capitalize",
                          fontWeight: 900,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontWeight: 900 }}
                      >
                        {signal.value}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.65, color: "text.secondary" }}
                    >
                      {signal.helper}
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  variant={
                    signal.status === "blocked" ? "contained" : "outlined"
                  }
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => onSelect(signal.target)}
                  sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                >
                  {signal.targetLabel}
                </Button>
              </Stack>
            </Panel>
          );
        })}
      </Box>
    </Stack>
  );
}

function LaunchReadinessSection({
  readiness,
  readinessError,
  onSelect,
}: {
  readiness: AdminLaunchReadiness | null;
  readinessError: string | null;
  onSelect: (section: Section) => void;
}) {
  const checks = readiness?.checks ?? [];
  const totalChecks = checks.length;
  const readyCount = readiness?.readyCount ?? 0;
  const watchCount = readiness?.watchCount ?? 0;
  const blockedCount = readiness?.blockedCount ?? 0;
  const readinessScore =
    totalChecks > 0 ? Math.round((readyCount / totalChecks) * 100) : 0;
  const environment = readiness?.environment ?? "unavailable";
  const updatedAt = readiness?.updatedAt
    ? shortTime(readiness.updatedAt)
    : "Not loaded";
  const targetSection = (target: string): Section =>
    navItems.some((item) => item.id === target)
      ? (target as Section)
      : "settings";

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Launch control"
        title="Launch readiness"
        helper="A production gate view for credentials, provider transports, legal review, quality scans, and owner-controlled configuration."
      />
      {readinessError ? (
        <Alert severity="warning">{readinessError}</Alert>
      ) : null}
      {!readiness && !readinessError ? (
        <Alert severity="info">Launch readiness has not loaded yet.</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="Readiness score"
          value={`${readinessScore}%`}
          helper={`${readyCount}/${totalChecks} gates ready`}
          trend={
            blockedCount > 0 ? "Blocked" : watchCount > 0 ? "Watch" : "Ready"
          }
        />
        <MetricCard
          label="Blocked gates"
          value={String(blockedCount)}
          helper="Must clear before launch"
          trend={blockedCount > 0 ? "Action" : "Clear"}
        />
        <MetricCard
          label="Watch gates"
          value={String(watchCount)}
          helper="Need validation or follow-up"
          trend={watchCount > 0 ? "Review" : "Quiet"}
        />
        <MetricCard
          label="Environment"
          value={environment}
          helper={`Updated ${updatedAt}`}
          trend="Config"
        />
      </Box>

      <Panel
        sx={{
          p: { xs: 2, md: 3 },
          borderColor:
            blockedCount > 0
              ? alpha(tokens.danger, 0.24)
              : alpha(tokens.success, 0.22),
          backgroundImage: `
            linear-gradient(90deg, ${
              blockedCount > 0
                ? alpha(tokens.danger, 0.08)
                : alpha(tokens.success, 0.08)
            }, transparent 38%),
            linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
          `,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(
                  blockedCount > 0 ? tokens.danger : tokens.success,
                  0.12,
                ),
                color: blockedCount > 0 ? tokens.danger : tokens.success,
                flex: "0 0 auto",
              }}
            >
              <AssignmentTurnedInRounded />
            </Box>
            <Box>
              <Typography variant="h6">Production gate posture</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {blockedCount > 0
                  ? `${blockedCount} blocker${blockedCount === 1 ? "" : "s"} need owner follow-up before public launch.`
                  : "No blockers are visible in the loaded readiness feed."}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip
              label={`${readyCount} ready`}
              sx={{
                bgcolor: alpha(tokens.success, 0.12),
                color: tokens.success,
                fontWeight: 900,
              }}
            />
            <Chip
              label={`${watchCount} watch`}
              sx={{
                bgcolor: alpha(tokens.warning, 0.12),
                color: tokens.warning,
                fontWeight: 900,
              }}
            />
            <Chip
              label={`${blockedCount} blocked`}
              sx={{
                bgcolor: alpha(tokens.danger, 0.12),
                color: tokens.danger,
                fontWeight: 900,
              }}
            />
          </Stack>
        </Stack>
      </Panel>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {checks.map((check) => {
          const color = reportStatusColor(check.status);
          return (
            <Panel
              key={check.id}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderColor: alpha(color, 0.22),
                backgroundImage: `
                  linear-gradient(90deg, ${alpha(color, 0.07)}, transparent 34%),
                  linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                `,
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: alpha(color, 0.12),
                        color,
                        flex: "0 0 auto",
                      }}
                    >
                      <AssignmentTurnedInRounded />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">{check.label}</Typography>
                        <Chip
                          size="small"
                          label={check.status}
                          sx={{
                            bgcolor: alpha(color, 0.12),
                            color,
                            textTransform: "capitalize",
                            fontWeight: 900,
                          }}
                        />
                        <Chip size="small" label={check.category} />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.65, color: "text.secondary" }}
                      >
                        {check.summary}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    variant={
                      check.status === "blocked" ? "contained" : "outlined"
                    }
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => onSelect(targetSection(check.target))}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                  >
                    {check.targetLabel}
                  </Button>
                </Stack>
                <Divider />
                <Stack spacing={0.75}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {check.detail}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    {check.action}
                  </Typography>
                </Stack>
              </Stack>
            </Panel>
          );
        })}
      </Box>
    </Stack>
  );
}

type AdminSubscriptionPlanMeta = {
  code: string;
  name: string;
  monthlyFeeMinor: number;
  commissionBps: number;
  designLimit: string;
  promise: string;
  tone: string;
};

const freeSubscriptionPlanMeta: AdminSubscriptionPlanMeta = {
  code: "free",
  name: "Free - Get Online",
  monthlyFeeMinor: 0,
  commissionBps: 300,
  designLimit: "10 designs",
  promise: "Starter storefront, higher commission.",
  tone: tokens.warning,
};

const subscriptionPlanMeta: AdminSubscriptionPlanMeta[] = [
  freeSubscriptionPlanMeta,
  {
    code: "standard",
    name: "Standard",
    monthlyFeeMinor: 5000,
    commissionBps: 100,
    designLimit: "Unlimited",
    promise: "Lower commission for active shops.",
    tone: tokens.info,
  },
  {
    code: "growth",
    name: "Growth",
    monthlyFeeMinor: 12000,
    commissionBps: 50,
    designLimit: "Unlimited",
    promise: "Lowest commission for scaling teams.",
    tone: tokens.success,
  },
];

function subscriptionPlanFor(plan: string): AdminSubscriptionPlanMeta {
  const normalized = plan.trim().toLowerCase();
  return (
    subscriptionPlanMeta.find(
      (candidate) =>
        normalized === candidate.code ||
        normalized === candidate.name.toLowerCase() ||
        normalized.includes(candidate.code),
    ) ?? freeSubscriptionPlanMeta
  );
}

function fallbackAdminPlans(): AdminPlan[] {
  return subscriptionPlanMeta.map((plan) => ({
    planId: plan.code,
    code: plan.code,
    name: plan.name,
    monthlyFeeMinor: plan.monthlyFeeMinor,
    commissionBps: plan.commissionBps,
    designLimit: plan.code === "free" ? 10 : undefined,
    isActive: true,
    businessCount: 0,
    activeSubscriptionCount: 0,
    estimatedMrrMinor: 0,
    createdAt: "",
    updatedAt: "",
  }));
}

function planVisualFor(code: string): { promise: string; tone: string } {
  const normalized = code.trim().toLowerCase();
  const match = subscriptionPlanMeta.find((plan) => plan.code === normalized);
  return {
    promise:
      match?.promise ??
      "Operator-defined package for a specific growth motion.",
    tone: match?.tone ?? tokens.burgundy,
  };
}

function planDesignLimitLabel(plan: Pick<AdminPlan, "designLimit">): string {
  return typeof plan.designLimit === "number"
    ? `${plan.designLimit} designs`
    : "Unlimited";
}

function subscriptionDesignUsageLabel(
  subscription: Pick<AdminSubscription, "designCount" | "designLimit">,
): string {
  if (typeof subscription.designLimit === "number") {
    return `${subscription.designCount}/${subscription.designLimit} active designs`;
  }
  return `${subscription.designCount} active designs`;
}

function planMonthlyFeeDefault(
  plan: Pick<AdminPlan, "monthlyFeeMinor">,
): string {
  return (plan.monthlyFeeMinor / 100).toFixed(2);
}

const subscriptionStatusOptions: {
  value: AdminSubscriptionStatus;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "grace_period", label: "Grace period" },
  { value: "cancel_at_period_end", label: "Cancel at period end" },
  { value: "canceled", label: "Canceled" },
];

const subscriptionBillingModeOptions: {
  value: AdminSubscriptionBillingMode;
  label: string;
}[] = [
  { value: "manual", label: "Manual" },
  { value: "payment_link", label: "Payment link" },
  { value: "recurring", label: "Recurring" },
];

const promotionDiscountTypeOptions: {
  value: AdminPromotionDiscountType;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
];

const promotionFundingSourceOptions: {
  value: AdminPromotionFundingSource;
  label: string;
}[] = [
  { value: "business", label: "Business funded" },
  { value: "platform", label: "Platform funded" },
  { value: "split", label: "Split funded" },
];

const promotionScopeOptions: { value: AdminPromotionScope; label: string }[] = [
  { value: "store", label: "Whole store" },
  { value: "collection", label: "Collection" },
  { value: "design", label: "Design" },
];

const promotionStatusOptions: {
  value: Exclude<AdminPromotionStatus, "archived">;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

const adPlacementOptions: { value: AdminAdPlacementType; label: string }[] = [
  { value: "featured_business", label: "Featured business" },
  { value: "promoted_design", label: "Promoted design" },
  { value: "homepage_hero", label: "Homepage hero" },
];

const adCampaignStatusOptions: {
  value: Exclude<AdminAdCampaignStatus, "archived">;
  label: string;
}[] = [
  { value: "pending_review", label: "Pending review" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const affiliateEntityOptions: {
  value: AdminAffiliateEntityType;
  label: string;
}[] = [
  { value: "person", label: "Person" },
  { value: "business", label: "Business" },
  { value: "agency", label: "Agency" },
];

const affiliateCommissionOptions: {
  value: AdminAffiliateCommissionModel;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "flat", label: "Flat fee" },
];

const affiliatePayoutOptions: {
  value: AdminAffiliatePayoutMode;
  label: string;
}[] = [
  { value: "paystack_split", label: "Paystack split" },
  { value: "paystack_transfer", label: "Paystack transfer" },
  { value: "voucher", label: "Voucher fallback" },
  { value: "manual", label: "Manual review" },
];

const affiliateStatusOptions: {
  value: Exclude<AdminAffiliateStatus, "archived">;
  label: string;
}[] = [
  { value: "pending_review", label: "Pending review" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

const referralAudienceOptions: {
  value: AdminReferralAudience;
  label: string;
}[] = [
  { value: "customers", label: "Customers" },
  { value: "businesses", label: "Businesses" },
  { value: "mixed", label: "Customers and businesses" },
];

const referralRewardKindOptions: {
  value: AdminReferralRewardKind;
  label: string;
}[] = [
  { value: "voucher", label: "Voucher" },
  { value: "commission_rebate", label: "Commission rebate" },
  { value: "none", label: "No referrer reward" },
];

const referralRefereeRewardKindOptions: {
  value: AdminReferralRefereeRewardKind;
  label: string;
}[] = [
  { value: "voucher", label: "Voucher" },
  { value: "none", label: "No new-customer reward" },
];

const referralRewardTypeOptions: {
  value: AdminReferralRewardType;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
];

const referralStatusOptions: {
  value: Exclude<AdminReferralProgrammeStatus, "archived">;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

const referralCodeOwnerOptions: {
  value: Exclude<AdminReferralCodeOwnerType, "customer">;
  label: string;
}[] = [
  { value: "platform", label: "Platform" },
  { value: "business", label: "Business" },
];

const referralCodeStatusOptions: {
  value: Exclude<AdminReferralCodeStatus, "archived">;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

function subscriptionStatusLabel(status: AdminSubscriptionStatus): string {
  return (
    subscriptionStatusOptions.find((option) => option.value === status)
      ?.label ?? status
  );
}

function billingModeLabel(mode: AdminSubscriptionBillingMode): string {
  return (
    subscriptionBillingModeOptions.find((option) => option.value === mode)
      ?.label ?? mode
  );
}

function invoiceStatusLabel(status: string): string {
  switch (status) {
    case "issued":
      return "Issued";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "void":
      return "Void";
    default:
      return status;
  }
}

function subscriptionStatusColor(status: AdminSubscriptionStatus): string {
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

function promotionStatusColor(status: AdminPromotionStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "paused":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}

function promotionDiscountLabel(promotion: AdminPromotion): string {
  if (promotion.discountType === "percentage") {
    return `${(promotion.discountValue / 100).toFixed(1)}%`;
  }
  return formatGHS(promotion.discountValue);
}

function promotionTargetLabel(promotion: AdminPromotion): string {
  return promotion.businessName
    ? `${promotion.businessName} · ${promotion.businessHandle}`
    : "Platform-wide";
}

function promotionScopeTargetLabel(promotion: AdminPromotion): string {
  if (promotion.scope === "collection") {
    return promotion.targetCollectionId
      ? `collection ${shortID(promotion.targetCollectionId)}`
      : "collection target";
  }
  if (promotion.scope === "design") {
    return promotion.targetDesignId
      ? `design ${shortID(promotion.targetDesignId)}`
      : "design target";
  }
  return "store";
}

function promotionValueDefault(promotion: AdminPromotion): string {
  if (promotion.discountType === "percentage") {
    return (promotion.discountValue / 100).toString();
  }
  return (promotion.discountValue / 100).toFixed(2);
}

function adCampaignStatusLabel(status: AdminAdCampaignStatus): string {
  return (
    adCampaignStatusOptions.find((option) => option.value === status)?.label ??
    (status === "archived" ? "Archived" : status)
  );
}

function adPlacementLabel(value: AdminAdPlacementType): string {
  return (
    adPlacementOptions.find((option) => option.value === value)?.label ?? value
  );
}

function adCampaignStatusColor(status: AdminAdCampaignStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "pending_review":
    case "paused":
      return tokens.warning;
    case "completed":
      return tokens.info;
    default:
      return tokens.mutedText;
  }
}

function adCampaignPaymentStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return tokens.success;
    case "failed":
    case "void":
      return tokens.danger;
    case "initiated":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}

function affiliateStatusLabel(status: AdminAffiliateStatus): string {
  return (
    affiliateStatusOptions.find((option) => option.value === status)?.label ??
    (status === "archived" ? "Archived" : status)
  );
}

function affiliateEntityLabel(value: AdminAffiliateEntityType): string {
  return (
    affiliateEntityOptions.find((option) => option.value === value)?.label ??
    value
  );
}

function affiliatePayoutLabel(value: AdminAffiliatePayoutMode): string {
  return (
    affiliatePayoutOptions.find((option) => option.value === value)?.label ??
    value
  );
}

function affiliateStatusColor(status: AdminAffiliateStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "pending_review":
    case "paused":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}

function affiliateCommissionLabel(affiliate: AdminAffiliate): string {
  if (affiliate.commissionModel === "percentage") {
    return formatPercentBps(affiliate.commissionRate);
  }
  return formatGHS(affiliate.commissionRate);
}

function affiliateCommissionDefault(affiliate: AdminAffiliate): string {
  if (affiliate.commissionModel === "percentage") {
    return (affiliate.commissionRate / 100).toString();
  }
  return (affiliate.commissionRate / 100).toFixed(2);
}

function referralAudienceLabel(value: AdminReferralAudience): string {
  return (
    referralAudienceOptions.find((option) => option.value === value)?.label ??
    value
  );
}

function referralRewardKindLabel(value: AdminReferralRewardKind): string {
  return (
    referralRewardKindOptions.find((option) => option.value === value)?.label ??
    value
  );
}

function referralRefereeRewardKindLabel(
  value: AdminReferralRefereeRewardKind,
): string {
  return (
    referralRefereeRewardKindOptions.find((option) => option.value === value)
      ?.label ?? value
  );
}

function referralStatusLabel(status: AdminReferralProgrammeStatus): string {
  return (
    referralStatusOptions.find((option) => option.value === status)?.label ??
    (status === "archived" ? "Archived" : status)
  );
}

function referralStatusColor(status: AdminReferralProgrammeStatus): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "draft":
    case "paused":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}

function referralRewardLabel(programme: AdminReferralProgramme): string {
  const value =
    programme.rewardType === "percentage"
      ? `${(programme.rewardValue / 100).toFixed(1)}%`
      : formatGHS(programme.rewardValue);
  const cap =
    programme.rewardType === "percentage" &&
    typeof programme.maxRewardMinor === "number"
      ? ` capped at ${formatGHS(programme.maxRewardMinor)}`
      : "";
  return `${value}${cap}`;
}

function referralRewardDefault(programme: AdminReferralProgramme): string {
  if (programme.rewardType === "percentage") {
    return (programme.rewardValue / 100).toString();
  }
  return (programme.rewardValue / 100).toFixed(2);
}

function referralRewardTypeLabel(value: AdminReferralRewardType): string {
  return (
    referralRewardTypeOptions.find((option) => option.value === value)?.label ??
    value
  );
}

function moneyInputDefault(value?: number): string {
  return typeof value === "number" ? (value / 100).toFixed(2) : "";
}

function datetimeLocalDefault(value?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}

function splitDateTimeInputValue(value = ""): {
  date: string;
  time: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) {
    const fallback = datetimeLocalDefault(value);
    return fallback && fallback !== value
      ? splitDateTimeInputValue(fallback)
      : { date: "", time: "" };
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}

function normaliseTimeInput(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const periodOptions = ["AM", "PM"] as const;

function splitTimeParts(value: string): {
  hour: string;
  minute: string;
  period: (typeof periodOptions)[number] | "";
} {
  const normalised = normaliseTimeInput(value);
  if (!normalised) {
    return { hour: "", minute: "", period: "" };
  }
  const [hourRaw = "0", minute = ""] = normalised.split(":");
  const hours = Number.parseInt(hourRaw, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return {
    hour: String(displayHour).padStart(2, "0"),
    minute,
    period,
  };
}

function composeTimeInputValue(
  hour: string,
  minute: string,
  period: string,
): string {
  if (!hour || !minute || !period) {
    return "";
  }
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  if (
    parsedHour < 1 ||
    parsedHour > 12 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return "";
  }
  const hours24 = period === "PM" ? (parsedHour % 12) + 12 : parsedHour % 12;
  return (
    normaliseTimeInput(
      `${String(hours24).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`,
    ) ?? ""
  );
}

function FormGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: alpha(tokens.ink, 0.55),
        mt: 1.75,
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

function StyledDateTimeField({
  name,
  label,
  defaultValue = "",
  required = false,
  disabled = false,
  size = "small",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
}) {
  const initial = splitDateTimeInputValue(defaultValue);
  const [value, setValue] = useState(
    initial.date && initial.time ? `${initial.date}T${initial.time}` : "",
  );
  return (
    <TextField
      type="datetime-local"
      name={name}
      label={label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      required={required}
      disabled={disabled}
      size={size}
      fullWidth
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}

function StyledTimeField({
  name,
  label,
  defaultValue = "",
  required = false,
  disabled = false,
  size = "small",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
}) {
  const initial = splitTimeParts(defaultValue);
  const [value, setValue] = useState(
    composeTimeInputValue(initial.hour, initial.minute, initial.period),
  );
  return (
    <TextField
      type="time"
      name={name}
      label={label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      required={required}
      disabled={disabled}
      size={size}
      fullWidth
      slotProps={{ inputLabel: { shrink: true } }}
    />
  );
}

function BillingOperationCard({
  icon,
  title,
  helper,
  tone,
  chips,
  intent,
  noteLabel,
  noteDefault,
  actionLabel,
  actionIcon,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  tone: string;
  chips: string[];
  intent: string;
  noteLabel: string;
  noteDefault: string;
  actionLabel: string;
  actionIcon: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 1.75 },
        border: "1px solid",
        borderColor: alpha(tone, 0.18),
        borderRadius: 2,
        bgcolor: alpha(tokens.white, 0.72),
        minWidth: 0,
      }}
    >
      <Stack spacing={1.4}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.15}
          sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: tone,
              bgcolor: alpha(tone, 0.1),
              border: "1px solid",
              borderColor: alpha(tone, 0.16),
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
              {chips.map((chip) => (
                <Chip
                  key={chip}
                  size="small"
                  label={chip}
                  sx={{
                    bgcolor: alpha(tone, 0.09),
                    border: "1px solid",
                    borderColor: alpha(tone, 0.18),
                    color: tone,
                    fontWeight: 900,
                  }}
                />
              ))}
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 0.35, color: "text.secondary" }}
            >
              {helper}
            </Typography>
          </Box>
        </Stack>
        <Form method="post">
          <input type="hidden" name="intent" value={intent} />
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
              alignItems: "center",
            }}
          >
            <TextField
              size="small"
              name="reason"
              label={noteLabel}
              defaultValue={noteDefault}
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={actionIcon}
              sx={{
                justifySelf: { xs: "stretch", md: "end" },
                height: 44,
                px: 2.5,
                whiteSpace: "nowrap",
              }}
            >
              {actionLabel}
            </Button>
          </Box>
        </Form>
      </Stack>
    </Box>
  );
}

function SubscriptionsSection({
  subscriptions,
  subscriptionsError,
  plans,
  plansError,
  platformMetrics,
  actionData,
  onSelect,
}: {
  subscriptions: AdminSubscription[];
  subscriptionsError: string | null;
  plans: AdminPlan[];
  plansError: string | null;
  platformMetrics: AdminPlatformMetrics | null;
  actionData?: AdminActionFeedback;
  onSelect: (section: Section) => void;
}) {
  const [manageBusinessId, setManageBusinessId] = useState<string | null>(null);
  const billableSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.monthlyFeeMinor > 0 && subscription.status !== "canceled",
  );
  const visiblePlans = plans.length > 0 ? plans : fallbackAdminPlans();
  const planRows = visiblePlans.map((plan) => {
    const rows = subscriptions.filter((subscription) => {
      const planText = `${subscription.planCode} ${subscription.planName}`;
      const subscriptionCode = subscription.planCode.trim().toLowerCase();
      const subscriptionName = subscription.planName.trim().toLowerCase();
      return (
        subscriptionCode === plan.code ||
        subscriptionName === plan.name.trim().toLowerCase() ||
        subscriptionPlanFor(planText).code === plan.code
      );
    });
    const active = rows.filter(
      (subscription) => subscription.status !== "canceled",
    );
    const gmvMinor = rows.reduce(
      (total, subscription) => total + subscription.gmvMinor,
      0,
    );
    const commissionMinor = rows.reduce(
      (total, subscription) => total + subscription.commissionMinor,
      0,
    );
    const visual = planVisualFor(plan.code);
    return {
      plan,
      visual,
      subscriptions: rows,
      active,
      gmvMinor,
      commissionMinor,
      businessTotal: plans.length > 0 ? plan.businessCount : rows.length,
      activeTotal:
        plans.length > 0 ? plan.activeSubscriptionCount : active.length,
      estimatedMrrMinor:
        plans.length > 0
          ? plan.estimatedMrrMinor
          : active.reduce(
              (total, subscription) => total + subscription.monthlyFeeMinor,
              0,
            ),
    };
  });
  const estimatedMrrMinor = planRows.reduce(
    (total, row) => total + row.estimatedMrrMinor,
    0,
  );
  const freeUpgradeCandidates = subscriptions.filter((subscription) => {
    const plan = subscriptionPlanFor(
      `${subscription.planCode} ${subscription.planName}`,
    );
    return (
      plan.code === "free" &&
      subscription.status !== "canceled" &&
      subscription.gmvMinor >= 50000
    );
  });
  const overDesignLimitRows = subscriptions.filter(
    (subscription) =>
      typeof subscription.designLimit === "number" &&
      subscription.designCount > subscription.designLimit,
  );
  const attentionRows = subscriptions
    .filter(
      (subscription) =>
        subscription.status === "past_due" ||
        subscription.status === "grace_period" ||
        subscription.status === "cancel_at_period_end" ||
        (typeof subscription.designLimit === "number" &&
          subscription.designCount > subscription.designLimit) ||
        (subscription.monthlyFeeMinor > 0 &&
          subscription.billingMode !== "recurring") ||
        (subscription.planCode === "free" && subscription.gmvMinor >= 50000),
    )
    .slice(0, 10);
  const lifecycleRows = attentionRows.length
    ? attentionRows
    : subscriptions.slice(0, 10);
  const recentEvents = subscriptions
    .flatMap((subscription) =>
      subscription.events.map((event) => ({
        ...event,
        businessName: subscription.businessName,
      })),
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 6);
  const pastDueCount = subscriptions.filter(
    (subscription) =>
      subscription.status === "past_due" ||
      subscription.status === "grace_period",
  ).length;
  const nowMs = Date.now();
  const overdueIssuedInvoiceCount = subscriptions.reduce(
    (total, subscription) =>
      total +
      subscription.invoices.filter(
        (invoice) =>
          invoice.status === "issued" &&
          new Date(invoice.dueAt).getTime() <= nowMs,
      ).length,
    0,
  );
  const expiredGraceCount = subscriptions.filter(
    (subscription) =>
      subscription.status === "grace_period" &&
      subscription.graceEndsAt &&
      new Date(subscription.graceEndsAt).getTime() <= nowMs,
  ).length;
  const recurringDueRows = subscriptions.filter((subscription) => {
    if (
      subscription.monthlyFeeMinor <= 0 ||
      subscription.billingMode !== "recurring" ||
      subscription.status === "canceled" ||
      subscription.status === "cancel_at_period_end" ||
      !subscription.nextBillingAt ||
      new Date(subscription.nextBillingAt).getTime() > nowMs
    ) {
      return false;
    }
    return !subscription.invoices.some(
      (invoice) => invoice.status === "issued",
    );
  });
  const recurringReadyRows = recurringDueRows.filter(
    (subscription) =>
      subscription.ownerEmail.trim() !== "" &&
      subscription.providerSubscriptionRef.trim() !== "",
  );
  const recurringBlockedCount =
    recurringDueRows.length - recurringReadyRows.length;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Plan billing"
        title="Subscriptions"
        helper="Lifecycle state, billing mode, grace periods, cancellations, and event history for business packages."
      />

      {actionData?.section === "subscriptions" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          <Stack spacing={0.75}>
            <span>{actionData.message}</span>
            {actionData.detail ? (
              <Typography variant="body2" sx={{ color: "inherit" }}>
                {actionData.detail}
              </Typography>
            ) : null}
            {actionData.href ? (
              <Button
                component="a"
                href={actionData.href}
                target="_blank"
                rel="noreferrer"
                size="small"
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                sx={{ alignSelf: "flex-start" }}
              >
                {actionData.hrefLabel ?? "Open link"}
              </Button>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      {subscriptionsError ? (
        <Alert severity="warning">{subscriptionsError}</Alert>
      ) : null}
      {!subscriptionsError && subscriptions.length === 0 ? (
        <Alert severity="info">
          No subscription records are available yet.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MetricCard
          label="Estimated base MRR"
          value={formatGHS(estimatedMrrMinor)}
          helper="From active paid package rows"
          trend={`${billableSubscriptions.length} billable`}
        />
        <MetricCard
          label="Commission revenue"
          value={formatGHS(platformMetrics?.platformRevenueMonthMinor ?? 0)}
          helper="Current month money-rail commission"
          trend="Live"
        />
        <MetricCard
          label="Lifecycle attention"
          value={String(attentionRows.length)}
          helper="Past due, grace, package limits, billing, and upgrades"
          trend={pastDueCount ? `${pastDueCount} due` : "Clear"}
        />
        <MetricCard
          label="Over design limit"
          value={String(overDesignLimitRows.length)}
          helper="Active designs above package cap"
          trend={overDesignLimitRows.length ? "Review" : "Clear"}
        />
        <MetricCard
          label="Free upgrade candidates"
          value={String(freeUpgradeCandidates.length)}
          helper="Free stores above GHS 500 GMV"
          trend="Review"
        />
      </Box>

      <Panel
        sx={{
          p: { xs: 2, md: 2.5 },
          borderColor: alpha(tokens.success, 0.2),
          backgroundImage: `
            radial-gradient(circle at 96% 6%, ${alpha(tokens.success, 0.12)}, transparent 30%),
            linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
          `,
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "stretch", md: "flex-start" },
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">Billing operations</Typography>
              <Typography sx={{ color: "text.secondary", maxWidth: 760 }}>
                Run controlled billing jobs without moving funds until a charge
                or invoice action explicitly does it.
              </Typography>
            </Box>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ flexWrap: "wrap", justifyContent: { md: "flex-end" } }}
            >
              <Chip
                size="small"
                label={`${overdueIssuedInvoiceCount} overdue`}
                color={overdueIssuedInvoiceCount ? "warning" : "success"}
                variant={overdueIssuedInvoiceCount ? "filled" : "outlined"}
              />
              <Chip
                size="small"
                label={`${recurringReadyRows.length} ready`}
                color={recurringReadyRows.length ? "success" : "default"}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`${recurringBlockedCount} blocked`}
                color={recurringBlockedCount ? "warning" : "default"}
                variant="outlined"
              />
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                xl: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            <BillingOperationCard
              icon={<SyncRounded />}
              title="Billing sweep"
              helper="Fail overdue invoices and cancel subscriptions whose grace window has expired."
              tone={
                overdueIssuedInvoiceCount || expiredGraceCount
                  ? tokens.warning
                  : tokens.success
              }
              chips={[
                `${overdueIssuedInvoiceCount} overdue invoices`,
                `${expiredGraceCount} expired grace`,
              ]}
              intent="admin-subscription-billing:sweep"
              noteLabel="Sweep note"
              noteDefault="Operator billing sweep"
              actionLabel="Run sweep"
              actionIcon={<SyncRounded />}
            />
            <BillingOperationCard
              icon={<CreditCardRounded />}
              title="Recurring charges"
              helper="Charge due recurring subscriptions through saved Paystack authorizations."
              tone={recurringBlockedCount ? tokens.warning : tokens.success}
              chips={[
                `${recurringDueRows.length} due`,
                `${recurringReadyRows.length} ready`,
                `${recurringBlockedCount} blocked`,
              ]}
              intent="admin-subscription-recurring:sweep"
              noteLabel="Charge note"
              noteDefault="Operator recurring charge sweep"
              actionLabel="Run charges"
              actionIcon={<CreditCardRounded />}
            />
          </Box>
        </Stack>
      </Panel>

      <Stack spacing={1}>
        <Typography variant="h6">Package controls</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Define the packages businesses can be assigned to. Archive old
          packages instead of deleting them so existing businesses keep their
          history.
        </Typography>
      </Stack>
      {plansError ? <Alert severity="warning">{plansError}</Alert> : null}
      {!plansError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Form method="post">
            <input type="hidden" name="intent" value="admin-plan:create" />
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Typography variant="h6">Create package</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Add a package definition for future business assignments.
                  </Typography>
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<WorkspacePremiumRounded />}
                  sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                >
                  Create package
                </Button>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                    xl: "1fr 1.3fr repeat(3, minmax(120px, 0.8fr))",
                  },
                }}
              >
                <TextField
                  label="Code"
                  name="code"
                  placeholder="pro-plus"
                  size="small"
                  required
                />
                <TextField
                  label="Name"
                  name="name"
                  placeholder="Pro Plus"
                  size="small"
                  required
                />
                <TextField
                  label="Monthly fee"
                  name="monthly_fee_ghs"
                  type="number"
                  size="small"
                  defaultValue="0.00"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">GHS</InputAdornment>
                      ),
                    },
                    htmlInput: { min: 0, step: "0.01" },
                  }}
                />
                <TextField
                  label="Commission"
                  name="commission_bps"
                  type="number"
                  size="small"
                  defaultValue="100"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">bps</InputAdornment>
                      ),
                    },
                    htmlInput: { min: 0, max: 10000, step: 1 },
                  }}
                />
                <TextField
                  label="Design limit"
                  name="design_limit"
                  type="number"
                  size="small"
                  placeholder="Unlimited"
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              </Box>
            </Stack>
          </Form>
        </Panel>
      ) : null}
      {!plansError && plans.length === 0 ? (
        <Alert severity="info">
          No editable plan packages are available yet; showing the default
          package model below.
        </Alert>
      ) : null}
      {!plansError && plans.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {plans.map((plan) => {
            const visual = planVisualFor(plan.code);
            return (
              <Panel
                key={plan.planId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(visual.tone, plan.isActive ? 0.2 : 0.12),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    visual.tone,
                    plan.isActive ? 0.075 : 0.035,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" noWrap>
                        {plan.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {plan.businessCount} businesses ·{" "}
                        {plan.activeSubscriptionCount} active subscriptions
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={plan.isActive ? "Active" : "Archived"}
                      color={plan.isActive ? "success" : "default"}
                      variant={plan.isActive ? "filled" : "outlined"}
                    />
                  </Stack>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-plan:update"
                    />
                    <input type="hidden" name="plan_id" value={plan.planId} />
                    <Stack spacing={1.25}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.25,
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                          },
                        }}
                      >
                        <TextField
                          label="Name"
                          name="name"
                          size="small"
                          defaultValue={plan.name}
                          required
                        />
                        <TextField
                          label="Code"
                          size="small"
                          defaultValue={plan.code}
                          disabled
                        />
                        <TextField
                          label="Monthly fee"
                          name="monthly_fee_ghs"
                          type="number"
                          size="small"
                          defaultValue={planMonthlyFeeDefault(plan)}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  GHS
                                </InputAdornment>
                              ),
                            },
                            htmlInput: { min: 0, step: "0.01" },
                          }}
                        />
                        <TextField
                          label="Commission"
                          name="commission_bps"
                          type="number"
                          size="small"
                          defaultValue={plan.commissionBps}
                          slotProps={{
                            input: {
                              endAdornment: (
                                <InputAdornment position="end">
                                  bps
                                </InputAdornment>
                              ),
                            },
                            htmlInput: { min: 0, max: 10000, step: 1 },
                          }}
                        />
                        <TextField
                          label="Design limit"
                          name="design_limit"
                          type="number"
                          size="small"
                          defaultValue={plan.designLimit ?? ""}
                          placeholder="Unlimited"
                          slotProps={{ htmlInput: { min: 0, step: 1 } }}
                        />
                        <TextField
                          select
                          label="Status"
                          name="is_active"
                          size="small"
                          defaultValue={String(plan.isActive)}
                        >
                          <MenuItem value="true">Active</MenuItem>
                          <MenuItem value="false">Archived</MenuItem>
                        </TextField>
                      </Box>
                      <Button type="submit" variant="outlined">
                        Save package
                      </Button>
                    </Stack>
                  </Form>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-plan:archive"
                    />
                    <input type="hidden" name="plan_id" value={plan.planId} />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Archive reason"
                        name="reason"
                        size="small"
                        placeholder="Replaced by new package"
                        fullWidth
                        disabled={!plan.isActive}
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        color="warning"
                        disabled={!plan.isActive}
                        sx={{ minWidth: { sm: 140 } }}
                      >
                        Archive
                      </Button>
                    </Stack>
                  </Form>
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        {planRows.map((row) => (
          <SubscriptionPlanSummaryCard key={row.plan.code} row={row} />
        ))}
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 340px" },
          alignItems: "start",
        }}
      >
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="h6">Lifecycle queue</Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  Review billing state, mode, next collection, and operator
                  notes.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                onClick={() => onSelect("businesses")}
                sx={{ whiteSpace: "nowrap" }}
              >
                Open businesses
              </Button>
            </Stack>
            {attentionRows.length === 0 && subscriptions.length > 0 ? (
              <Alert severity="info">
                No subscription lifecycle rows need attention right now; showing
                active records.
              </Alert>
            ) : null}
            {subscriptions.length === 0 ? (
              <Alert severity="info">
                No subscriptions are ready to manage yet.
              </Alert>
            ) : null}
            {lifecycleRows.map((subscription) => {
              const color = subscriptionStatusColor(subscription.status);
              const openInvoice = subscription.invoices.find(
                (invoice) => invoice.status === "issued",
              );
              const latestInvoice = subscription.invoices[0];
              const canIssueInvoice =
                subscription.monthlyFeeMinor > 0 &&
                subscription.status !== "canceled" &&
                !openInvoice;
              const canCaptureAuthorization =
                subscription.monthlyFeeMinor > 0 &&
                subscription.status !== "canceled";
              return (
                <Box
                  key={subscription.businessId}
                  sx={{
                    p: { xs: 1.5, md: 2 },
                    border: "1px solid",
                    borderColor: alpha(color, 0.18),
                    borderRadius: 2,
                    bgcolor: alpha(tokens.white, 0.82),
                    backgroundImage: `
                      linear-gradient(90deg, ${alpha(color, 0.08)}, transparent 34%),
                      linear-gradient(180deg, ${alpha(tokens.white, 0.96)}, ${alpha(tokens.panel, 0.62)})
                    `,
                    boxShadow: `0 16px 40px ${alpha(tokens.ink, 0.045)}`,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{
                      alignItems: { sm: "flex-start" },
                      justifyContent: "space-between",
                    }}
                  >
                      <Box sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", flexWrap: "wrap" }}
                        >
                          <Typography sx={{ fontWeight: 900 }}>
                            {subscription.businessName}
                          </Typography>
                          <Chip
                            size="small"
                            label={subscription.planName}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={subscriptionStatusLabel(subscription.status)}
                            sx={{
                              bgcolor: alpha(color, 0.11),
                              color,
                              textTransform: "capitalize",
                            }}
                          />
                          {typeof subscription.designLimit === "number" &&
                          subscription.designCount >
                            subscription.designLimit ? (
                            <Chip
                              size="small"
                              label="Over limit"
                              color="warning"
                              variant="outlined"
                            />
                          ) : null}
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.65, color: "text.secondary" }}
                        >
                          {subscription.handle}.xtiitch.com ·{" "}
                          {formatGHS(subscription.gmvMinor)} GMV ·{" "}
                          {formatGHS(subscription.monthlyFeeMinor)} monthly fee
                        </Typography>
                        <Typography sx={{ mt: 0.75 }}>
                          {billingModeLabel(subscription.billingMode)} billing ·{" "}
                          {subscription.nextBillingAt
                            ? `Next billing ${shortTime(subscription.nextBillingAt)}`
                            : "No scheduled billing date"}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 0.55,
                            color:
                              typeof subscription.designLimit === "number" &&
                              subscription.designCount >
                                subscription.designLimit
                                ? tokens.warning
                                : "text.secondary",
                          }}
                        >
                          {subscriptionDesignUsageLabel(subscription)}
                        </Typography>
                      </Box>
                    <Button
                      variant="contained"
                      startIcon={<SettingsRounded />}
                      onClick={() => setManageBusinessId(subscription.businessId)}
                      sx={{
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        alignSelf: { xs: "stretch", sm: "flex-start" },
                      }}
                    >
                      Manage billing
                    </Button>
                  </Stack>
                  <Dialog
                    open={manageBusinessId === subscription.businessId}
                    onClose={() => setManageBusinessId(null)}
                    fullWidth
                    maxWidth="md"
                  >
                    <DialogTitle sx={{ pb: 0.5 }}>
                      <Typography
                        component="span"
                        sx={{ display: "block", fontWeight: 900, fontSize: 18 }}
                      >
                        {subscription.businessName}
                      </Typography>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ display: "block", color: "text.secondary" }}
                      >
                        {subscription.planName} ·{" "}
                        {billingModeLabel(subscription.billingMode)} billing ·{" "}
                        {subscription.handle}.xtiitch.com
                      </Typography>
                    </DialogTitle>
                    <DialogContent dividers>
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-subscription:update"
                        />
                        <input
                          type="hidden"
                          name="business_id"
                          value={subscription.businessId}
                        />
                        <Stack spacing={1.5}>
                      <FormGroupLabel>Billing state</FormGroupLabel>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, minmax(0, 1fr))",
                            xl: "150px 160px minmax(220px, 1fr) auto",
                          },
                          alignItems: "center",
                        }}
                      >
                        <TextField
                          select
                          size="small"
                          label="Status"
                          name="status"
                          defaultValue={subscription.status}
                        >
                          {subscriptionStatusOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          size="small"
                          label="Mode"
                          name="billing_mode"
                          defaultValue={subscription.billingMode}
                        >
                          {subscriptionBillingModeOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          size="small"
                          label="Reason"
                          name="reason"
                          defaultValue=""
                          placeholder="Operator note"
                        />
                        <Button
                          type="submit"
                          variant="contained"
                          sx={{
                            height: 44,
                            minWidth: { xl: 104 },
                            justifySelf: { xs: "stretch", xl: "end" },
                            whiteSpace: "nowrap",
                          }}
                        >
                          Save
                        </Button>
                      </Box>
                    </Stack>
                    <Box
                      sx={{
                        mt: 1.25,
                        display: "grid",
                        gap: 1,
                        gridTemplateColumns: {
                          xs: "1fr",
                          md: "repeat(2, minmax(0, 1fr))",
                        },
                      }}
                    >
                      <TextField
                        size="small"
                        label="Paystack customer ref"
                        name="provider_customer_ref"
                        defaultValue={subscription.providerCustomerRef}
                        placeholder="CUS_..."
                      />
                      <TextField
                        size="small"
                        label="Paystack auth/subscription ref"
                        name="provider_subscription_ref"
                        defaultValue={subscription.providerSubscriptionRef}
                        placeholder="AUTH_... or SUB_..."
                      />
                    </Box>
                  </Form>

                  {canCaptureAuthorization ? (
                    <Box
                      component="details"
                      sx={{
                        mt: 1.25,
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: alpha(tokens.ink, 0.1),
                        bgcolor: alpha(tokens.panel, 0.4),
                        p: 1.25,
                        "& > summary": {
                          cursor: "pointer",
                          listStyle: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          "&::-webkit-details-marker": { display: "none" },
                        },
                        "&[open] > summary": { mb: 1.25 },
                      }}
                    >
                      <Box component="summary">
                        <Box
                          component="span"
                          sx={{
                            fontWeight: 900,
                            fontSize: 13,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: alpha(tokens.ink, 0.6),
                          }}
                        >
                          Recurring authorization
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: alpha(tokens.burgundy, 0.85),
                          }}
                        >
                          Manage
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: {
                            xs: "1fr",
                            xl: "repeat(2, minmax(0, 1fr))",
                          },
                        }}
                      >
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-subscription-authorization:init"
                        />
                        <input
                          type="hidden"
                          name="business_id"
                          value={subscription.businessId}
                        />
                        <Box
                          sx={{
                            display: "grid",
                            gap: 1,
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "minmax(220px, 1fr) minmax(220px, 1fr) max-content",
                            },
                            alignItems: "center",
                          }}
                        >
                          <TextField
                            size="small"
                            name="callback_url"
                            label="Callback URL"
                            placeholder="https://admin.xtiitch.com/admin?section=subscriptions"
                            fullWidth
                          />
                          <TextField
                            size="small"
                            name="reason"
                            label="Link note"
                            defaultValue="Create recurring authorization link"
                            fullWidth
                          />
                          <Button
                            type="submit"
                            variant="outlined"
                            startIcon={<CreditCardRounded />}
                            sx={{
                              height: 44,
                              minWidth: { md: 148 },
                              justifySelf: { xs: "stretch", md: "end" },
                              whiteSpace: "nowrap",
                            }}
                          >
                            Create auth
                          </Button>
                        </Box>
                      </Form>
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-subscription-authorization:verify"
                        />
                        <input
                          type="hidden"
                          name="business_id"
                          value={subscription.businessId}
                        />
                        <Box
                          sx={{
                            display: "grid",
                            gap: 1,
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "minmax(220px, 1fr) minmax(220px, 1fr) max-content",
                            },
                            alignItems: "center",
                          }}
                        >
                          <TextField
                            size="small"
                            name="reference"
                            label="Paystack reference"
                            placeholder="authorization reference"
                            fullWidth
                          />
                          <TextField
                            size="small"
                            name="reason"
                            label="Verify note"
                            defaultValue="Verify recurring authorization"
                            fullWidth
                          />
                          <Button
                            type="submit"
                            variant="outlined"
                            color="success"
                            startIcon={<CheckCircleRounded />}
                            sx={{
                              height: 44,
                              minWidth: { md: 136 },
                              justifySelf: { xs: "stretch", md: "end" },
                              whiteSpace: "nowrap",
                            }}
                          >
                            Verify auth
                          </Button>
                        </Box>
                      </Form>
                      </Box>
                    </Box>
                  ) : null}

                  <Divider sx={{ my: 1.5 }} />
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1}
                      sx={{
                        justifyContent: "space-between",
                        alignItems: { md: "center" },
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>
                          Invoice control
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {latestInvoice
                            ? `${latestInvoice.invoiceRef} · ${invoiceStatusLabel(
                                latestInvoice.status,
                              )} · ${formatGHS(latestInvoice.amountMinor)}`
                            : "No package invoice has been issued yet."}
                        </Typography>
                      </Box>
                      {latestInvoice ? (
                        <Chip
                          size="small"
                          label={`Due ${shortTime(latestInvoice.dueAt)}`}
                          color={
                            latestInvoice.status === "issued"
                              ? "warning"
                              : latestInvoice.status === "paid"
                                ? "success"
                                : "default"
                          }
                          variant={
                            latestInvoice.status === "paid"
                              ? "filled"
                              : "outlined"
                          }
                          sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                        />
                      ) : null}
                    </Stack>

                    {openInvoice ? (
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: {
                            xs: "1fr",
                            lg: "repeat(2, minmax(0, 1fr))",
                          },
                        }}
                      >
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="admin-subscription-invoice:paid"
                          />
                          <input
                            type="hidden"
                            name="invoice_id"
                            value={openInvoice.invoiceId}
                          />
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1,
                              gridTemplateColumns: {
                                xs: "1fr",
                                sm: "minmax(0, 1fr) auto",
                              },
                              alignItems: "center",
                            }}
                          >
                            <TextField
                              size="small"
                              name="reason"
                              label="Paid note"
                              placeholder="Paystack payment confirmed"
                              fullWidth
                            />
                            <Button
                              type="submit"
                              variant="outlined"
                              color="success"
                              sx={{
                                height: 44,
                                minWidth: { sm: 130 },
                                justifySelf: { xs: "stretch", sm: "end" },
                                whiteSpace: "nowrap",
                              }}
                            >
                              Mark paid
                            </Button>
                          </Box>
                        </Form>
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="admin-subscription-invoice:failed"
                          />
                          <input
                            type="hidden"
                            name="invoice_id"
                            value={openInvoice.invoiceId}
                          />
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1,
                              gridTemplateColumns: {
                                xs: "1fr",
                                sm: "minmax(0, 1fr) auto",
                              },
                              alignItems: "center",
                            }}
                          >
                            <TextField
                              size="small"
                              name="reason"
                              label="Failure note"
                              placeholder="Card failed or link expired"
                              fullWidth
                            />
                            <Button
                              type="submit"
                              variant="outlined"
                              color="warning"
                              sx={{
                                height: 44,
                                minWidth: { sm: 130 },
                                justifySelf: { xs: "stretch", sm: "end" },
                                whiteSpace: "nowrap",
                              }}
                            >
                              Mark failed
                            </Button>
                          </Box>
                        </Form>
                      </Box>
                    ) : null}

                    {canIssueInvoice ? (
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-subscription-invoice:issue"
                        />
                        <input
                          type="hidden"
                          name="business_id"
                          value={subscription.businessId}
                        />
                        <Box
                          sx={{
                            display: "grid",
                            gap: 1,
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "repeat(2, minmax(0, 1fr))",
                            },
                          }}
                        >
                          <TextField
                            size="small"
                            name="provider_invoice_ref"
                            label="Provider ref"
                            placeholder="Paystack invoice/link id"
                          />
                          <TextField
                            size="small"
                            name="payment_url"
                            label="Payment link"
                            placeholder="https://paystack.com/pay/..."
                          />
                          <StyledDateTimeField
                            size="small"
                            name="due_at"
                            label="Due date"
                          />
                          <TextField
                            size="small"
                            name="reason"
                            label="Issue note"
                            placeholder="Monthly package billing"
                          />
                        </Box>
                        <Button
                          type="submit"
                          variant="outlined"
                          startIcon={<WorkspacePremiumRounded />}
                          sx={{
                            mt: 1,
                            alignSelf: "flex-start",
                            height: 44,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Issue invoice
                        </Button>
                      </Form>
                    ) : null}
                  </Stack>
                    </DialogContent>
                  </Dialog>
                </Box>
              );
            })}
          </Stack>
        </Panel>

        <Panel
          sx={{
            p: { xs: 2, md: 2.5 },
            borderColor: alpha(tokens.info, 0.18),
            backgroundImage: `
              radial-gradient(circle at 96% 0%, ${alpha(tokens.info, 0.14)}, transparent 35%),
              linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
            `,
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <WorkspacePremiumRounded sx={{ color: tokens.burgundy }} />
              <Box>
                <Typography variant="h6">Subscription events</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Latest operator lifecycle changes.
                </Typography>
              </Box>
            </Stack>
            <Divider />
            {recentEvents.length === 0 ? (
              <Alert severity="info">
                No lifecycle events have been recorded yet.
              </Alert>
            ) : null}
            {recentEvents.map((event) => (
              <Box
                key={event.id}
                sx={{
                  p: 1.3,
                  border: "1px solid",
                  borderColor: alpha(tokens.ink, 0.08),
                  borderRadius: 1.5,
                  bgcolor: alpha(tokens.white, 0.7),
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  {event.businessName}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {event.summary}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
                >
                  {shortTime(event.createdAt)} · {event.actorEmail || "System"}
                </Typography>
              </Box>
            ))}
            <Button
              variant="outlined"
              endIcon={<ArrowForwardRounded />}
              onClick={() => onSelect("money")}
              sx={{ whiteSpace: "nowrap" }}
            >
              Review money rails
            </Button>
          </Stack>
        </Panel>
      </Box>
    </Stack>
  );
}

function SubscriptionPlanSummaryCard({
  row,
}: {
  row: {
    plan: AdminPlan;
    visual: { promise: string; tone: string };
    activeTotal: number;
    businessTotal: number;
    estimatedMrrMinor: number;
    gmvMinor: number;
    commissionMinor: number;
  };
}) {
  const monthlyFee =
    row.plan.monthlyFeeMinor > 0
      ? `${formatGHS(row.plan.monthlyFeeMinor)}`
      : "Free";
  const commissionRate = `${row.plan.commissionBps / 100}%`;

  return (
    <Panel
      sx={{
        p: { xs: 1.75, md: 2.25 },
        borderColor: alpha(row.visual.tone, row.plan.isActive ? 0.22 : 0.16),
        backgroundImage: `
          radial-gradient(circle at 96% 0%, ${alpha(row.visual.tone, row.plan.isActive ? 0.14 : 0.08)}, transparent 32%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.66)})
        `,
        opacity: row.plan.isActive ? 1 : 0.92,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              {row.plan.name}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.4, color: "text.secondary" }}
            >
              {row.visual.promise}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={
              row.plan.isActive ? row.plan.code : `${row.plan.code} archived`
            }
            sx={{
              textTransform: "capitalize",
              bgcolor: alpha(row.visual.tone, 0.12),
              color: row.visual.tone,
              fontWeight: 900,
              flexShrink: 0,
            }}
          />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
            gap: { xs: 1.5, sm: 2.5 },
            alignItems: "center",
            p: { xs: 1.5, md: 1.75 },
            borderRadius: 2,
            bgcolor: alpha(row.visual.tone, 0.06),
            border: "1px solid",
            borderColor: alpha(row.visual.tone, 0.14),
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontWeight: 800 }}
            >
              Package fee
            </Typography>
            <Typography
              variant="h4"
              sx={{ lineHeight: 1.05, fontWeight: 950 }}
            >
              {monthlyFee}
            </Typography>
            {row.plan.monthlyFeeMinor > 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                per month
              </Typography>
            ) : null}
          </Box>
          <Stack
            direction={{ xs: "row", sm: "column" }}
            spacing={{ xs: 2, sm: 0.5 }}
            sx={{
              alignItems: { xs: "center", sm: "flex-end" },
              textAlign: { xs: "left", sm: "right" },
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: 800 }}
              >
                Commission
              </Typography>
              <Typography
                sx={{
                  fontWeight: 950,
                  color: row.visual.tone,
                  lineHeight: 1.2,
                }}
              >
                {commissionRate}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: 800 }}
              >
                Base MRR
              </Typography>
              <Typography sx={{ fontWeight: 950, lineHeight: 1.2 }}>
                {formatGHS(row.estimatedMrrMinor)}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          <PlanStatTile
            label="Design limit"
            value={planDesignLimitLabel(row.plan)}
          />
          <PlanStatTile
            label="Businesses"
            value={`${row.activeTotal} active`}
            helper={`${row.businessTotal} total`}
          />
          <PlanStatTile
            label="GMV"
            value={formatGHS(row.gmvMinor)}
          />
          <PlanStatTile
            label="Commission earned"
            value={formatGHS(row.commissionMinor)}
          />
        </Box>

        <Typography
          variant="body2"
          sx={{ color: "text.secondary", fontWeight: 800 }}
        >
          {row.businessTotal
            ? `${row.businessTotal} businesses are currently mapped to this package.`
            : "No businesses are currently mapped to this package."}
        </Typography>
      </Stack>
    </Panel>
  );
}

function PlanStatTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 800 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{ fontWeight: 950, overflowWrap: "anywhere", lineHeight: 1.2 }}
      >
        {value}
      </Typography>
      {helper ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {helper}
        </Typography>
      ) : null}
    </Box>
  );
}

function PromotionsSection({
  promotions,
  promotionsError,
  businesses,
  actionData,
}: {
  promotions: AdminPromotion[];
  promotionsError: string | null;
  businesses: AdminBusiness[];
  actionData?: AdminActionFeedback;
}) {
  const activePromotions = promotions.filter(
    (promotion) => promotion.status === "active",
  );
  const platformWidePromotions = promotions.filter(
    (promotion) => !promotion.businessId,
  );
  const targetedPromotions = promotions.filter(
    (promotion) => promotion.businessId,
  );
  const redeemedMinor = promotions.reduce(
    (total, promotion) => total + promotion.discountRedeemedMinor,
    0,
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);
  const filteredPromotions = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return promotions.filter((promotion) => {
      const matchesStatus =
        statusFilter === "all" || promotion.status === statusFilter;
      const matchesScope =
        scopeFilter === "all" || promotion.scope === scopeFilter;
      const searchable = [
        promotion.title,
        promotion.code,
        promotion.status,
        promotion.scope,
        promotion.fundingSource,
        promotionTargetLabel(promotion),
        promotionDiscountLabel(promotion),
        promotionScopeTargetLabel(promotion),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesScope &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [promotions, query, scopeFilter, statusFilter]);
  const selectedPromotion =
    promotions.find((promotion) => promotion.promotionId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Promotions"
        helper="Voucher rules, funding ownership, redemption caps, and business-targeted offers."
      />

      {actionData?.section === "promotions" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {promotionsError ? (
        <Alert severity="warning">{promotionsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MetricCard
          label="Active offers"
          value={String(activePromotions.length)}
          helper={`${promotions.length} total promotion rules`}
          trend="Live"
        />
        <MetricCard
          label="Platform-wide"
          value={String(platformWidePromotions.length)}
          helper="Global voucher coverage"
          trend="All stores"
        />
        <MetricCard
          label="Targeted stores"
          value={String(targetedPromotions.length)}
          helper="Business-specific offers"
          trend={`${businesses.length} tenants`}
        />
        <MetricCard
          label="Redeemed discount"
          value={formatGHS(redeemedMinor)}
          helper="Recorded voucher value"
          trend={`${promotions.reduce((total, promotion) => total + promotion.redemptionCount, 0)} uses`}
        />
      </Box>

      {!promotionsError ? (
        <Panel sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(140px, 0.35fr)) auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search promotions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Status"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All statuses</MenuItem>
              {promotionStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Scope"
              select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All scopes</MenuItem>
              {promotionScopeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<LocalOfferRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New promotion
            </Button>
          </Box>
        </Panel>
      ) : null}

      {!promotionsError && promotions.length === 0 ? (
        <Alert severity="info">
          No promotion rules are configured yet. Create the first voucher from
          New promotion.
        </Alert>
      ) : null}

      {!promotionsError &&
      promotions.length > 0 &&
      filteredPromotions.length === 0 ? (
        <Alert severity="info">
          No promotions match the current search and filters.
        </Alert>
      ) : null}

      {!promotionsError && filteredPromotions.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            alignItems: "start",
          }}
        >
          {filteredPromotions.map((promotion) => {
            const archived = promotion.status === "archived";
            const color = promotionStatusColor(promotion.status);

            return (
              <Panel
                key={promotion.promotionId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(color, archived ? 0.12 : 0.2),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    color,
                    archived ? 0.035 : 0.075,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "flex-start" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">{promotion.title}</Typography>
                        {promotion.code ? (
                          <Chip size="small" label={promotion.code} />
                        ) : (
                          <Chip size="small" label="Auto code" />
                        )}
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {promotionTargetLabel(promotion)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={promotion.status}
                      sx={{
                        bgcolor: alpha(color, 0.12),
                        color,
                        fontWeight: 900,
                        textTransform: "capitalize",
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    }}
                  >
                    <DetailLine
                      label="Discount"
                      value={promotionDiscountLabel(promotion)}
                    />
                    <DetailLine
                      label="Cap"
                      value={
                        typeof promotion.maxDiscountMinor === "number"
                          ? formatGHS(promotion.maxDiscountMinor)
                          : "No cap"
                      }
                    />
                    <DetailLine
                      label="Minimum spend"
                      value={formatGHS(promotion.minSpendMinor)}
                    />
                    <DetailLine
                      label="Redemptions"
                      value={`${promotion.redemptionCount} uses · ${formatGHS(
                        promotion.discountRedeemedMinor,
                      )}`}
                    />
                    <DetailLine
                      label="Limits"
                      value={`Global ${
                        promotion.usageLimitGlobal ?? "unlimited"
                      } · Customer ${
                        promotion.usageLimitPerCustomer ?? "unlimited"
                      }`}
                    />
                    <DetailLine
                      label="Funding"
                      value={`${promotion.fundingSource} · ${promotionScopeTargetLabel(
                        promotion,
                      )}`}
                    />
                    <DetailLine
                      label="Starts"
                      value={
                        promotion.startsAt
                          ? shortTime(promotion.startsAt)
                          : "Now"
                      }
                    />
                    <DetailLine
                      label="Ends"
                      value={
                        promotion.endsAt ? shortTime(promotion.endsAt) : "Open"
                      }
                    />
                  </Box>

                  <Button
                    variant="outlined"
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => setDetailID(promotion.promotionId)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    View details
                  </Button>
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create promotion</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Add a platform-wide voucher or tie the offer to one store.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <AdminPromotionCreateForm businesses={businesses} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedPromotion)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">
                {selectedPromotion?.title ?? "Promotion details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Review redemptions, edit rules, or archive this promotion.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPromotion ? (
            <AdminPromotionDetailForm
              promotion={selectedPromotion}
              businesses={businesses}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

function AdminPromotionCreateForm({
  businesses,
}: {
  businesses: AdminBusiness[];
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-promotion:create" />
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              xl: "1.1fr 1fr 1.4fr repeat(3, minmax(120px, 0.85fr))",
            },
          }}
        >
          <TextField
            select
            label="Target"
            name="business_id"
            size="small"
            defaultValue=""
          >
            <MenuItem value="">Platform-wide</MenuItem>
            {businesses.map((business) => (
              <MenuItem key={business.id} value={business.id}>
                {business.name} · {business.handle}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Code"
            name="code"
            placeholder="WELCOME10"
            size="small"
          />
          <TextField label="Title" name="title" size="small" required />
          <TextField
            select
            label="Discount"
            name="discount_type"
            size="small"
            defaultValue="percentage"
          >
            {promotionDiscountTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Value"
            name="discount_value"
            type="number"
            size="small"
            defaultValue="10"
            slotProps={{
              htmlInput: { min: 0, step: "0.01" },
            }}
          />
          <TextField
            label="Max cap"
            name="max_discount_ghs"
            type="number"
            size="small"
            defaultValue="50.00"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { min: 0, step: "0.01" },
            }}
          />
          <TextField
            label="Minimum spend"
            name="min_spend_ghs"
            type="number"
            size="small"
            defaultValue="0.00"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { min: 0, step: "0.01" },
            }}
          />
          <TextField
            select
            label="Funding"
            name="funding_source"
            size="small"
            defaultValue="business"
          >
            {promotionFundingSourceOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Scope"
            name="scope"
            size="small"
            defaultValue="store"
          >
            {promotionScopeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Collection ID"
            name="target_collection_id"
            size="small"
          />
          <TextField label="Design ID" name="target_design_id" size="small" />
          <TextField
            select
            label="Status"
            name="status"
            size="small"
            defaultValue="active"
          >
            {promotionStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Global limit"
            name="usage_limit_global"
            type="number"
            size="small"
            placeholder="Unlimited"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <TextField
            label="Per-customer limit"
            name="usage_limit_per_customer"
            type="number"
            size="small"
            placeholder="Unlimited"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <StyledDateTimeField label="Starts" name="starts_at" size="small" />
          <StyledDateTimeField label="Ends" name="ends_at" size="small" />
        </Box>
        <TextField
          label="Description"
          name="description"
          multiline
          minRows={2}
          size="small"
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={<LocalOfferRounded />}
          sx={{ alignSelf: "flex-start" }}
        >
          Create promotion
        </Button>
      </Stack>
    </Form>
  );
}

function AdminPromotionDetailForm({
  promotion,
  businesses,
}: {
  promotion: AdminPromotion;
  businesses: AdminBusiness[];
}) {
  const archived = promotion.status === "archived";

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
        }}
      >
        <DetailLine
          label="Discount"
          value={promotionDiscountLabel(promotion)}
        />
        <DetailLine
          label="Cap"
          value={
            typeof promotion.maxDiscountMinor === "number"
              ? formatGHS(promotion.maxDiscountMinor)
              : "No cap"
          }
        />
        <DetailLine
          label="Minimum spend"
          value={formatGHS(promotion.minSpendMinor)}
        />
        <DetailLine
          label="Redemptions"
          value={`${promotion.redemptionCount} uses · ${formatGHS(
            promotion.discountRedeemedMinor,
          )}`}
        />
        <DetailLine
          label="Limits"
          value={`Global ${
            promotion.usageLimitGlobal ?? "unlimited"
          } · Customer ${promotion.usageLimitPerCustomer ?? "unlimited"}`}
        />
        <DetailLine
          label="Funding"
          value={`${promotion.fundingSource} · ${promotionScopeTargetLabel(
            promotion,
          )}`}
        />
        <DetailLine
          label="Starts"
          value={promotion.startsAt ? shortTime(promotion.startsAt) : "Now"}
        />
        <DetailLine
          label="Ends"
          value={promotion.endsAt ? shortTime(promotion.endsAt) : "Open"}
        />
      </Box>

      {promotion.recentRedemptions.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          }}
        >
          {promotion.recentRedemptions.map((redemption) => (
            <Box
              key={redemption.promotionRedemptionId}
              sx={{
                p: 1.1,
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                borderRadius: 1,
                bgcolor: alpha(tokens.white, 0.7),
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Chip
                  size="small"
                  label={redemption.status}
                  color={
                    redemption.status === "applied"
                      ? "success"
                      : redemption.status === "pending"
                        ? "warning"
                        : "default"
                  }
                  variant="outlined"
                  sx={{ textTransform: "capitalize" }}
                />
                <Typography sx={{ fontWeight: 900 }}>
                  {formatGHS(redemption.discountMinor)}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.75,
                  color: "text.secondary",
                  overflowWrap: "anywhere",
                }}
              >
                {redemption.customerName ||
                  (redemption.customerId
                    ? `Customer ${shortID(redemption.customerId)}`
                    : "Unknown customer")}
                {" · "}
                {redemption.orderId
                  ? `Order ${shortID(redemption.orderId)}`
                  : "No order linked"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
              >
                {shortTime(redemption.redeemedAt ?? redemption.createdAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info">No recent redemptions have been recorded.</Alert>
      )}

      {archived ? (
        <Alert severity="info">
          Archived promotions stay visible for reporting and cannot be edited.
        </Alert>
      ) : null}

      <Form method="post">
        <input type="hidden" name="intent" value="admin-promotion:update" />
        <input
          type="hidden"
          name="promotion_id"
          value={promotion.promotionId}
        />
        <Stack spacing={1.25}>
          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            <TextField
              select
              label="Target"
              name="business_id"
              size="small"
              defaultValue={promotion.businessId ?? ""}
              disabled={archived}
            >
              <MenuItem value="">Platform-wide</MenuItem>
              {promotion.businessId &&
              !businesses.some(
                (business) => business.id === promotion.businessId,
              ) ? (
                <MenuItem value={promotion.businessId}>
                  {promotionTargetLabel(promotion)}
                </MenuItem>
              ) : null}
              {businesses.map((business) => (
                <MenuItem key={business.id} value={business.id}>
                  {business.name} · {business.handle}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Code"
              name="code"
              size="small"
              defaultValue={promotion.code}
              disabled={archived}
            />
            <TextField
              label="Title"
              name="title"
              size="small"
              defaultValue={promotion.title}
              required
              disabled={archived}
            />
            <TextField
              select
              label="Status"
              name="status"
              size="small"
              defaultValue={
                promotion.status === "archived" ? "paused" : promotion.status
              }
              disabled={archived}
            >
              {promotionStatusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Discount"
              name="discount_type"
              size="small"
              defaultValue={promotion.discountType}
              disabled={archived}
            >
              {promotionDiscountTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Value"
              name="discount_value"
              type="number"
              size="small"
              defaultValue={promotionValueDefault(promotion)}
              disabled={archived}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />
            <TextField
              label="Max cap"
              name="max_discount_ghs"
              type="number"
              size="small"
              defaultValue={moneyInputDefault(promotion.maxDiscountMinor)}
              disabled={archived}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">GHS</InputAdornment>
                  ),
                },
                htmlInput: { min: 0, step: "0.01" },
              }}
            />
            <TextField
              label="Minimum spend"
              name="min_spend_ghs"
              type="number"
              size="small"
              defaultValue={moneyInputDefault(promotion.minSpendMinor)}
              disabled={archived}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">GHS</InputAdornment>
                  ),
                },
                htmlInput: { min: 0, step: "0.01" },
              }}
            />
            <TextField
              select
              label="Funding"
              name="funding_source"
              size="small"
              defaultValue={promotion.fundingSource}
              disabled={archived}
            >
              {promotionFundingSourceOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Scope"
              name="scope"
              size="small"
              defaultValue={promotion.scope}
              disabled={archived}
            >
              {promotionScopeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Collection ID"
              name="target_collection_id"
              size="small"
              defaultValue={promotion.targetCollectionId ?? ""}
              disabled={archived}
            />
            <TextField
              label="Design ID"
              name="target_design_id"
              size="small"
              defaultValue={promotion.targetDesignId ?? ""}
              disabled={archived}
            />
            <TextField
              label="Global limit"
              name="usage_limit_global"
              type="number"
              size="small"
              defaultValue={promotion.usageLimitGlobal ?? ""}
              placeholder="Unlimited"
              disabled={archived}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
            />
            <TextField
              label="Per-customer limit"
              name="usage_limit_per_customer"
              type="number"
              size="small"
              defaultValue={promotion.usageLimitPerCustomer ?? ""}
              placeholder="Unlimited"
              disabled={archived}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
            />
            <StyledDateTimeField
              label="Starts"
              name="starts_at"
              size="small"
              defaultValue={datetimeLocalDefault(promotion.startsAt)}
              disabled={archived}
            />
            <StyledDateTimeField
              label="Ends"
              name="ends_at"
              size="small"
              defaultValue={datetimeLocalDefault(promotion.endsAt)}
              disabled={archived}
            />
          </Box>
          <TextField
            label="Description"
            name="description"
            multiline
            minRows={2}
            size="small"
            defaultValue={promotion.description}
            disabled={archived}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={archived}
            sx={{ alignSelf: "flex-start" }}
          >
            Save promotion
          </Button>
        </Stack>
      </Form>

      <Form method="post">
        <input type="hidden" name="intent" value="admin-promotion:archive" />
        <input
          type="hidden"
          name="promotion_id"
          value={promotion.promotionId}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            label="Archive reason"
            name="reason"
            size="small"
            placeholder="Campaign ended"
            fullWidth
            disabled={archived}
          />
          <Button
            type="submit"
            variant="outlined"
            color="warning"
            disabled={archived}
            sx={{ minWidth: { sm: 140 } }}
          >
            Archive
          </Button>
        </Stack>
      </Form>
    </Stack>
  );
}

function AdsSection({
  campaigns,
  adCampaignsError,
  businesses,
  actionData,
}: {
  campaigns: AdminAdCampaign[];
  adCampaignsError: string | null;
  businesses: AdminBusiness[];
  actionData?: AdminActionFeedback;
}) {
  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const eligibleBusinesses = businesses.filter(
    (business) =>
      business.verificationStatus === "verified" &&
      business.operationalStatus === "active",
  );
  const pendingCampaigns = campaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "active",
  );
  const completedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "completed",
  );
  const bookedMinor = campaigns.reduce(
    (total, campaign) => total + campaign.budgetMinor,
    0,
  );
  const collectedMinor = campaigns.reduce(
    (total, campaign) =>
      total +
      campaign.payments.reduce(
        (paymentTotal, payment) =>
          paymentTotal + (payment.status === "paid" ? payment.amountMinor : 0),
        0,
      ),
    0,
  );
  const openPaymentMinor = campaigns.reduce(
    (total, campaign) =>
      total +
      campaign.payments.reduce(
        (paymentTotal, payment) =>
          paymentTotal +
          (payment.status === "initiated" ? payment.amountMinor : 0),
        0,
      ),
    0,
  );
  const impressions = campaigns.reduce(
    (total, campaign) => total + campaign.impressionCount,
    0,
  );
  const clicks = campaigns.reduce(
    (total, campaign) => total + campaign.clickCount,
    0,
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Sponsored placements"
        helper="Review paid featured businesses, promoted designs, homepage slots, date windows, and prepaid budgets."
      />

      {actionData?.section === "ads" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {adCampaignsError ? (
        <Alert severity="warning">{adCampaignsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Pending review"
          value={String(pendingCampaigns.length)}
          helper="Needs operator decision"
          trend={`${campaigns.length} total campaigns`}
        />
        <MetricCard
          label="Active placements"
          value={String(activeCampaigns.length)}
          helper="Visible inside active windows"
          trend={`${completedCampaigns.length} completed`}
        />
        <MetricCard
          label="Collected budget"
          value={formatGHS(collectedMinor)}
          helper={`${formatGHS(bookedMinor)} booked campaign value`}
          trend={
            openPaymentMinor > 0
              ? `${formatGHS(openPaymentMinor)} open`
              : "Paystack ready"
          }
        />
        <MetricCard
          label="Engagement"
          value={formatPercentBps(
            impressions > 0 ? (clicks / impressions) * 10000 : 0,
          )}
          helper={`${impressions} impressions · ${clicks} clicks`}
          trend="Server event rollup"
        />
      </Box>

      {!adCampaignsError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create placement</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Only verified active businesses can be selected.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<CampaignRounded />}
              disabled={eligibleBusinesses.length === 0}
              onClick={() => setAdDialogOpen(true)}
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            >
              New placement
            </Button>
          </Stack>
          {eligibleBusinesses.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              No verified active businesses are eligible for sponsored placement
              yet.
            </Alert>
          ) : null}
          <Dialog
            open={adDialogOpen}
            onClose={() => setAdDialogOpen(false)}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle>Create ad placement</DialogTitle>
            <DialogContent dividers>
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-ad-campaign:create"
                />
                <input type="hidden" name="pricing_model" value="flat_time" />
                <Stack spacing={2}>
                  <FormGroupLabel>Campaign</FormGroupLabel>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                    xl: "1.2fr 1fr 1fr 1fr",
                  },
                }}
              >
                <TextField
                  select
                  label="Business"
                  name="business_id"
                  size="small"
                  required
                  disabled={eligibleBusinesses.length === 0}
                  defaultValue={eligibleBusinesses[0]?.id ?? ""}
                >
                  {eligibleBusinesses.map((business) => (
                    <MenuItem key={business.id} value={business.id}>
                      {business.name} · {business.handle}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Placement"
                  name="placement_type"
                  size="small"
                  defaultValue="featured_business"
                >
                  {adPlacementOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Target ref"
                  name="target_ref_id"
                  size="small"
                  placeholder="Design ID when promoted design"
                />
                <TextField
                  select
                  label="Status"
                  name="status"
                  size="small"
                  defaultValue="pending_review"
                >
                  {adCampaignStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Headline"
                  name="headline"
                  size="small"
                  required
                />
              </Box>
              <FormGroupLabel>Budget &amp; schedule</FormGroupLabel>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    xl: "repeat(4, minmax(0, 1fr))",
                  },
                }}
              >
                <TextField
                  label="Budget"
                  name="budget_ghs"
                  type="number"
                  size="small"
                  defaultValue="0.00"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">GHS</InputAdornment>
                      ),
                    },
                    htmlInput: { min: 0, step: "0.01" },
                  }}
                />
                <TextField
                  label="Daily cap"
                  name="daily_cap_ghs"
                  type="number"
                  size="small"
                  placeholder="Optional"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">GHS</InputAdornment>
                      ),
                    },
                    htmlInput: { min: 0, step: "0.01" },
                  }}
                />
                <StyledDateTimeField
                  label="Starts"
                  name="starts_at"
                  size="small"
                  required
                />
                <StyledDateTimeField
                  label="Ends"
                  name="ends_at"
                  size="small"
                  required
                />
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                <TextField
                  label="Description"
                  name="description"
                  multiline
                  minRows={2}
                  size="small"
                />
                <TextField
                  label="Review note"
                  name="review_note"
                  multiline
                  minRows={2}
                  size="small"
                />
              </Box>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<CampaignRounded />}
                    disabled={eligibleBusinesses.length === 0}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Create placement
                  </Button>
                </Stack>
              </Form>
            </DialogContent>
          </Dialog>
        </Panel>
      ) : null}

      {!adCampaignsError && campaigns.length === 0 ? (
        <Alert severity="info">
          No sponsored placement campaigns are configured yet.
        </Alert>
      ) : null}

      {!adCampaignsError && campaigns.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            alignItems: "start",
          }}
        >
          {campaigns.map((campaign) => {
            const archived = campaign.status === "archived";
            const color = adCampaignStatusColor(campaign.status);
            const paidMinor = campaign.payments.reduce(
              (total, payment) =>
                total + (payment.status === "paid" ? payment.amountMinor : 0),
              0,
            );
            const dueMinor = Math.max(campaign.budgetMinor - paidMinor, 0);
            const openPayment = campaign.payments.find(
              (payment) => payment.status === "initiated",
            );
            const latestPayments = campaign.payments.slice(0, 3);
            return (
              <Panel
                key={campaign.campaignId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(color, archived ? 0.12 : 0.2),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    color,
                    archived ? 0.035 : 0.075,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "flex-start" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">
                          {campaign.headline}
                        </Typography>
                        <Chip
                          size="small"
                          label={adPlacementLabel(campaign.placementType)}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {campaign.businessName} · {campaign.businessHandle}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={adCampaignStatusLabel(campaign.status)}
                      sx={{
                        bgcolor: alpha(color, 0.12),
                        color,
                        fontWeight: 900,
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    }}
                  >
                    <DetailLine label="Target" value={campaign.targetLabel} />
                    <DetailLine
                      label="Budget"
                      value={`${formatGHS(paidMinor)} collected / ${formatGHS(
                        campaign.budgetMinor,
                      )} booked`}
                    />
                    <DetailLine
                      label="Daily cap"
                      value={
                        typeof campaign.dailyCapMinor === "number"
                          ? formatGHS(campaign.dailyCapMinor)
                          : "No cap"
                      }
                    />
                    <DetailLine
                      label="Window"
                      value={`${shortTime(campaign.startsAt)} - ${shortTime(
                        campaign.endsAt,
                      )}`}
                    />
                    <DetailLine
                      label="Impressions"
                      value={`${campaign.impressionCount} views`}
                    />
                    <DetailLine
                      label="Clicks"
                      value={`${campaign.clickCount} · ${formatPercentBps(
                        campaign.clickRateBps,
                      )}`}
                    />
                  </Box>

                  {campaign.description || campaign.reviewNote ? (
                    <Box
                      sx={{
                        p: 1.25,
                        border: "1px solid",
                        borderColor: alpha(tokens.ink, 0.08),
                        borderRadius: 1,
                        bgcolor: alpha(tokens.white, 0.7),
                      }}
                    >
                      {campaign.description ? (
                        <Typography sx={{ overflowWrap: "anywhere" }}>
                          {campaign.description}
                        </Typography>
                      ) : null}
                      {campaign.reviewNote ? (
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.5, color: "text.secondary" }}
                        >
                          Review: {campaign.reviewNote}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : null}

                  <Box
                    sx={{
                      p: 1.5,
                      border: "1px solid",
                      borderColor: alpha(
                        openPayment
                          ? tokens.warning
                          : dueMinor > 0
                            ? tokens.info
                            : tokens.success,
                        0.18,
                      ),
                      borderRadius: 1.5,
                      bgcolor: alpha(tokens.white, 0.72),
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{
                          alignItems: { xs: "flex-start", sm: "center" },
                          justifyContent: "space-between",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center" }}
                        >
                          <PaymentsRounded sx={{ color: tokens.burgundy }} />
                          <Box>
                            <Typography variant="subtitle1">
                              Payment collection
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                            >
                              {dueMinor > 0
                                ? `${formatGHS(dueMinor)} still due for this placement.`
                                : "Booked budget has been collected."}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ flexWrap: "wrap" }}
                        >
                          <Chip
                            size="small"
                            label={
                              openPayment
                                ? "Payment link open"
                                : dueMinor > 0
                                  ? "Awaiting collection"
                                  : "Paid"
                            }
                            sx={{
                              bgcolor: alpha(
                                openPayment
                                  ? tokens.warning
                                  : dueMinor > 0
                                    ? tokens.info
                                    : tokens.success,
                                0.12,
                              ),
                              color: openPayment
                                ? tokens.warning
                                : dueMinor > 0
                                  ? tokens.info
                                  : tokens.success,
                              fontWeight: 900,
                            }}
                          />
                          {openPayment?.paymentUrl ? (
                            <Button
                              component="a"
                              href={openPayment.paymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              size="small"
                              variant="outlined"
                              endIcon={<ArrowForwardRounded />}
                            >
                              Open link
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>

                      <Box
                        sx={{
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(3, 1fr)",
                          },
                        }}
                      >
                        <DetailLine
                          label="Collected"
                          value={formatGHS(paidMinor)}
                        />
                        <DetailLine label="Due" value={formatGHS(dueMinor)} />
                        <DetailLine
                          label="Open"
                          value={
                            openPayment
                              ? `${formatGHS(openPayment.amountMinor)} · ${openPayment.providerReference}`
                              : "No open link"
                          }
                        />
                      </Box>

                      {latestPayments.length > 0 ? (
                        <Stack spacing={0.75}>
                          {latestPayments.map((payment) => {
                            const paymentColor = adCampaignPaymentStatusColor(
                              payment.status,
                            );
                            return (
                              <Stack
                                key={payment.paymentId}
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                sx={{
                                  alignItems: {
                                    xs: "flex-start",
                                    sm: "center",
                                  },
                                  justifyContent: "space-between",
                                  p: 1,
                                  border: "1px solid",
                                  borderColor: alpha(tokens.ink, 0.08),
                                  borderRadius: 1,
                                  bgcolor: alpha(tokens.panel, 0.56),
                                }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 900,
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {payment.providerReference}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: "text.secondary" }}
                                  >
                                    {formatGHS(payment.amountMinor)} ·{" "}
                                    {shortTime(payment.updatedAt)}
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  label={payment.status}
                                  sx={{
                                    bgcolor: alpha(paymentColor, 0.12),
                                    color: paymentColor,
                                    fontWeight: 900,
                                    textTransform: "capitalize",
                                  }}
                                />
                              </Stack>
                            );
                          })}
                        </Stack>
                      ) : null}

                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-ad-campaign-payment:collect"
                        />
                        <input
                          type="hidden"
                          name="campaign_id"
                          value={campaign.campaignId}
                        />
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                        >
                          <TextField
                            label="Advertiser email"
                            name="customer_email"
                            size="small"
                            type="email"
                            placeholder="Defaults to business owner"
                            fullWidth
                            disabled={
                              archived || Boolean(openPayment) || dueMinor <= 0
                            }
                          />
                          <Button
                            type="submit"
                            variant="contained"
                            startIcon={<PaymentsRounded />}
                            disabled={
                              archived || Boolean(openPayment) || dueMinor <= 0
                            }
                            sx={{ minWidth: { sm: 170 } }}
                          >
                            Collect payment
                          </Button>
                        </Stack>
                      </Form>
                    </Stack>
                  </Box>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-ad-campaign:update"
                    />
                    <input
                      type="hidden"
                      name="campaign_id"
                      value={campaign.campaignId}
                    />
                    <input
                      type="hidden"
                      name="pricing_model"
                      value="flat_time"
                    />
                    <Stack spacing={1.25}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.25,
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                          },
                        }}
                      >
                        <TextField
                          select
                          label="Business"
                          name="business_id"
                          size="small"
                          defaultValue={campaign.businessId}
                          disabled={archived}
                        >
                          {!eligibleBusinesses.some(
                            (business) => business.id === campaign.businessId,
                          ) ? (
                            <MenuItem value={campaign.businessId}>
                              {campaign.businessName} ·{" "}
                              {campaign.businessHandle}
                            </MenuItem>
                          ) : null}
                          {eligibleBusinesses.map((business) => (
                            <MenuItem key={business.id} value={business.id}>
                              {business.name} · {business.handle}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Placement"
                          name="placement_type"
                          size="small"
                          defaultValue={campaign.placementType}
                          disabled={archived}
                        >
                          {adPlacementOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Target ref"
                          name="target_ref_id"
                          size="small"
                          defaultValue={campaign.targetRefId}
                          disabled={archived}
                        />
                        <TextField
                          select
                          label="Status"
                          name="status"
                          size="small"
                          defaultValue={
                            campaign.status === "archived"
                              ? "paused"
                              : campaign.status
                          }
                          disabled={archived}
                        >
                          {adCampaignStatusOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Headline"
                          name="headline"
                          size="small"
                          defaultValue={campaign.headline}
                          required
                          disabled={archived}
                        />
                        <TextField
                          label="Budget"
                          name="budget_ghs"
                          type="number"
                          size="small"
                          defaultValue={moneyInputDefault(campaign.budgetMinor)}
                          disabled={archived}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  GHS
                                </InputAdornment>
                              ),
                            },
                            htmlInput: { min: 0, step: "0.01" },
                          }}
                        />
                        <TextField
                          label="Daily cap"
                          name="daily_cap_ghs"
                          type="number"
                          size="small"
                          defaultValue={moneyInputDefault(
                            campaign.dailyCapMinor,
                          )}
                          disabled={archived}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  GHS
                                </InputAdornment>
                              ),
                            },
                            htmlInput: { min: 0, step: "0.01" },
                          }}
                        />
                        <StyledDateTimeField
                          label="Starts"
                          name="starts_at"
                          size="small"
                          defaultValue={datetimeLocalDefault(campaign.startsAt)}
                          required
                          disabled={archived}
                        />
                        <StyledDateTimeField
                          label="Ends"
                          name="ends_at"
                          size="small"
                          defaultValue={datetimeLocalDefault(campaign.endsAt)}
                          required
                          disabled={archived}
                        />
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.25,
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        }}
                      >
                        <TextField
                          label="Description"
                          name="description"
                          multiline
                          minRows={2}
                          size="small"
                          defaultValue={campaign.description}
                          disabled={archived}
                        />
                        <TextField
                          label="Review note"
                          name="review_note"
                          multiline
                          minRows={2}
                          size="small"
                          defaultValue={campaign.reviewNote}
                          disabled={archived}
                        />
                      </Box>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={archived}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Save placement
                      </Button>
                    </Stack>
                  </Form>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-ad-campaign:archive"
                    />
                    <input
                      type="hidden"
                      name="campaign_id"
                      value={campaign.campaignId}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Archive reason"
                        name="reason"
                        size="small"
                        placeholder="Placement completed"
                        fullWidth
                        disabled={archived}
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        color="warning"
                        disabled={archived}
                        sx={{ minWidth: { sm: 140 } }}
                      >
                        Archive
                      </Button>
                    </Stack>
                  </Form>
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}
    </Stack>
  );
}

function AffiliatesSection({
  affiliates,
  affiliatesError,
  affiliateAttribution,
  affiliateAttributionError,
  actionData,
}: {
  affiliates: AdminAffiliate[];
  affiliatesError: string | null;
  affiliateAttribution: AdminAffiliateAttribution[];
  affiliateAttributionError: string | null;
  actionData?: AdminActionFeedback;
}) {
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
  const pendingAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "pending_review",
  );
  const activeAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "active",
  );
  const archivedAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "archived",
  );
  const attributionByAffiliate = useMemo(
    () =>
      new Map(
        affiliateAttribution.map((item) => [item.affiliateId, item] as const),
      ),
    [affiliateAttribution],
  );
  const totalClicks = affiliateAttribution.reduce(
    (total, item) => total + item.clickCount,
    0,
  );
  const totalConversions = affiliateAttribution.reduce(
    (total, item) => total + item.conversionCount,
    0,
  );
  const pendingCommissionMinor = affiliateAttribution.reduce(
    (total, item) =>
      total +
      item.recentConversions
        .filter((conversion) => conversion.status === "pending")
        .reduce(
          (subtotal, conversion) => subtotal + conversion.commissionMinor,
          0,
        ),
    0,
  );
  const approvedCommissionMinor = affiliateAttribution.reduce(
    (total, item) =>
      total +
      item.recentConversions
        .filter((conversion) => conversion.status === "approved")
        .reduce(
          (subtotal, conversion) => subtotal + conversion.commissionMinor,
          0,
        ),
    0,
  );
  const reconciledCommissionMinor = affiliateAttribution.reduce(
    (total, item) =>
      total +
      item.recentPayouts.reduce(
        (subtotal, payout) => subtotal + payout.commissionMinor,
        0,
      ),
    0,
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Affiliate programmes"
        helper="Register partners and agents, track codes, commission terms, cookie windows, payout rail readiness, and approval state."
      />

      {actionData?.section === "affiliates" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {affiliatesError ? (
        <Alert severity="warning">{affiliatesError}</Alert>
      ) : null}
      {affiliateAttributionError ? (
        <Alert severity="warning">{affiliateAttributionError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Active partners"
          value={String(activeAffiliates.length)}
          helper="Eligible for attribution"
          trend={`${affiliates.length} total`}
        />
        <MetricCard
          label="Pending review"
          value={String(pendingAffiliates.length)}
          helper="Needs operator approval"
          trend="KYC/payout check"
        />
        <MetricCard
          label="Archived"
          value={String(archivedAffiliates.length)}
          helper="Disabled partner links"
          trend="Audit retained"
        />
        <MetricCard
          label="Paystack ready"
          value={String(
            affiliates.filter((affiliate) =>
              affiliate.payoutMode.startsWith("paystack"),
            ).length,
          )}
          helper="Split or transfer mode"
          trend="No held funds"
        />
        <MetricCard
          label="Tracked clicks"
          value={String(totalClicks)}
          helper="Recorded affiliate visits"
          trend={`${totalConversions} conversions`}
        />
        <MetricCard
          label="Pending commission"
          value={formatGHS(pendingCommissionMinor)}
          helper="Recent pending rows"
          trend="Awaiting approval"
        />
        <MetricCard
          label="Approved commission"
          value={formatGHS(approvedCommissionMinor)}
          helper="Recent approved rows"
          trend="Ready to reconcile"
        />
        <MetricCard
          label="Reconciled payouts"
          value={formatGHS(reconciledCommissionMinor)}
          helper="Recent payout batches"
          trend="Settled from commission"
        />
      </Box>

      {!affiliatesError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Register affiliate</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Add a partner code and the commercial terms operators approve.
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => setAffiliateDialogOpen(true)}
            >
              New affiliate
            </Button>
          </Stack>
          <Dialog
            open={affiliateDialogOpen}
            onClose={() => setAffiliateDialogOpen(false)}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle>Register affiliate partner</DialogTitle>
            <DialogContent dividers>
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-affiliate:create"
                />
                <Stack spacing={2}>
                  <FormGroupLabel>Affiliate</FormGroupLabel>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                }}
              >
                <TextField
                  select
                  label="Entity"
                  name="entity_type"
                  defaultValue="person"
                >
                  {affiliateEntityOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Code"
                  name="code"
                  required
                  placeholder="SEWINGPRO"
                />
                <TextField label="Display name" name="display_name" required />
                <TextField label="Contact name" name="contact_name" />
                <TextField label="Email" name="email" type="email" />
                <TextField label="Phone" name="phone" />
                <TextField label="Website" name="website_url" type="url" />
              </Box>
              <FormGroupLabel>Commission &amp; payout</FormGroupLabel>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                }}
              >
                <TextField
                  select
                  label="Commission"
                  name="commission_model"
                  defaultValue="percentage"
                >
                  {affiliateCommissionOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Commission value"
                  name="commission_value"
                  type="number"
                  required
                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                />
                <TextField
                  label="Cookie window"
                  name="cookie_window_days"
                  type="number"
                  defaultValue={30}
                  slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }}
                />
                <TextField
                  select
                  label="Payout mode"
                  name="payout_mode"
                  defaultValue="voucher"
                >
                  {affiliatePayoutOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Status"
                  name="status"
                  defaultValue="pending_review"
                >
                  {affiliateStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                <TextField label="Payout reference" name="payout_reference" />
                <TextField label="Notes" name="notes" multiline minRows={2} />
              </Box>
                  <Button
                    type="submit"
                    variant="contained"
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Create partner
                  </Button>
                </Stack>
              </Form>
            </DialogContent>
          </Dialog>
        </Panel>
      ) : null}

      {!affiliatesError && affiliates.length === 0 ? (
        <Alert severity="info">No affiliate partners are registered yet.</Alert>
      ) : null}

      {!affiliatesError && affiliates.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {affiliates.map((affiliate) => {
            const color = affiliateStatusColor(affiliate.status);
            const archived = affiliate.status === "archived";
            const performance = attributionByAffiliate.get(
              affiliate.affiliateId,
            );
            const approvedConversionCount =
              performance?.approvedConversionCount ?? 0;
            const recentApprovedCommissionMinor =
              performance?.recentConversions
                .filter((conversion) => conversion.status === "approved")
                .reduce(
                  (total, conversion) => total + conversion.commissionMinor,
                  0,
                ) ?? 0;
            const lastPayout = performance?.recentPayouts[0];
            return (
              <Panel
                key={affiliate.affiliateId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(color, archived ? 0.12 : 0.2),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    color,
                    archived ? 0.035 : 0.075,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "flex-start" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">
                          {affiliate.displayName}
                        </Typography>
                        <Chip
                          size="small"
                          label={affiliate.code}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {affiliateEntityLabel(affiliate.entityType)} ·{" "}
                        {affiliate.contactName || "No contact"}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={affiliateStatusLabel(affiliate.status)}
                      sx={{
                        bgcolor: alpha(color, 0.12),
                        color,
                        fontWeight: 900,
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    }}
                  >
                    <DetailLine
                      label="Commission"
                      value={affiliateCommissionLabel(affiliate)}
                    />
                    <DetailLine
                      label="Cookie window"
                      value={`${affiliate.cookieWindowDays} days`}
                    />
                    <DetailLine
                      label="Payout mode"
                      value={affiliatePayoutLabel(affiliate.payoutMode)}
                    />
                    <DetailLine
                      label="Contact"
                      value={affiliate.email || affiliate.phone || "No contact"}
                    />
                    <DetailLine
                      label="Tracked clicks"
                      value={String(performance?.clickCount ?? 0)}
                    />
                    <DetailLine
                      label="Conversions"
                      value={`${performance?.conversionCount ?? 0} total · ${
                        performance?.pendingConversionCount ?? 0
                      } pending`}
                    />
                    <DetailLine
                      label="Gross attributed"
                      value={formatGHS(performance?.grossMinor ?? 0)}
                    />
                    <DetailLine
                      label="Commission"
                      value={formatGHS(performance?.commissionMinor ?? 0)}
                    />
                    <DetailLine
                      label="Approved"
                      value={`${approvedConversionCount} · ${formatGHS(
                        recentApprovedCommissionMinor,
                      )}`}
                    />
                    <DetailLine
                      label="Last payout"
                      value={
                        lastPayout
                          ? `${formatGHS(lastPayout.commissionMinor)} · ${shortTime(
                              lastPayout.createdAt,
                            )}`
                          : "None"
                      }
                    />
                  </Box>

                  {performance?.recentConversions.length ? (
                    <Box
                      sx={{
                        p: 1.25,
                        border: "1px solid",
                        borderColor: alpha(tokens.info, 0.14),
                        borderRadius: 1,
                        bgcolor: alpha(tokens.white, 0.7),
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontWeight: 900 }}
                      >
                        Recent conversions
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 1 }}>
                        {performance.recentConversions.map((conversion) => {
                          const actions = affiliateConversionActions(
                            conversion.status,
                          );
                          return (
                            <Stack
                              key={conversion.conversionId}
                              spacing={1}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: alpha(tokens.panel, 0.76),
                              }}
                            >
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                sx={{
                                  justifyContent: "space-between",
                                  alignItems: { sm: "center" },
                                }}
                              >
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 900 }}>
                                    {conversion.businessName ||
                                      "Unknown business"}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{ color: "text.secondary" }}
                                  >
                                    {shortID(conversion.orderId)} ·{" "}
                                    {conversion.attributionModel.replace(
                                      "_",
                                      " ",
                                    )}
                                  </Typography>
                                </Box>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  sx={{
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <Chip
                                    size="small"
                                    label={conversion.status}
                                    variant="outlined"
                                  />
                                  <Typography sx={{ fontWeight: 900 }}>
                                    {formatGHS(conversion.commissionMinor)}
                                  </Typography>
                                </Stack>
                              </Stack>
                              {actions.length ? (
                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="admin-affiliate-conversion:update"
                                  />
                                  <input
                                    type="hidden"
                                    name="conversion_id"
                                    value={conversion.conversionId}
                                  />
                                  <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1}
                                    sx={{ alignItems: { sm: "center" } }}
                                  >
                                    <TextField
                                      label="Note"
                                      name="reason"
                                      size="small"
                                      sx={{ flex: 1 }}
                                    />
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      sx={{ flexWrap: "wrap" }}
                                    >
                                      {actions.map((action) => (
                                        <Button
                                          key={action.status}
                                          type="submit"
                                          name="status"
                                          value={action.status}
                                          size="small"
                                          variant="outlined"
                                        >
                                          {action.label}
                                        </Button>
                                      ))}
                                    </Stack>
                                  </Stack>
                                </Form>
                              ) : null}
                            </Stack>
                          );
                        })}
                      </Stack>
                    </Box>
                  ) : null}

                  {approvedConversionCount > 0 && !archived ? (
                    <Box
                      sx={{
                        p: 1.25,
                        border: "1px solid",
                        borderColor: alpha(tokens.success, 0.18),
                        borderRadius: 1,
                        bgcolor: alpha(tokens.success, 0.06),
                      }}
                    >
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-affiliate-payout:create"
                        />
                        <input
                          type="hidden"
                          name="affiliate_id"
                          value={affiliate.affiliateId}
                        />
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            sx={{
                              justifyContent: "space-between",
                              alignItems: { sm: "center" },
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 900 }}>
                                Approved payout
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary" }}
                              >
                                {approvedConversionCount} rows ·{" "}
                                {formatGHS(recentApprovedCommissionMinor)}
                              </Typography>
                            </Box>
                            <Button
                              type="submit"
                              size="small"
                              variant="contained"
                            >
                              Reconcile payout
                            </Button>
                          </Stack>
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1,
                              gridTemplateColumns: {
                                xs: "1fr",
                                sm: "minmax(0, 1fr) minmax(0, 1.2fr)",
                              },
                            }}
                          >
                            <TextField
                              label="Payout reference"
                              name="payout_reference"
                              size="small"
                              defaultValue={affiliate.payoutReference}
                            />
                            <TextField
                              label="Notes"
                              name="notes"
                              size="small"
                              defaultValue="Settled from approved affiliate commission."
                            />
                          </Box>
                        </Stack>
                      </Form>
                    </Box>
                  ) : null}

                  {performance?.recentPayouts.length ? (
                    <Box
                      sx={{
                        p: 1.25,
                        border: "1px solid",
                        borderColor: alpha(tokens.success, 0.14),
                        borderRadius: 1,
                        bgcolor: alpha(tokens.white, 0.7),
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", fontWeight: 900 }}
                      >
                        Recent payouts
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 1 }}>
                        {performance.recentPayouts.map((payout) => (
                          <Stack
                            key={payout.payoutBatchId}
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              bgcolor: alpha(tokens.panel, 0.76),
                              justifyContent: "space-between",
                              alignItems: { sm: "center" },
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 900 }}>
                                {formatGHS(payout.commissionMinor)}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: "text.secondary",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {payout.payoutReference ||
                                  shortID(payout.payoutBatchId)}
                              </Typography>
                            </Box>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: "center", flexWrap: "wrap" }}
                            >
                              <Chip
                                size="small"
                                label={payout.status}
                                variant="outlined"
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary" }}
                              >
                                {payout.conversionCount} rows ·{" "}
                                {shortTime(payout.createdAt)}
                              </Typography>
                            </Stack>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}

                  {affiliate.notes || affiliate.payoutReference ? (
                    <Box
                      sx={{
                        p: 1.25,
                        border: "1px solid",
                        borderColor: alpha(tokens.ink, 0.08),
                        borderRadius: 1,
                        bgcolor: alpha(tokens.white, 0.7),
                      }}
                    >
                      {affiliate.payoutReference ? (
                        <Typography sx={{ overflowWrap: "anywhere" }}>
                          {affiliate.payoutReference}
                        </Typography>
                      ) : null}
                      {affiliate.notes ? (
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.5, color: "text.secondary" }}
                        >
                          Notes: {affiliate.notes}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : null}

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-affiliate:update"
                    />
                    <input
                      type="hidden"
                      name="affiliate_id"
                      value={affiliate.affiliateId}
                    />
                    <Stack spacing={1.25}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.25,
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                          },
                        }}
                      >
                        <TextField
                          select
                          label="Entity"
                          name="entity_type"
                          size="small"
                          defaultValue={affiliate.entityType}
                          disabled={archived}
                        >
                          {affiliateEntityOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Code"
                          name="code"
                          size="small"
                          defaultValue={affiliate.code}
                          required
                          disabled={archived}
                        />
                        <TextField
                          label="Display name"
                          name="display_name"
                          size="small"
                          defaultValue={affiliate.displayName}
                          required
                          disabled={archived}
                        />
                        <TextField
                          label="Contact name"
                          name="contact_name"
                          size="small"
                          defaultValue={affiliate.contactName}
                          disabled={archived}
                        />
                        <TextField
                          label="Email"
                          name="email"
                          type="email"
                          size="small"
                          defaultValue={affiliate.email}
                          disabled={archived}
                        />
                        <TextField
                          label="Phone"
                          name="phone"
                          size="small"
                          defaultValue={affiliate.phone}
                          disabled={archived}
                        />
                        <TextField
                          label="Website"
                          name="website_url"
                          type="url"
                          size="small"
                          defaultValue={affiliate.websiteUrl}
                          disabled={archived}
                        />
                        <TextField
                          select
                          label="Commission"
                          name="commission_model"
                          size="small"
                          defaultValue={affiliate.commissionModel}
                          disabled={archived}
                        >
                          {affiliateCommissionOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Commission value"
                          name="commission_value"
                          type="number"
                          size="small"
                          defaultValue={affiliateCommissionDefault(affiliate)}
                          required
                          disabled={archived}
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                        />
                        <TextField
                          label="Cookie window"
                          name="cookie_window_days"
                          type="number"
                          size="small"
                          defaultValue={affiliate.cookieWindowDays}
                          disabled={archived}
                          slotProps={{
                            htmlInput: { min: 1, max: 365, step: 1 },
                          }}
                        />
                        <TextField
                          select
                          label="Payout mode"
                          name="payout_mode"
                          size="small"
                          defaultValue={affiliate.payoutMode}
                          disabled={archived}
                        >
                          {affiliatePayoutOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Status"
                          name="status"
                          size="small"
                          defaultValue={
                            affiliate.status === "archived"
                              ? "paused"
                              : affiliate.status
                          }
                          disabled={archived}
                        >
                          {affiliateStatusOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Box>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.25,
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        }}
                      >
                        <TextField
                          label="Payout reference"
                          name="payout_reference"
                          size="small"
                          defaultValue={affiliate.payoutReference}
                          disabled={archived}
                        />
                        <TextField
                          label="Notes"
                          name="notes"
                          multiline
                          minRows={2}
                          size="small"
                          defaultValue={affiliate.notes}
                          disabled={archived}
                        />
                      </Box>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={archived}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Save partner
                      </Button>
                    </Stack>
                  </Form>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-affiliate:archive"
                    />
                    <input
                      type="hidden"
                      name="affiliate_id"
                      value={affiliate.affiliateId}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Archive reason"
                        name="reason"
                        size="small"
                        placeholder="Programme closed"
                        fullWidth
                        disabled={archived}
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        color="warning"
                        disabled={archived}
                        sx={{ minWidth: { sm: 140 } }}
                      >
                        Archive
                      </Button>
                    </Stack>
                  </Form>
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}
    </Stack>
  );
}

function ReferralsSection({
  programmes,
  referralProgrammesError,
  businesses,
  actionData,
}: {
  programmes: AdminReferralProgramme[];
  referralProgrammesError: string | null;
  businesses: AdminBusiness[];
  actionData?: AdminActionFeedback;
}) {
  const activeProgrammes = programmes.filter(
    (programme) => programme.status === "active",
  );
  const draftProgrammes = programmes.filter(
    (programme) => programme.status === "draft",
  );
  const pausedProgrammes = programmes.filter(
    (programme) => programme.status === "paused",
  );
  const archivedProgrammes = programmes.filter(
    (programme) => programme.status === "archived",
  );
  const issuedCodeCount = programmes.reduce(
    (total, programme) => total + programme.codes.length,
    0,
  );
  const eligibleBusinesses = businesses.filter(
    (business) =>
      business.verificationStatus === "verified" &&
      business.operationalStatus === "active",
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Referral programmes"
        helper="Create two-sided referral programmes, control reward economics, qualifying order minimums, payout holds, date windows, and lifecycle state."
      />

      {actionData?.section === "referrals" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {referralProgrammesError ? (
        <Alert severity="warning">{referralProgrammesError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Active programmes"
          value={String(activeProgrammes.length)}
          helper="Eligible for referral links"
          trend={`${programmes.length} total`}
        />
        <MetricCard
          label="Draft"
          value={String(draftProgrammes.length)}
          helper="Not visible to customers"
          trend="Setup queue"
        />
        <MetricCard
          label="Paused"
          value={String(pausedProgrammes.length)}
          helper="Temporarily disabled"
          trend="No new rewards"
        />
        <MetricCard
          label="Issued codes"
          value={String(issuedCodeCount)}
          helper="Latest codes loaded"
          trend={`${archivedProgrammes.length} archived`}
        />
      </Box>

      {!referralProgrammesError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-referral-programme:create"
            />
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Typography variant="h6">
                    Create referral programme
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Define the code prefix and the rewards for both sides of the
                    invitation.
                  </Typography>
                </Box>
                <Button type="submit" variant="contained">
                  Create programme
                </Button>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                }}
              >
                <TextField label="Title" name="title" required />
                <TextField
                  label="Code prefix"
                  name="code_prefix"
                  required
                  placeholder="REF"
                />
                <TextField
                  select
                  label="Audience"
                  name="audience"
                  defaultValue="customers"
                >
                  {referralAudienceOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Referrer reward"
                  name="referrer_reward_kind"
                  defaultValue="voucher"
                >
                  {referralRewardKindOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="New customer reward"
                  name="referee_reward_kind"
                  defaultValue="voucher"
                >
                  {referralRefereeRewardKindOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Reward type"
                  name="reward_type"
                  defaultValue="fixed"
                >
                  {referralRewardTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Reward value"
                  name="reward_value"
                  type="number"
                  required
                  defaultValue={25}
                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                />
                <TextField
                  label="Percentage cap (GHS)"
                  name="max_reward_ghs"
                  type="number"
                  defaultValue={50}
                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                />
                <TextField
                  label="Minimum order (GHS)"
                  name="qualifying_order_min_ghs"
                  type="number"
                  defaultValue={150}
                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                />
                <TextField
                  label="Reward hold days"
                  name="reward_hold_days"
                  type="number"
                  defaultValue={14}
                  slotProps={{ htmlInput: { min: 0, max: 180, step: 1 } }}
                />
                <TextField
                  select
                  label="Status"
                  name="status"
                  defaultValue="draft"
                >
                  {referralStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                <StyledDateTimeField label="Starts" name="starts_at" />
                <StyledDateTimeField label="Ends" name="ends_at" />
              </Box>
              <TextField label="Notes" name="notes" multiline minRows={2} />
            </Stack>
          </Form>
        </Panel>
      ) : null}

      {!referralProgrammesError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-referral-rewards:issue"
            />
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              sx={{
                justifyContent: "space-between",
                alignItems: { lg: "end" },
              }}
            >
              <Box sx={{ maxWidth: 760 }}>
                <Typography variant="h6">Issue due rewards</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Runs the idempotent reward issuer for qualified referrals that
                  have passed their hold window. Voucher rewards become
                  single-use promotion codes; commission rebates stay pending
                  for finance review.
                </Typography>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                sx={{ width: { xs: "100%", lg: "auto" } }}
              >
                <TextField
                  label="Batch limit"
                  name="limit"
                  type="number"
                  size="small"
                  defaultValue={50}
                  sx={{ minWidth: { sm: 150 } }}
                  slotProps={{ htmlInput: { min: 1, max: 500, step: 1 } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SyncRounded />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Issue rewards
                </Button>
              </Stack>
            </Stack>
          </Form>
        </Panel>
      ) : null}

      {!referralProgrammesError && programmes.length === 0 ? (
        <Alert severity="info">
          No referral programmes are registered yet.
        </Alert>
      ) : null}

      {!referralProgrammesError && programmes.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {programmes.map((programme) => {
            const color = referralStatusColor(programme.status);
            const archived = programme.status === "archived";
            const windowText =
              programme.startsAt || programme.endsAt
                ? `${programme.startsAt ? shortTime(programme.startsAt) : "Now"} to ${
                    programme.endsAt ? shortTime(programme.endsAt) : "open"
                  }`
                : "Always available";

            return (
              <Panel
                key={programme.programmeId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(color, archived ? 0.12 : 0.2),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    color,
                    archived ? 0.035 : 0.075,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "flex-start" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">{programme.title}</Typography>
                        <Chip
                          size="small"
                          label={programme.codePrefix}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {referralAudienceLabel(programme.audience)} ·{" "}
                        {referralRewardTypeLabel(programme.rewardType)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={referralStatusLabel(programme.status)}
                      sx={{
                        bgcolor: alpha(color, 0.12),
                        color,
                        fontWeight: 900,
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    }}
                  >
                    <DetailLine
                      label="Reward"
                      value={referralRewardLabel(programme)}
                    />
                    <DetailLine
                      label="Reward route"
                      value={`${referralRewardKindLabel(
                        programme.referrerRewardKind,
                      )} / ${referralRefereeRewardKindLabel(
                        programme.refereeRewardKind,
                      )}`}
                    />
                    <DetailLine
                      label="Minimum order"
                      value={formatGHS(programme.qualifyingOrderMinMinor)}
                    />
                    <DetailLine
                      label="Hold"
                      value={`${programme.rewardHoldDays} days`}
                    />
                    <DetailLine label="Window" value={windowText} />
                    <DetailLine
                      label="Updated"
                      value={shortTime(programme.updatedAt)}
                    />
                  </Box>

                  {programme.notes ? (
                    <Box
                      sx={{
                        p: 1.25,
                        border: "1px solid",
                        borderColor: alpha(tokens.ink, 0.08),
                        borderRadius: 1,
                        bgcolor: alpha(tokens.white, 0.7),
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        Notes
                      </Typography>
                      <Typography sx={{ overflowWrap: "anywhere" }}>
                        {programme.notes}
                      </Typography>
                    </Box>
                  ) : null}

                  <Box
                    sx={{
                      p: 1.25,
                      border: "1px solid",
                      borderColor: alpha(tokens.ink, 0.08),
                      borderRadius: 1,
                      bgcolor: alpha(tokens.white, 0.74),
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{
                          alignItems: { sm: "center" },
                          justifyContent: "space-between",
                        }}
                      >
                        <Box>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 900 }}
                          >
                            Issued codes
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {programme.codes.length
                              ? `${programme.codes.length} recent code${
                                  programme.codes.length === 1 ? "" : "s"
                                }`
                              : "No codes issued"}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={`${programme.codes.reduce(
                            (total, code) => total + code.referralCount,
                            0,
                          )} referrals`}
                          variant="outlined"
                        />
                      </Stack>

                      {programme.codes.length > 0 ? (
                        <Stack spacing={0.75}>
                          {programme.codes.map((code) => (
                            <Box
                              key={code.referralCodeId}
                              sx={{
                                display: "grid",
                                gap: 1,
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  sm: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
                                },
                                alignItems: "center",
                                p: 1,
                                borderRadius: 1,
                                bgcolor: alpha(tokens.ink, 0.035),
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{
                                    fontWeight: 900,
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {code.code}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: "text.secondary" }}
                                >
                                  {code.ownerLabel || "Platform"} ·{" "}
                                  {shortTime(code.updatedAt)}
                                </Typography>
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary" }}
                              >
                                {code.referralCount} total ·{" "}
                                {code.qualifiedCount} qualified
                              </Typography>
                              <Chip
                                size="small"
                                label={code.status}
                                sx={{
                                  justifySelf: { sm: "end" },
                                  bgcolor: alpha(
                                    code.status === "active"
                                      ? tokens.success
                                      : tokens.warning,
                                    0.12,
                                  ),
                                  color:
                                    code.status === "active"
                                      ? tokens.success
                                      : tokens.warning,
                                  fontWeight: 900,
                                }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      ) : null}

                      <Divider />

                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-referral-code:create"
                        />
                        <input
                          type="hidden"
                          name="programme_id"
                          value={programme.programmeId}
                        />
                        <Box
                          sx={{
                            display: "grid",
                            gap: 1,
                            gridTemplateColumns: {
                              xs: "1fr",
                              md: "1fr 1fr 1.2fr auto",
                            },
                            alignItems: "center",
                          }}
                        >
                          <TextField
                            select
                            label="Owner"
                            name="owner_type"
                            size="small"
                            defaultValue="platform"
                            disabled={archived || programme.status !== "active"}
                          >
                            {referralCodeOwnerOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            label="Business"
                            name="business_id"
                            size="small"
                            defaultValue=""
                            disabled={
                              archived ||
                              programme.status !== "active" ||
                              eligibleBusinesses.length === 0
                            }
                          >
                            <MenuItem value="">None</MenuItem>
                            {eligibleBusinesses.map((business) => (
                              <MenuItem key={business.id} value={business.id}>
                                {business.name}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Code"
                            name="code"
                            size="small"
                            placeholder={`${programme.codePrefix}AMA`}
                            required
                            disabled={archived || programme.status !== "active"}
                          />
                          <TextField
                            select
                            label="Status"
                            name="status"
                            size="small"
                            defaultValue="active"
                            disabled={archived || programme.status !== "active"}
                          >
                            {referralCodeStatusOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                        <Button
                          type="submit"
                          variant="outlined"
                          disabled={archived || programme.status !== "active"}
                          sx={{ mt: 1.25 }}
                        >
                          Issue code
                        </Button>
                      </Form>
                    </Stack>
                  </Box>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-referral-programme:update"
                    />
                    <input
                      type="hidden"
                      name="programme_id"
                      value={programme.programmeId}
                    />
                    <Stack spacing={1.25}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.25,
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                          },
                        }}
                      >
                        <TextField
                          label="Title"
                          name="title"
                          size="small"
                          defaultValue={programme.title}
                          required
                          disabled={archived}
                        />
                        <TextField
                          label="Code prefix"
                          name="code_prefix"
                          size="small"
                          defaultValue={programme.codePrefix}
                          required
                          disabled={archived}
                        />
                        <TextField
                          select
                          label="Audience"
                          name="audience"
                          size="small"
                          defaultValue={programme.audience}
                          disabled={archived}
                        >
                          {referralAudienceOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Referrer reward"
                          name="referrer_reward_kind"
                          size="small"
                          defaultValue={programme.referrerRewardKind}
                          disabled={archived}
                        >
                          {referralRewardKindOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="New customer reward"
                          name="referee_reward_kind"
                          size="small"
                          defaultValue={programme.refereeRewardKind}
                          disabled={archived}
                        >
                          {referralRefereeRewardKindOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          select
                          label="Reward type"
                          name="reward_type"
                          size="small"
                          defaultValue={programme.rewardType}
                          disabled={archived}
                        >
                          {referralRewardTypeOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Reward value"
                          name="reward_value"
                          type="number"
                          size="small"
                          defaultValue={referralRewardDefault(programme)}
                          required
                          disabled={archived}
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                        />
                        <TextField
                          label="Percentage cap (GHS)"
                          name="max_reward_ghs"
                          type="number"
                          size="small"
                          defaultValue={moneyInputDefault(
                            programme.maxRewardMinor,
                          )}
                          disabled={archived}
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                        />
                        <TextField
                          label="Minimum order (GHS)"
                          name="qualifying_order_min_ghs"
                          type="number"
                          size="small"
                          defaultValue={moneyInputDefault(
                            programme.qualifyingOrderMinMinor,
                          )}
                          disabled={archived}
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                        />
                        <TextField
                          label="Reward hold days"
                          name="reward_hold_days"
                          type="number"
                          size="small"
                          defaultValue={programme.rewardHoldDays}
                          disabled={archived}
                          slotProps={{
                            htmlInput: { min: 0, max: 180, step: 1 },
                          }}
                        />
                        <TextField
                          select
                          label="Status"
                          name="status"
                          size="small"
                          defaultValue={
                            programme.status === "archived"
                              ? "paused"
                              : programme.status
                          }
                          disabled={archived}
                        >
                          {referralStatusOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <StyledDateTimeField
                          label="Starts"
                          name="starts_at"
                          size="small"
                          defaultValue={datetimeLocalDefault(
                            programme.startsAt,
                          )}
                          disabled={archived}
                        />
                        <StyledDateTimeField
                          label="Ends"
                          name="ends_at"
                          size="small"
                          defaultValue={datetimeLocalDefault(programme.endsAt)}
                          disabled={archived}
                        />
                      </Box>
                      <TextField
                        label="Notes"
                        name="notes"
                        multiline
                        minRows={2}
                        size="small"
                        defaultValue={programme.notes}
                        disabled={archived}
                      />
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={archived}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Save programme
                      </Button>
                    </Stack>
                  </Form>

                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="admin-referral-programme:archive"
                    />
                    <input
                      type="hidden"
                      name="programme_id"
                      value={programme.programmeId}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="Archive reason"
                        name="reason"
                        size="small"
                        placeholder="Campaign ended"
                        fullWidth
                        disabled={archived}
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        color="warning"
                        disabled={archived}
                        sx={{ minWidth: { sm: 140 } }}
                      >
                        Archive
                      </Button>
                    </Stack>
                  </Form>
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}
    </Stack>
  );
}

const permissionLabels: Record<string, string> = {
  manage_admin_users: "Manage admin users",
  manage_roles: "Manage roles",
  manage_settings: "Platform settings",
  review_businesses: "Business review",
  manage_money_rails: "Money rails",
  manage_subscriptions: "Subscriptions",
  manage_plans: "Plan packages",
  manage_promotions: "Promotions",
  manage_ads: "Sponsored placements",
  manage_growth: "Growth programmes",
  manage_risk: "Risk review",
  manage_support: "Support queue",
  view_audit: "Audit trail",
};

const permissionDescriptions: Record<string, string> = {
  manage_admin_users: "Create operators, change roles, and deactivate access.",
  manage_roles: "Edit what each platform role can do.",
  manage_settings: "Change platform-wide configuration and policy settings.",
  review_businesses: "Approve, reject, suspend, and inspect tenant accounts.",
  manage_money_rails:
    "Review Paystack events, payout holds, and commission rails.",
  manage_subscriptions:
    "Manage package lifecycle state, billing modes, and cancellation flow.",
  manage_plans:
    "Create, update, archive, and audit the package definitions businesses use.",
  manage_promotions:
    "Create, pause, archive, and audit platform or business-funded promotions.",
  manage_ads:
    "Review, approve, pause, and audit sponsored marketing placements.",
  manage_growth: "Manage admin-run affiliate and referral programme controls.",
  manage_risk: "Close or reopen platform trust and safety reviews.",
  manage_support: "Assign and resolve customer or business support issues.",
  view_audit: "Read the operator action trail and sensitive change history.",
};

const requiredOwnerPermissionValues = ["manage_admin_users", "manage_roles"];

function defaultPermissionCatalog(): AdminPermissionDefinition[] {
  return Object.entries(permissionLabels).map(([permission, label]) => ({
    permission,
    label,
  }));
}

function permissionLabel(value: string): string {
  return permissionLabels[value] ?? value.replaceAll("_", " ");
}

function permissionDescription(value: string): string {
  return permissionDescriptions[value] ?? "Platform permission.";
}

function roleHasPermission(
  role: AdminRoleDefinition,
  permission: string,
): boolean {
  return role.permissions.includes(permission);
}

function isProtectedOwnerPermission(
  role: AdminRole,
  permission: string,
): boolean {
  return role === "owner" && requiredOwnerPermissionValues.includes(permission);
}

function roleTone(role: AdminRole): string {
  switch (role) {
    case "owner":
      return tokens.burgundy;
    case "operator":
      return tokens.info;
    default:
      return tokens.success;
  }
}

function RolePermissionMatrix({ roles }: { roles: AdminRoleDefinition[] }) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Role permissions</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Current role grants. Manage the permission set from the Roles
            section.
          </Typography>
        </Box>
        <Stack spacing={1.25}>
          {roles.map((role) => (
            <Box
              key={role.role}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: alpha(roleTone(role.role), 0.2),
                bgcolor: alpha(roleTone(role.role), 0.055),
              }}
            >
              <Stack spacing={1}>
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Typography sx={{ fontWeight: 900 }}>{role.label}</Typography>
                  <Chip
                    size="small"
                    label={`${role.permissions.length} grants`}
                    sx={{
                      bgcolor: alpha(roleTone(role.role), 0.12),
                      color: roleTone(role.role),
                      fontWeight: 900,
                    }}
                  />
                </Stack>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ flexWrap: "wrap", gap: 0.75 }}
                >
                  {role.permissions.map((permission) => (
                    <Chip
                      key={permission}
                      size="small"
                      label={permissionLabel(permission)}
                      variant="outlined"
                      sx={{ bgcolor: alpha(tokens.white, 0.56) }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Panel>
  );
}

function RolePermissionsSection({
  roles,
  permissions,
  actionData,
}: {
  roles: AdminRoleDefinition[];
  permissions: AdminPermissionDefinition[];
  actionData?: AdminActionFeedback;
}) {
  const totalGrants = roles.reduce(
    (sum, role) => sum + role.permissions.length,
    0,
  );
  const ownerGrants =
    roles.find((role) => role.role === "owner")?.permissions.length ?? 0;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="RBAC"
        title="Role and permission management"
        helper="Tune the grants behind each admin role without changing operator accounts one by one."
      />

      {actionData?.section === "roles" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <MetricCard
          label="Managed roles"
          value={String(roles.length)}
          helper="Owner, operator, support"
          trend="Platform scoped"
        />
        <MetricCard
          label="Total grants"
          value={String(totalGrants)}
          helper="Across all roles"
          trend={`${permissions.length} available`}
        />
        <MetricCard
          label="Owner grants"
          value={String(ownerGrants)}
          helper="Recovery permissions locked"
          trend="Protected"
        />
      </Box>

      {roles.length === 0 ? (
        <Alert severity="warning">
          Role permissions could not be loaded from the admin API.
        </Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(3, 1fr)" },
            alignItems: "start",
          }}
        >
          {roles.map((role) => (
            <Panel
              key={role.role}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderColor: alpha(roleTone(role.role), 0.18),
                backgroundImage: `linear-gradient(180deg, ${alpha(
                  roleTone(role.role),
                  0.075,
                )}, transparent 38%)`,
              }}
            >
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-role-permissions:update"
                />
                <input type="hidden" name="role" value={role.role} />
                <Stack spacing={2}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.25}
                      sx={{ alignItems: "center" }}
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 1.5,
                          display: "grid",
                          placeItems: "center",
                          bgcolor: alpha(roleTone(role.role), 0.12),
                          color: roleTone(role.role),
                        }}
                      >
                        <AdminPanelSettingsRounded />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>
                          {role.label}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {role.role}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      size="small"
                      label={`${role.permissions.length} grants`}
                      sx={{
                        bgcolor: alpha(roleTone(role.role), 0.12),
                        color: roleTone(role.role),
                        fontWeight: 900,
                      }}
                    />
                  </Stack>

                  <Stack spacing={1}>
                    {permissions.map((permission) => {
                      const protectedPermission = isProtectedOwnerPermission(
                        role.role,
                        permission.permission,
                      );
                      const checked =
                        roleHasPermission(role, permission.permission) ||
                        protectedPermission;

                      return (
                        <Box
                          key={permission.permission}
                          sx={{
                            p: 1.25,
                            borderRadius: 1.25,
                            border: "1px solid",
                            borderColor: checked
                              ? alpha(roleTone(role.role), 0.26)
                              : alpha(tokens.ink, 0.08),
                            bgcolor: checked
                              ? alpha(roleTone(role.role), 0.055)
                              : alpha(tokens.white, 0.54),
                          }}
                        >
                          {protectedPermission ? (
                            <input
                              type="hidden"
                              name="permissions"
                              value={permission.permission}
                            />
                          ) : null}
                          <FormControlLabel
                            sx={{
                              m: 0,
                              alignItems: "flex-start",
                              ".MuiFormControlLabel-label": { width: "100%" },
                            }}
                            control={
                              <Checkbox
                                name="permissions"
                                value={permission.permission}
                                defaultChecked={checked}
                                disabled={protectedPermission}
                                sx={{ pt: 0.2 }}
                              />
                            }
                            label={
                              <Box>
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  sx={{
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 900 }}>
                                    {permission.label}
                                  </Typography>
                                  {protectedPermission ? (
                                    <Chip
                                      size="small"
                                      label="Required"
                                      sx={{
                                        height: 22,
                                        bgcolor: alpha(tokens.burgundy, 0.1),
                                        color: tokens.burgundy,
                                        fontWeight: 900,
                                      }}
                                    />
                                  ) : null}
                                </Stack>
                                <Typography
                                  variant="body2"
                                  sx={{ color: "text.secondary" }}
                                >
                                  {permissionDescription(permission.permission)}
                                </Typography>
                              </Box>
                            }
                          />
                        </Box>
                      );
                    })}
                  </Stack>

                  {role.role === "owner" ? (
                    <Alert severity="info">
                      Owner recovery permissions are locked so the platform can
                      always manage roles and operator access.
                    </Alert>
                  ) : null}

                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<AdminPanelSettingsRounded />}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Save permissions
                  </Button>
                </Stack>
              </Form>
            </Panel>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function AdminUsersSection({
  users,
  roles,
  currentUserId,
  actionData,
  error,
}: {
  users: AdminUser[];
  roles: AdminRoleDefinition[];
  currentUserId: string;
  actionData?: AdminActionFeedback;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);
  const activeCount = users.filter((user) => user.isActive).length;
  const ownerCount = users.filter((user) => user.role === "owner").length;
  const supportCount = users.filter((user) => user.role === "support").length;
  const filteredUsers = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.isActive : !user.isActive);
      const roleLabel =
        roles.find((role) => role.role === user.role)?.label ?? user.role;
      const searchable = [
        user.displayName,
        user.email,
        user.role,
        roleLabel,
        user.isActive ? "active" : "inactive",
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesRole &&
        matchesStatus &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [query, roleFilter, roles, statusFilter, users]);
  const selectedUser =
    users.find((user) => user.adminUserId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Access control"
        title="Operator user management"
        helper="Create platform operators, assign roles, and keep inactive access visible for review."
      />

      {actionData?.section === "users" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <MetricCard
          label="Active operators"
          value={String(activeCount)}
          helper="Can sign into admin"
          trend={`${users.length - activeCount} inactive`}
        />
        <MetricCard
          label="Owners"
          value={String(ownerCount)}
          helper="Can manage access"
          trend="Full grants"
        />
        <MetricCard
          label="Support"
          value={String(supportCount)}
          helper="Queue-focused access"
          trend="Scoped grants"
        />
      </Box>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "1.2fr 0.8fr" },
        }}
      >
        <Panel sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(140px, 0.35fr)) auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search operators"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Role"
              select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All roles</MenuItem>
              {roles.map((role) => (
                <MenuItem key={role.role} value={role.role}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<PersonSearchRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New operator
            </Button>
          </Box>
          <Divider />
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Operator list</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {filteredUsers.length} of {users.length} operators shown
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${users.length - activeCount} inactive`}
                color={users.length - activeCount > 0 ? "warning" : "success"}
                variant="outlined"
              />
            </Stack>
          </Box>
          {users.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <Alert severity="info">
                No operator accounts are available from the admin API.
              </Alert>
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <Alert severity="info">
                No operators match the current search and filters.
              </Alert>
            </Box>
          ) : (
            filteredUsers.map((user) => (
              <AdminOperatorRow
                key={user.adminUserId}
                user={user}
                currentUserId={currentUserId}
                onView={() => setDetailID(user.adminUserId)}
              />
            ))
          )}
        </Panel>

        <RolePermissionMatrix roles={roles} />
      </Box>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create operator</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                New operators can sign in with the temporary password set here.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <AdminOperatorCreateForm roles={roles} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedUser)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">
                {selectedUser?.displayName ?? "Operator details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Update the operator profile, role, and access state.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser ? (
            <AdminOperatorDetailForm
              user={selectedUser}
              roles={roles}
              currentUserId={currentUserId}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

function AdminOperatorCreateForm({ roles }: { roles: AdminRoleDefinition[] }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-user:create" />
      <Stack spacing={1.5}>
        <TextField name="display_name" label="Display name" required />
        <TextField name="email" label="Email" type="email" required />
        <TextField
          name="role"
          label="Role"
          select
          required
          defaultValue="support"
        >
          {roles.map((role) => (
            <MenuItem key={role.role} value={role.role}>
              {role.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="password"
          label="Temporary password"
          type="password"
          required
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={<PersonSearchRounded />}
        >
          Create operator
        </Button>
      </Stack>
    </Form>
  );
}

function AdminOperatorRow({
  user,
  currentUserId,
  onView,
}: {
  user: AdminUser;
  currentUserId: string;
  onView: () => void;
}) {
  const isSelf = user.adminUserId === currentUserId;

  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(roleTone(user.role), 0.12),
              color: roleTone(user.role),
              flexShrink: 0,
            }}
          >
            <ShieldRounded />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900 }} noWrap>
              {user.displayName}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
            >
              {user.email}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ flexWrap: "wrap", gap: 0.75, alignItems: "center" }}
        >
          <Chip
            size="small"
            label={user.role}
            sx={{
              textTransform: "capitalize",
              bgcolor: alpha(roleTone(user.role), 0.12),
              color: roleTone(user.role),
            }}
          />
          <Chip
            size="small"
            label={user.isActive ? "Active" : "Inactive"}
            color={user.isActive ? "success" : "default"}
            variant={user.isActive ? "filled" : "outlined"}
          />
          {isSelf ? <Chip size="small" label="You" /> : null}
          <Button
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardRounded />}
            onClick={onView}
          >
            View details
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function AdminOperatorDetailForm({
  user,
  roles,
  currentUserId,
}: {
  user: AdminUser;
  roles: AdminRoleDefinition[];
  currentUserId: string;
}) {
  const isSelf = user.adminUserId === currentUserId;

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-user:update" />
      <input type="hidden" name="admin_user_id" value={user.adminUserId} />
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          }}
        >
          <DetailLine label="Email" value={user.email} />
          <DetailLine label="Current role" value={user.role} />
          <DetailLine
            label="Access state"
            value={user.isActive ? "Active" : "Inactive"}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              md: "1.35fr 0.85fr 0.75fr auto",
            },
            alignItems: "end",
          }}
        >
          <TextField
            name="display_name"
            label="Display name"
            defaultValue={user.displayName}
            required
          />
          <TextField
            name="role"
            label="Role"
            select
            defaultValue={user.role}
            required
          >
            {roles.map((role) => (
              <MenuItem key={role.role} value={role.role}>
                {role.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            name="is_active"
            label="Status"
            select
            defaultValue={String(user.isActive)}
            required
          >
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Inactive</MenuItem>
          </TextField>
          <Button
            type="submit"
            variant={isSelf ? "outlined" : "contained"}
            disabled={isSelf && user.role === "owner"}
            sx={{ minHeight: 56 }}
          >
            Save
          </Button>
        </Box>
        {isSelf && user.role === "owner" ? (
          <Alert severity="info">
            Self-demotion and self-deactivation are blocked to avoid locking the
            platform out.
          </Alert>
        ) : null}
      </Stack>
    </Form>
  );
}

function BooleanPreference({
  name,
  label,
  helper,
  defaultChecked,
  disabled = false,
}: {
  name: string;
  label: string;
  helper: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.25,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        borderRadius: 1.5,
        bgcolor: disabled
          ? alpha(tokens.ink, 0.035)
          : alpha(tokens.white, 0.62),
      }}
    >
      <input type="hidden" name={name} value="false" />
      <FormControlLabel
        sx={{
          m: 0,
          alignItems: "flex-start",
          ".MuiFormControlLabel-label": { width: "100%" },
        }}
        control={
          <Checkbox
            name={name}
            value="true"
            defaultChecked={defaultChecked}
            disabled={disabled}
            sx={{ pt: 0.2 }}
          />
        }
        label={
          <Box>
            <Typography sx={{ fontWeight: 900 }}>{label}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {helper}
            </Typography>
          </Box>
        }
      />
    </Box>
  );
}

function SettingsSection({
  admin,
  profileSettings,
  profileSettingsError,
  platformSettings,
  platformSettingsError,
  roles,
  actionData,
}: {
  admin: AdminSession;
  profileSettings: AdminProfileSettings;
  profileSettingsError: string | null;
  platformSettings: AdminPlatformSettings;
  platformSettingsError: string | null;
  roles: AdminRoleDefinition[];
  actionData?: AdminActionFeedback;
}) {
  const roleDefinition = roles.find((role) => role.role === admin.adminRole);
  const canManagePlatformSettings =
    roleDefinition?.permissions.includes("manage_settings") ??
    admin.adminRole === "owner";
  const preferences = profileSettings.preferences;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Workspace settings"
        title="Profile, platform settings, and notifications"
        helper="Keep operator identity, alert routing, and platform policy controls in one place."
      />

      {actionData?.section === "settings" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {profileSettingsError ? (
        <Alert severity="warning">{profileSettingsError}</Alert>
      ) : null}
      {platformSettingsError ? (
        <Alert severity="warning">{platformSettingsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <MetricCard
          label="Signed in as"
          value={profileSettings.user.displayName}
          helper={profileSettings.user.email}
          trend={profileSettings.user.role}
        />
        <MetricCard
          label="Daily digest"
          value={preferences.dailyDigestTime}
          helper={preferences.timezone}
          trend={preferences.notifyEmail ? "Email on" : "Email off"}
        />
        <MetricCard
          label="Review threshold"
          value={formatGHS(platformSettings.payoutReviewThresholdPesewas)}
          helper={`${platformSettings.verificationSlaHours}h verification SLA`}
          trend={platformSettings.maintenanceMode ? "Maintenance on" : "Live"}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", xl: "0.78fr 1.22fr" },
          alignItems: "start",
        }}
      >
        <Stack spacing={2.5}>
          <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
            <Form method="post">
              <input type="hidden" name="intent" value="admin-profile:update" />
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.burgundy, 0.1),
                      color: tokens.burgundy,
                    }}
                  >
                    <PersonSearchRounded />
                  </Box>
                  <Box>
                    <Typography variant="h6">Profile settings</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      This is the identity shown in admin decisions and audit
                      records.
                    </Typography>
                  </Box>
                </Stack>

                <TextField
                  name="display_name"
                  label="Display name"
                  defaultValue={profileSettings.user.displayName}
                  required
                  fullWidth
                />
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={profileSettings.user.email}
                  required
                  fullWidth
                />
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: "wrap", gap: 1 }}
                >
                  <Chip
                    size="small"
                    icon={<ShieldRounded />}
                    label={profileSettings.user.role}
                    sx={{
                      textTransform: "capitalize",
                      bgcolor: alpha(roleTone(profileSettings.user.role), 0.12),
                      color: roleTone(profileSettings.user.role),
                    }}
                  />
                  <Chip
                    size="small"
                    label={
                      profileSettings.user.isActive ? "Active" : "Inactive"
                    }
                    color={
                      profileSettings.user.isActive ? "success" : "default"
                    }
                    variant={
                      profileSettings.user.isActive ? "filled" : "outlined"
                    }
                  />
                </Stack>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<PersonSearchRounded />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save profile
                </Button>
              </Stack>
            </Form>
          </Panel>

          <Panel
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(tokens.info, 0.16),
              backgroundImage: `
                linear-gradient(135deg, ${alpha(tokens.info, 0.08)}, transparent 38%),
                linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
              `,
            }}
          >
            <Stack spacing={1.25}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                <SettingsRounded sx={{ color: tokens.burgundy }} />
                <Box>
                  <Typography variant="h6">Current platform policy</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {platformSettings.platformName} routes support through{" "}
                    {platformSettings.supportEmail}.
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <DetailLine
                label="Verification SLA"
                value={`${platformSettings.verificationSlaHours} hours`}
              />
              <DetailLine
                label="Payout review threshold"
                value={formatGHS(platformSettings.payoutReviewThresholdPesewas)}
              />
              <DetailLine
                label="Maintenance"
                value={
                  platformSettings.maintenanceMode ? "Enabled" : "Disabled"
                }
              />
              <DetailLine
                label="Updated"
                value={
                  platformSettings.updatedAt
                    ? shortTime(platformSettings.updatedAt)
                    : "Default"
                }
              />
            </Stack>
          </Panel>
        </Stack>

        <Stack spacing={2.5}>
          <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-preferences:update"
              />
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.warning, 0.12),
                      color: tokens.warning,
                    }}
                  >
                    <NotificationsActiveRounded />
                  </Box>
                  <Box>
                    <Typography variant="h6">Notification settings</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Choose how this operator receives operational alerts.
                    </Typography>
                  </Box>
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 180px" },
                  }}
                >
                  <TextField
                    name="timezone"
                    label="Timezone"
                    select
                    defaultValue={preferences.timezone}
                    required
                  >
                    <MenuItem value="Africa/Accra">Africa/Accra</MenuItem>
                    <MenuItem value="UTC">UTC</MenuItem>
                    <MenuItem value="Europe/London">Europe/London</MenuItem>
                    <MenuItem value="America/New_York">
                      America/New York
                    </MenuItem>
                  </TextField>
                  <TextField
                    name="phone_number"
                    label="SMS phone"
                    defaultValue={preferences.phoneNumber}
                    placeholder="+233501234567"
                  />
                  <StyledTimeField
                    name="daily_digest_time"
                    label="Digest time"
                    defaultValue={preferences.dailyDigestTime}
                    required
                  />
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                  }}
                >
                  <BooleanPreference
                    name="notify_email"
                    label="Email alerts"
                    helper="Send urgent account and payment updates to your inbox."
                    defaultChecked={preferences.notifyEmail}
                  />
                  <BooleanPreference
                    name="notify_sms"
                    label="SMS alerts"
                    helper="Use phone alerts for time-sensitive operations."
                    defaultChecked={preferences.notifySms}
                  />
                  <BooleanPreference
                    name="alert_verifications"
                    label="Verification queue"
                    helper="Business identity, documents, and payout readiness."
                    defaultChecked={preferences.alertVerifications}
                  />
                  <BooleanPreference
                    name="alert_money_rails"
                    label="Money rails"
                    helper="Webhook failures, payout reviews, and settlement holds."
                    defaultChecked={preferences.alertMoneyRails}
                  />
                  <BooleanPreference
                    name="alert_subscriptions"
                    label="Subscriptions"
                    helper="Plan billing, grace periods, and package usage."
                    defaultChecked={preferences.alertSubscriptions}
                  />
                  <BooleanPreference
                    name="alert_promotions"
                    label="Promotions"
                    helper="Voucher rules and pending redemption activity."
                    defaultChecked={preferences.alertPromotions}
                  />
                  <BooleanPreference
                    name="alert_risk"
                    label="Risk reviews"
                    helper="Trust, safety, fraud, and compliance escalations."
                    defaultChecked={preferences.alertRisk}
                  />
                  <BooleanPreference
                    name="alert_support"
                    label="Support queue"
                    helper="Urgent tickets and customer-impacting requests."
                    defaultChecked={preferences.alertSupport}
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<NotificationsActiveRounded />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save notifications
                </Button>
              </Stack>
            </Form>
          </Panel>

          <Panel
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(tokens.burgundy, 0.16),
            }}
          >
            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-platform-settings:update"
              />
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tokens.burgundy, 0.1),
                      color: tokens.burgundy,
                    }}
                  >
                    <SettingsRounded />
                  </Box>
                  <Box>
                    <Typography variant="h6">Platform settings</Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      Owners can adjust global policy values used across admin
                      workflows.
                    </Typography>
                  </Box>
                </Stack>

                {!canManagePlatformSettings ? (
                  <Alert severity="info">
                    Your role can view platform settings, but cannot change
                    them.
                  </Alert>
                ) : null}

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  }}
                >
                  <TextField
                    name="platform_name"
                    label="Platform name"
                    defaultValue={platformSettings.platformName}
                    required
                    disabled={!canManagePlatformSettings}
                  />
                  <TextField
                    name="support_email"
                    label="Support email"
                    type="email"
                    defaultValue={platformSettings.supportEmail}
                    required
                    disabled={!canManagePlatformSettings}
                  />
                  <TextField
                    name="verification_sla_hours"
                    label="Verification SLA hours"
                    type="number"
                    defaultValue={platformSettings.verificationSlaHours}
                    required
                    disabled={!canManagePlatformSettings}
                    slotProps={{ htmlInput: { min: 1, max: 168, step: 1 } }}
                  />
                  <TextField
                    name="payout_review_threshold_ghs"
                    label="Payout review threshold"
                    type="number"
                    defaultValue={(
                      platformSettings.payoutReviewThresholdPesewas / 100
                    ).toFixed(2)}
                    required
                    disabled={!canManagePlatformSettings}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">GHS</InputAdornment>
                        ),
                      },
                      htmlInput: { min: 0, step: 0.01 },
                    }}
                  />
                </Box>

                <BooleanPreference
                  name="maintenance_mode"
                  label="Maintenance mode"
                  helper="Temporarily signal that storefront and dashboard operations are restricted."
                  defaultChecked={platformSettings.maintenanceMode}
                  disabled={!canManagePlatformSettings}
                />

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SettingsRounded />}
                  disabled={!canManagePlatformSettings}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Save platform settings
                </Button>
              </Stack>
            </Form>
          </Panel>
        </Stack>
      </Box>
    </Stack>
  );
}

function AdminRail({
  adminDisplayName,
  adminEmail,
  adminRole,
  section,
  collapsed,
  mobileOpen,
  notificationCount,
  pendingCount,
  riskCount,
  urgentTickets,
  onCloseMobile,
  onSelect,
}: {
  adminDisplayName: string;
  adminEmail: string;
  adminRole: string;
  section: Section;
  collapsed: boolean;
  mobileOpen: boolean;
  notificationCount: number;
  pendingCount: number;
  riskCount: number;
  urgentTickets: number;
  onCloseMobile: () => void;
  onSelect: (section: Section) => void;
}) {
  const navBadge = (id: Section): string | null => {
    if (id === "notifications" && notificationCount > 0) {
      return String(notificationCount);
    }
    if (id === "verification" && pendingCount > 0) {
      return String(pendingCount);
    }
    if (id === "support" && urgentTickets > 0) {
      return String(urgentTickets);
    }
    if (id === "risk" && riskCount > 0) {
      return String(riskCount);
    }
    return null;
  };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(adminNavGroups.map((group) => [group.id, true])),
  );
  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }));
  };
  const renderNavItem = (
    item: AdminNavItem,
    compact: boolean,
    onClose?: () => void,
  ) => {
    const selected = item.id === section;
    const badge = navBadge(item.id);
    const button = (
      <ListItemButton
        selected={selected}
        onClick={() => {
          onSelect(item.id);
          onClose?.();
        }}
        sx={{
          borderRadius: 1.5,
          minHeight: 52,
          px: compact ? 1 : 1.4,
          justifyContent: compact ? "center" : "flex-start",
          position: "relative",
          overflow: "hidden",
          color: tokens.white,
          border: "1px solid",
          borderColor: selected ? alpha(tokens.white, 0.18) : "transparent",
          bgcolor: selected
            ? alpha(tokens.white, 0.13)
            : alpha(tokens.white, 0.035),
          transition:
            "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 4,
            bgcolor: selected ? tokens.warning : "transparent",
          },
          "&.Mui-selected": {
            bgcolor: alpha(tokens.white, 0.13),
          },
          "&.Mui-selected:hover, &:hover": {
            bgcolor: alpha(tokens.white, 0.17),
            transform: compact ? "translateY(-1px)" : "translateX(2px)",
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: compact ? 0 : 38,
            color: selected ? tokens.white : alpha(tokens.white, 0.62),
            justifyContent: "center",
          }}
        >
          <Badge
            color="error"
            badgeContent={badge ? Number(badge) : 0}
            invisible={!badge}
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                bgcolor: tokens.burgundy,
                color: tokens.white,
                border: `1px solid ${alpha(tokens.white, 0.28)}`,
              },
            }}
          >
            {item.icon}
          </Badge>
        </ListItemIcon>
        {!compact ? (
          <>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                component="span"
                sx={{
                  display: "block",
                  fontWeight: selected ? 900 : 760,
                  fontSize: 14,
                }}
                noWrap
              >
                {item.label}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                sx={{
                  display: "block",
                  color: alpha(tokens.white, 0.56),
                }}
                noWrap
              >
                {item.helper}
              </Typography>
            </Box>
            {badge ? (
              <Chip
                size="small"
                label={badge}
                sx={{
                  height: 22,
                  color: tokens.white,
                  bgcolor: alpha(tokens.burgundy, 0.72),
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.14),
                }}
              />
            ) : null}
          </>
        ) : null}
      </ListItemButton>
    );

    return compact ? (
      <Tooltip title={item.label} placement="right">
        {button}
      </Tooltip>
    ) : (
      button
    );
  };

  const renderRailContent = ({
    compact,
    onClose,
  }: {
    compact: boolean;
    onClose?: () => void;
  }) => (
    <Stack
      spacing={2}
      sx={{
        minHeight: "100%",
        p: compact ? 1 : { xs: 1.25, sm: 1.5 },
        pb: compact ? 1 : "calc(12px + env(safe-area-inset-bottom))",
      }}
    >
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          p: compact ? 0.75 : 1.25,
          border: "1px solid",
          borderColor: alpha(tokens.gold, 0.22),
          borderRadius: 2.5,
          color: tokens.white,
          backgroundColor: alpha(tokens.white, 0.05),
          backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${alpha(tokens.gold, 0.16)} 0%, transparent 44%), linear-gradient(150deg, ${alpha(tokens.burgundy, 0.5)} 0%, ${alpha(tokens.ink, 0)} 62%)`,
          backdropFilter: "blur(14px)",
          boxShadow: `0 18px 44px ${alpha(tokens.ink, 0.42)}, inset 0 1px 0 ${alpha(tokens.white, 0.12)}`,
          "&::before": {
            content: '""',
            position: "absolute",
            insetInline: 14,
            top: 0,
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${alpha(tokens.gold, 0.7)}, transparent)`,
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: "center",
            justifyContent: compact ? "center" : "space-between",
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", minWidth: 0 }}
          >
            <Box
              sx={{
                position: "relative",
                width: compact ? 44 : 48,
                height: compact ? 44 : 48,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                color: tokens.white,
                backgroundImage: `linear-gradient(155deg, ${tokens.burgundy} 0%, ${tokens.charcoal} 100%)`,
                border: `1px solid ${alpha(tokens.gold, 0.5)}`,
                boxShadow: `0 14px 30px ${alpha(tokens.burgundy, 0.5)}, inset 0 1px 0 ${alpha(tokens.white, 0.22)}`,
              }}
            >
              <Typography
                component="span"
                aria-hidden
                sx={{
                  fontFamily: '"DM Serif Display", serif',
                  fontSize: 24,
                  lineHeight: 1,
                  mt: "2px",
                }}
              >
                X
              </Typography>
              <ShieldRounded
                sx={{
                  position: "absolute",
                  right: -6,
                  bottom: -6,
                  fontSize: 16,
                  p: "2px",
                  borderRadius: "50%",
                  color: tokens.charcoal,
                  bgcolor: tokens.gold,
                  boxShadow: `0 4px 10px ${alpha(tokens.ink, 0.5)}`,
                }}
              />
            </Box>
            {!compact ? (
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: '"DM Serif Display", serif',
                    fontSize: 18,
                    lineHeight: 1.15,
                    color: tokens.white,
                  }}
                  noWrap
                >
                  {adminDisplayName}
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: "center", mt: 0.25, minWidth: 0 }}
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: tokens.gold,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Console
                  </Typography>
                  <Box
                    sx={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      bgcolor: alpha(tokens.white, 0.4),
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: alpha(tokens.white, 0.62),
                    }}
                    noWrap
                  >
                    {adminEmail}
                  </Typography>
                </Stack>
              </Box>
            ) : null}
          </Stack>
          {onClose ? (
            <IconButton
              aria-label="Close navigation"
              onClick={onClose}
              sx={{
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.14),
                bgcolor: alpha(tokens.white, 0.06),
              }}
            >
              <CloseRounded />
            </IconButton>
          ) : null}
        </Stack>
        {!compact ? (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.75 }}
          >
            <Chip
              size="small"
              icon={<ShieldRounded />}
              label={adminRole}
              sx={{
                height: 26,
                textTransform: "capitalize",
                fontWeight: 700,
                color: tokens.white,
                borderRadius: 1.5,
                backgroundImage: `linear-gradient(135deg, ${alpha(roleTone(adminRole as AdminRole), 0.34)}, ${alpha(roleTone(adminRole as AdminRole), 0.14)})`,
                border: "1px solid",
                borderColor: alpha(roleTone(adminRole as AdminRole), 0.5),
                "& .MuiChip-label": { px: 1 },
                "& .MuiChip-icon": {
                  fontSize: 15,
                  color: alpha(tokens.white, 0.85),
                },
              }}
            />
            <Chip
              size="small"
              label={`${pendingCount} KYC`}
              sx={{
                height: 26,
                fontWeight: 700,
                color: tokens.white,
                borderRadius: 1.5,
                bgcolor: alpha(tokens.warning, 0.18),
                border: "1px solid",
                borderColor: alpha(tokens.warning, 0.5),
                "& .MuiChip-label": { px: 1 },
              }}
            />
          </Stack>
        ) : null}
      </Box>

      <Box sx={{ flex: 1 }}>
        <List
          sx={{
            p: 0,
            mt: compact ? 0 : 0.85,
            display: "grid",
            gap: compact ? 0.7 : 1,
          }}
        >
          {adminNavGroups.map((group) => {
            const activeGroup = group.items.some((item) => item.id === section);
            const open = openGroups[group.id] ?? true;
            const groupBadge = group.items.reduce((total, item) => {
              const value = Number(navBadge(item.id) ?? 0);
              return Number.isFinite(value) ? total + value : total;
            }, 0);

            return (
              <Box key={group.id}>
                {compact ? (
                  <Tooltip title={group.label} placement="right">
                    <IconButton
                      aria-label={`${group.label} navigation group`}
                      aria-expanded={open}
                      onClick={() => toggleGroup(group.id)}
                      sx={{
                        width: "100%",
                        height: 40,
                        color: activeGroup ? tokens.warning : tokens.white,
                        border: "1px solid",
                        borderColor: activeGroup
                          ? alpha(tokens.warning, 0.28)
                          : alpha(tokens.white, 0.1),
                        bgcolor: activeGroup
                          ? alpha(tokens.warning, 0.12)
                          : alpha(tokens.white, 0.045),
                        borderRadius: 1.5,
                        "&:hover": { bgcolor: alpha(tokens.white, 0.14) },
                      }}
                    >
                      <Badge
                        color="error"
                        badgeContent={groupBadge}
                        invisible={groupBadge === 0}
                        max={99}
                        sx={{
                          "& .MuiBadge-badge": {
                            bgcolor: tokens.burgundy,
                            color: tokens.white,
                            border: `1px solid ${alpha(tokens.white, 0.28)}`,
                          },
                        }}
                      >
                        {group.icon}
                      </Badge>
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    startIcon={group.icon}
                    endIcon={
                      open ? (
                        <KeyboardArrowDownRounded />
                      ) : (
                        <ChevronRightRounded />
                      )
                    }
                    aria-expanded={open}
                    fullWidth
                    sx={{
                      minHeight: 38,
                      justifyContent: "flex-start",
                      color: tokens.white,
                      border: "1px solid",
                      borderColor: activeGroup
                        ? alpha(tokens.warning, 0.28)
                        : alpha(tokens.white, 0.1),
                      bgcolor: activeGroup
                        ? alpha(tokens.warning, 0.12)
                        : alpha(tokens.white, 0.055),
                      "& .MuiButton-startIcon": {
                        color: activeGroup
                          ? tokens.warning
                          : alpha(tokens.white, 0.68),
                      },
                      "& .MuiButton-endIcon": {
                        ml: "auto",
                        color: alpha(tokens.white, 0.62),
                      },
                      "&:hover": {
                        bgcolor: alpha(tokens.white, 0.13),
                        borderColor: alpha(tokens.white, 0.18),
                      },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        minWidth: 0,
                        flex: 1,
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: 0,
                        textTransform: "uppercase",
                      }}
                    >
                      {group.label}
                    </Box>
                    {groupBadge > 0 ? (
                      <Chip
                        size="small"
                        label={groupBadge}
                        sx={{
                          height: 20,
                          mr: 0.5,
                          color: tokens.white,
                          bgcolor: alpha(tokens.burgundy, 0.72),
                          border: "1px solid",
                          borderColor: alpha(tokens.white, 0.14),
                        }}
                      />
                    ) : null}
                  </Button>
                )}
                <Collapse in={open} timeout="auto" unmountOnExit>
                  <List
                    sx={{
                      p: 0,
                      mt: 0.65,
                      display: "grid",
                      gap: 0.65,
                    }}
                  >
                    {group.items.map((item) => (
                      <Box key={item.id}>
                        {renderNavItem(item, compact, onClose)}
                      </Box>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      <Box>
        <Form method="post">
          <input type="hidden" name="intent" value="logout" />
          {compact ? (
            <Tooltip title="Sign out" placement="right">
              <IconButton
                type="submit"
                aria-label="Sign out"
                sx={{
                  width: "100%",
                  height: 48,
                  color: tokens.white,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.16),
                  bgcolor: alpha(tokens.white, 0.06),
                  borderRadius: 1.5,
                  "&:hover": { bgcolor: alpha(tokens.white, 0.12) },
                }}
              >
                <LogoutRounded />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              type="submit"
              color="inherit"
              startIcon={<LogoutRounded />}
              fullWidth
              sx={{
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.16),
                bgcolor: alpha(tokens.white, 0.06),
                "&:hover": { bgcolor: alpha(tokens.white, 0.12) },
              }}
            >
              Sign out
            </Button>
          )}
        </Form>
      </Box>
    </Stack>
  );

  const railSx = {
    bgcolor: tokens.charcoal,
    color: tokens.white,
    overflowX: "hidden",
    overflowY: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
    backgroundImage: `
      linear-gradient(${alpha(tokens.white, 0.055)} 1px, transparent 1px),
      linear-gradient(90deg, ${alpha(tokens.white, 0.055)} 1px, transparent 1px),
      linear-gradient(160deg, ${alpha(tokens.burgundy, 0.42)}, transparent 46%)
    `,
    backgroundSize: "34px 34px, 34px 34px, auto",
  };

  return (
    <>
      <Box
        component="aside"
        sx={{
          ...railSx,
          display: { xs: "none", lg: "block" },
          borderRight: "1px solid",
          borderColor: alpha(tokens.white, 0.12),
          position: "fixed",
          inset: "0 auto 0 0",
          width: collapsed ? adminRailCollapsedWidth : adminRailWidth,
          height: "100dvh",
          zIndex: 10,
          boxShadow: `18px 0 55px ${alpha(tokens.ink, 0.22)}`,
          transition: "width 220ms ease",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "adminRailSlide 520ms cubic-bezier(.2,.8,.2,1) both",
          },
        }}
      >
        {renderRailContent({ compact: collapsed })}
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              ...railSx,
              width: { xs: "min(90vw, 320px)", sm: 328 },
              maxWidth: "calc(100vw - 20px)",
              height: "100dvh",
              maxHeight: "100dvh",
              display: "block",
              borderRight: "1px solid",
              borderColor: alpha(tokens.white, 0.12),
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              scrollbarWidth: "thin",
              scrollbarColor: `${alpha(tokens.white, 0.34)} transparent`,
              "&::-webkit-scrollbar": {
                display: "block",
                width: 8,
              },
              "&::-webkit-scrollbar-thumb": {
                borderRadius: 999,
                bgcolor: alpha(tokens.white, 0.28),
              },
            },
          },
        }}
      >
        {renderRailContent({ compact: false, onClose: onCloseMobile })}
      </Drawer>
    </>
  );
}

function AdminTopBar({
  admin,
  currentSection,
  collapsed,
  darkChrome,
  notificationCount,
  onOpenMobileNav,
  onToggleCollapsed,
  onToggleDarkChrome,
  onSelect,
}: {
  admin: AdminSession;
  currentSection: AdminNavItem;
  collapsed: boolean;
  darkChrome: boolean;
  notificationCount: number;
  onOpenMobileNav: () => void;
  onToggleCollapsed: () => void;
  onToggleDarkChrome: () => void;
  onSelect: (section: Section) => void;
}) {
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const profileOpen = Boolean(profileAnchor);

  const closeProfileMenu = () => setProfileAnchor(null);
  const selectAndClose = (nextSection: Section) => {
    onSelect(nextSection);
    closeProfileMenu();
  };

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 2, md: 4 },
        py: { xs: 1, sm: 1.25 },
        borderBottom: "1px solid",
        borderColor: darkChrome
          ? alpha(tokens.white, 0.12)
          : alpha(tokens.ink, 0.09),
        bgcolor: darkChrome
          ? alpha(tokens.charcoal, 0.94)
          : alpha(tokens.white, 0.86),
        color: darkChrome ? tokens.white : tokens.ink,
        backgroundImage: darkChrome
          ? `linear-gradient(90deg, ${alpha(tokens.burgundy, 0.24)}, ${alpha(tokens.charcoal, 0.94)})`
          : `linear-gradient(90deg, ${alpha(tokens.white, 0.96)}, ${alpha(tokens.panel, 0.74)})`,
        position: "sticky",
        top: 0,
        zIndex: 3,
        backdropFilter: "blur(14px)",
        maxWidth: "100%",
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: 0.75, sm: 1.25 }}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: { xs: 52, sm: 58 },
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={{ xs: 0.75, sm: 1 }}
          sx={{ alignItems: "center", minWidth: 0, flex: "1 1 auto" }}
        >
          <Tooltip title="Open navigation">
            <IconButton
              aria-label="Open navigation"
              onClick={onOpenMobileNav}
              sx={{
                display: { xs: "inline-flex", lg: "none" },
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                color: "inherit",
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              <MenuRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <IconButton
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapsed}
              sx={{
                display: { xs: "none", lg: "inline-flex" },
                color: "inherit",
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              {collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}
            </IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
            <Typography
              variant="overline"
              sx={{
                color: darkChrome ? alpha(tokens.white, 0.68) : "primary.main",
                fontWeight: 900,
                display: { xs: "none", sm: "block" },
              }}
            >
              admin.xtiitch.com
            </Typography>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                lineHeight: 1.05,
                fontSize: { xs: "1.3rem", sm: "1.55rem" },
              }}
              noWrap
            >
              {currentSection.label}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 0.75 }}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <Tooltip title="Notifications">
            <IconButton
              aria-label="Open notifications"
              onClick={() => onSelect("notifications")}
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              <Badge badgeContent={notificationCount} color="error" max={99}>
                <NotificationsActiveRounded />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={darkChrome ? "Use light chrome" : "Use dark chrome"}>
            <IconButton
              aria-label="Toggle theme"
              onClick={onToggleDarkChrome}
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              {darkChrome ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Profile and settings">
            <IconButton
              aria-label="Open profile menu"
              onClick={(event) => setProfileAnchor(event.currentTarget)}
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
                p: 0.45,
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: darkChrome
                    ? alpha(tokens.white, 0.14)
                    : alpha(tokens.burgundy, 0.12),
                  color: darkChrome ? tokens.white : tokens.burgundy,
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                {admin.adminDisplayName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={profileAnchor}
            open={profileOpen}
            onClose={closeProfileMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: { xs: "calc(100vw - 32px)", sm: 250 },
                  maxWidth: "calc(100vw - 32px)",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: alpha(tokens.ink, 0.1),
                  boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.16)}`,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.4 }}>
              <Typography sx={{ fontWeight: 900 }} noWrap>
                {admin.adminDisplayName}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                {admin.adminEmail}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => selectAndClose("settings")}>
              <AccountCircleRounded sx={{ mr: 1.25 }} fontSize="small" />
              Profile settings
            </MenuItem>
            <MenuItem onClick={() => selectAndClose("settings")}>
              <SettingsRounded sx={{ mr: 1.25 }} fontSize="small" />
              Platform settings
            </MenuItem>
            <MenuItem onClick={() => selectAndClose("notifications")}>
              <NotificationsActiveRounded sx={{ mr: 1.25 }} fontSize="small" />
              Notification routing
            </MenuItem>
            <MenuItem onClick={() => selectAndClose("readiness")}>
              <AssignmentTurnedInRounded sx={{ mr: 1.25 }} fontSize="small" />
              Launch readiness
            </MenuItem>
            <MenuItem onClick={() => selectAndClose("audit")}>
              <HistoryRounded sx={{ mr: 1.25 }} fontSize="small" />
              Audit log
            </MenuItem>
            <Divider />
            <Form method="post">
              <input type="hidden" name="intent" value="logout" />
              <MenuItem
                component="button"
                type="submit"
                sx={{ width: "100%", color: tokens.danger }}
              >
                <LogoutRounded sx={{ mr: 1.25 }} fontSize="small" />
                Sign out
              </MenuItem>
            </Form>
          </Menu>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function AdminDashboard({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    admin,
    profileSettings,
    profileSettingsError,
    platformSettings,
    platformSettingsError,
    adminUsers,
    roleCatalog,
    permissionCatalog,
    userManagementError,
    verificationCases,
    verificationQueueError,
    adminBusinesses,
    businessManagementError,
    adminCustomers,
    customerDirectoryError,
    platformMetrics,
    platformMetricsError,
    operationsHealth,
    operationsHealthError,
    backendNotifications,
    backendNotificationsError,
    backendReportItems,
    backendReportsError,
    launchReadiness,
    launchReadinessError,
    moneyRails,
    moneyRailsError,
    subscriptions,
    subscriptionsError,
    plans,
    plansError,
    promotions,
    promotionsError,
    adCampaigns,
    adCampaignsError,
    affiliates,
    affiliatesError,
    affiliateAttribution,
    affiliateAttributionError,
    referralProgrammes,
    referralProgrammesError,
    riskReviews,
    riskReviewError,
    supportTickets,
    supportQueueError,
    auditEvents,
    auditLogError,
  } = loaderData;
  const actionFeedback = actionData as AdminActionFeedback | undefined;
  const [section, setSection] = useState<Section>(
    actionFeedback?.section === "users" ||
      actionFeedback?.section === "roles" ||
      actionFeedback?.section === "settings" ||
      actionFeedback?.section === "notifications" ||
      actionFeedback?.section === "reports" ||
      actionFeedback?.section === "exports" ||
      actionFeedback?.section === "health" ||
      actionFeedback?.section === "readiness" ||
      actionFeedback?.section === "subscriptions" ||
      actionFeedback?.section === "promotions" ||
      actionFeedback?.section === "ads" ||
      actionFeedback?.section === "affiliates" ||
      actionFeedback?.section === "referrals" ||
      actionFeedback?.section === "verification" ||
      actionFeedback?.section === "businesses" ||
      actionFeedback?.section === "customers" ||
      actionFeedback?.section === "money" ||
      actionFeedback?.section === "risk" ||
      actionFeedback?.section === "support"
      ? actionFeedback.section
      : "overview",
  );
  const [verificationNotes, setVerificationNotes] = useState<
    Record<string, string>
  >({});
  const [businessQuery, setBusinessQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedBusiness, setSelectedBusiness] =
    useState<AdminBusiness | null>(adminBusinesses[0] ?? null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<AdminCustomer | null>(adminCustomers[0] ?? null);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>(auditEvents);
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [darkChrome, setDarkChrome] = useState(false);

  const pendingCount = verificationCases.filter(
    (item) => item.status === "pending" || item.status === "unverified",
  ).length;
  const suspendedBusinessCount = adminBusinesses.filter(
    (business) => business.operationalStatus === "suspended",
  ).length;
  const metricCards = platformMetrics
    ? [
        {
          label: "GMV this month",
          value: formatGHS(platformMetrics.gmvMonthMinor),
          helper: "Succeeded platform payments",
          trend: `${platformMetrics.totalPayments30d} payments`,
        },
        {
          label: "Platform revenue",
          value: formatGHS(platformMetrics.platformRevenueMonthMinor),
          helper: "Commission collected",
          trend: "Month to date",
        },
        {
          label: "Active businesses",
          value: String(platformMetrics.activeBusinesses),
          helper: `${platformMetrics.totalBusinesses} total tenants`,
          trend: `${platformMetrics.pendingVerifications} KYC`,
        },
        {
          label: "Payment health",
          value: formatPercentBps(platformMetrics.paymentHealthBps),
          helper: `${platformMetrics.failedPayments30d} failed in 30 days`,
          trend: "Live",
        },
      ]
    : [];
  const urgentTickets = supportTickets.filter(
    (ticket) => ticket.priority === "urgent" && ticket.status === "open",
  ).length;
  const openRiskCount = riskReviews.filter(
    (review) => review.status === "open",
  ).length;
  const adminNotifications =
    backendNotifications.length > 0
      ? backendNotifications
      : buildAdminNotifications({
          verificationCases,
          moneyRails,
          platformMetrics,
          platformSettings,
          subscriptions,
          promotions,
          adCampaigns,
          affiliates,
          referralProgrammes,
          riskReviews,
          supportTickets,
          auditEvents,
        });
  const notificationCount = adminNotifications.filter(
    (notification) => notification.id !== "all-clear",
  ).length;
  const currentSection = navItems.find((item) => item.id === section) ?? {
    id: "overview",
    label: "Overview",
    helper: "Platform pulse",
    icon: <TrendingUpRounded />,
  };

  const filteredBusinesses = useMemo(() => {
    const query = businessQuery.trim().toLowerCase();
    return adminBusinesses.filter((business) => {
      const matchesStatus =
        statusFilter === "all" || business.status === statusFilter;
      const matchesQuery =
        !query ||
        business.name.toLowerCase().includes(query) ||
        business.handle.toLowerCase().includes(query) ||
        business.ownerEmail.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [adminBusinesses, businessQuery, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) {
      return adminCustomers;
    }
    return adminCustomers.filter((customer) => {
      return (
        customer.displayName.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query) ||
        customer.lastBusinessName.toLowerCase().includes(query) ||
        customer.lastBusinessHandle.toLowerCase().includes(query)
      );
    });
  }, [adminCustomers, customerQuery]);

  const filteredAuditLog = useMemo(() => {
    if (auditFilter === "all") {
      return auditLog;
    }
    return auditLog.filter((event) => event.severity === auditFilter);
  }, [auditFilter, auditLog]);
  const moneyWebhookEvents = moneyRails?.webhookEvents ?? [];
  const moneyPayoutReviews = moneyRails?.payoutReviews ?? [];

  useEffect(() => {
    setAuditLog(auditEvents);
  }, [auditEvents]);

  useEffect(() => {
    setSelectedBusiness((current) => {
      if (current) {
        const refreshed = adminBusinesses.find(
          (business) => business.id === current.id,
        );
        if (refreshed) {
          return refreshed;
        }
      }
      return adminBusinesses[0] ?? null;
    });
  }, [adminBusinesses]);

  useEffect(() => {
    setSelectedCustomer((current) => {
      if (current) {
        const refreshed = adminCustomers.find(
          (customer) => customer.id === current.id,
        );
        if (refreshed) {
          return refreshed;
        }
      }
      return adminCustomers[0] ?? null;
    });
  }, [adminCustomers]);

  const updateVerificationNote = (id: string, value: string) => {
    setVerificationNotes((current) => ({ ...current, [id]: value }));
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        overflowX: "hidden",
        bgcolor: darkChrome ? alpha(tokens.ink, 0.96) : "background.default",
        backgroundImage: darkChrome
          ? `
            radial-gradient(circle at 100% 0%, ${alpha(tokens.burgundy, 0.2)}, transparent 30%),
            radial-gradient(circle at 58% 12%, ${alpha(tokens.info, 0.16)}, transparent 28%),
            linear-gradient(180deg, ${tokens.ink}, ${tokens.charcoal})
          `
          : `
            radial-gradient(circle at 100% 0%, ${alpha(tokens.burgundy, 0.08)}, transparent 30%),
            radial-gradient(circle at 64% 18%, ${alpha(tokens.info, 0.06)}, transparent 28%),
            linear-gradient(180deg, ${tokens.cream}, ${alpha(tokens.panel, 0.78)})
          `,
        "@keyframes adminRailSlide": {
          from: { opacity: 0, transform: "translateX(-18px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "@keyframes adminRailDrop": {
          from: { opacity: 0, transform: "translateY(-10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes adminSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      <AdminRail
        adminDisplayName={admin.adminDisplayName}
        adminEmail={admin.adminEmail}
        adminRole={admin.adminRole}
        section={section}
        collapsed={railCollapsed}
        mobileOpen={mobileNavOpen}
        notificationCount={notificationCount}
        pendingCount={pendingCount}
        riskCount={openRiskCount}
        urgentTickets={urgentTickets}
        onCloseMobile={() => setMobileNavOpen(false)}
        onSelect={setSection}
      />
      <Box
        component="main"
        sx={{
          minWidth: 0,
          width: {
            xs: "100%",
            lg: `calc(100% - ${railCollapsed ? adminRailCollapsedWidth : adminRailWidth}px)`,
          },
          maxWidth: "100%",
          overflowX: "hidden",
          ml: {
            lg: `${railCollapsed ? adminRailCollapsedWidth : adminRailWidth}px`,
          },
          transition: "margin-left 220ms ease",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "adminSurfaceIn 520ms ease both",
          },
        }}
      >
        <AdminTopBar
          admin={admin}
          currentSection={currentSection}
          collapsed={railCollapsed}
          darkChrome={darkChrome}
          notificationCount={notificationCount}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onToggleCollapsed={() => setRailCollapsed((value) => !value)}
          onToggleDarkChrome={() => setDarkChrome((value) => !value)}
          onSelect={setSection}
        />

        <Box
          sx={{
            px: { xs: 1.25, sm: 2, md: 4 },
            py: { xs: 2, md: 4 },
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "hidden",
            "& form": { minWidth: 0 },
          }}
        >
          {profileSettingsError || platformSettingsError ? (
            <Stack spacing={1.25} sx={{ mb: 2.5 }}>
              {profileSettingsError ? (
                <Alert severity="warning">{profileSettingsError}</Alert>
              ) : null}
              {platformSettingsError ? (
                <Alert severity="warning">{platformSettingsError}</Alert>
              ) : null}
            </Stack>
          ) : null}

          {section === "overview" ? (
            <Stack spacing={3}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    xl: "repeat(4, 1fr)",
                  },
                }}
              >
                {metricCards.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </Box>
              {platformMetricsError ? (
                <Alert severity="warning">{platformMetricsError}</Alert>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gap: 3,
                  gridTemplateColumns: { xs: "1fr", xl: "1.25fr 0.75fr" },
                }}
              >
                <Panel sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    sx={{ justifyContent: "space-between", mb: 2 }}
                  >
                    <Box>
                      <Typography variant="h6">Verification queue</Typography>
                      <Typography sx={{ color: "text.secondary" }}>
                        {pendingCount} businesses need an operator decision
                        before money rails are enabled.
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      endIcon={<ArrowForwardRounded />}
                      onClick={() => setSection("verification")}
                    >
                      Review queue
                    </Button>
                  </Stack>
                  <Stack spacing={1.5}>
                    {verificationCases.length === 0 ? (
                      <Alert severity="info">
                        No business verification cases are waiting right now.
                      </Alert>
                    ) : null}
                    {verificationCases.slice(0, 2).map((item) => (
                      <Stack
                        key={item.id}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{
                          alignItems: { sm: "center" },
                          justifyContent: "space-between",
                          p: 1.5,
                          border: "1px solid",
                          borderColor: alpha(riskColor(item.riskLevel), 0.2),
                          borderRadius: 1.5,
                          bgcolor: alpha(tokens.white, 0.72),
                          backgroundImage: `linear-gradient(90deg, ${alpha(
                            riskColor(item.riskLevel),
                            0.08,
                          )}, transparent 34%)`,
                          transition:
                            "transform 180ms ease, border-color 180ms ease",
                          "&:hover": {
                            transform: "translateX(3px)",
                            borderColor: alpha(riskColor(item.riskLevel), 0.34),
                          },
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 900 }}>
                            {item.businessName}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {item.handle}.xtiitch.com · {item.documents.length}{" "}
                            docs
                          </Typography>
                        </Box>
                        <RiskChip level={item.riskLevel} />
                      </Stack>
                    ))}
                  </Stack>
                </Panel>

                <Panel
                  sx={{
                    p: { xs: 2, md: 3 },
                    borderColor: alpha(tokens.info, 0.16),
                    backgroundImage: `
                      radial-gradient(circle at 92% 0%, ${alpha(tokens.info, 0.14)}, transparent 34%),
                      linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                    `,
                  }}
                >
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "center" }}
                    >
                      <PaymentsRounded sx={{ color: tokens.burgundy }} />
                      <Box>
                        <Typography variant="h6">Money rail watch</Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          Paystack subaccounts, webhooks, and commission
                          settlement.
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider />
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Typography>Failed payments (30d)</Typography>
                        <Typography
                          sx={{ fontWeight: 900, color: tokens.warning }}
                        >
                          {platformMetrics?.failedPayments30d ?? 0}
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Typography>Suspended stores</Typography>
                        <Typography
                          sx={{ fontWeight: 900, color: tokens.danger }}
                        >
                          {suspendedBusinessCount}
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Typography>Urgent support</Typography>
                        <Typography sx={{ fontWeight: 900 }}>
                          {urgentTickets}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Panel>
              </Box>
            </Stack>
          ) : null}

          {section === "notifications" ? (
            <NotificationsSection
              notifications={adminNotifications}
              notificationsError={backendNotificationsError}
              preferences={profileSettings.preferences}
              onSelect={setSection}
            />
          ) : null}

          {section === "reports" ? (
            <ReportsSection
              platformMetrics={platformMetrics}
              platformSettings={platformSettings}
              backendReportItems={backendReportItems}
              backendReportsError={backendReportsError}
              adminBusinesses={adminBusinesses}
              verificationCases={verificationCases}
              moneyRails={moneyRails}
              subscriptions={subscriptions}
              promotions={promotions}
              adCampaigns={adCampaigns}
              affiliates={affiliates}
              referralProgrammes={referralProgrammes}
              riskReviews={riskReviews}
              supportTickets={supportTickets}
              auditEvents={auditEvents}
              onSelect={setSection}
            />
          ) : null}

          {section === "exports" ? (
            <ExportsSection
              platformMetrics={platformMetrics}
              platformSettings={platformSettings}
              profileSettings={profileSettings}
              launchReadiness={launchReadiness}
              adminUsers={adminUsers}
              adminBusinesses={adminBusinesses}
              adminCustomers={adminCustomers}
              verificationCases={verificationCases}
              moneyRails={moneyRails}
              roleCatalog={roleCatalog}
              plans={plans}
              subscriptions={subscriptions}
              promotions={promotions}
              adCampaigns={adCampaigns}
              affiliates={affiliates}
              referralProgrammes={referralProgrammes}
              riskReviews={riskReviews}
              supportTickets={supportTickets}
              auditEvents={auditEvents}
              onSelect={setSection}
            />
          ) : null}

          {section === "health" ? (
            <HealthSection
              platformMetrics={platformMetrics}
              platformSettings={platformSettings}
              adminUsers={adminUsers}
              adminBusinesses={adminBusinesses}
              verificationCases={verificationCases}
              moneyRails={moneyRails}
              subscriptions={subscriptions}
              promotions={promotions}
              adCampaigns={adCampaigns}
              affiliates={affiliates}
              referralProgrammes={referralProgrammes}
              riskReviews={riskReviews}
              supportTickets={supportTickets}
              auditEvents={auditEvents}
              operationsHealth={operationsHealth}
              operationsHealthError={operationsHealthError}
              onSelect={setSection}
            />
          ) : null}

          {section === "readiness" ? (
            <LaunchReadinessSection
              readiness={launchReadiness}
              readinessError={launchReadinessError}
              onSelect={setSection}
            />
          ) : null}

          {section === "subscriptions" ? (
            <SubscriptionsSection
              subscriptions={subscriptions}
              subscriptionsError={subscriptionsError}
              plans={plans}
              plansError={plansError}
              platformMetrics={platformMetrics}
              actionData={actionFeedback}
              onSelect={setSection}
            />
          ) : null}

          {section === "promotions" ? (
            <PromotionsSection
              promotions={promotions}
              promotionsError={promotionsError}
              businesses={adminBusinesses}
              actionData={actionFeedback}
            />
          ) : null}

          {section === "ads" ? (
            <AdsSection
              campaigns={adCampaigns}
              adCampaignsError={adCampaignsError}
              businesses={adminBusinesses}
              actionData={actionFeedback}
            />
          ) : null}

          {section === "affiliates" ? (
            <AffiliatesSection
              affiliates={affiliates}
              affiliatesError={affiliatesError}
              affiliateAttribution={affiliateAttribution}
              affiliateAttributionError={affiliateAttributionError}
              actionData={actionFeedback}
            />
          ) : null}

          {section === "referrals" ? (
            <ReferralsSection
              programmes={referralProgrammes}
              referralProgrammesError={referralProgrammesError}
              businesses={adminBusinesses}
              actionData={actionFeedback}
            />
          ) : null}

          {section === "users" ? (
            <AdminUsersSection
              users={adminUsers}
              roles={roleCatalog}
              currentUserId={admin.adminUserId}
              actionData={actionFeedback}
              error={userManagementError}
            />
          ) : null}

          {section === "roles" ? (
            <RolePermissionsSection
              roles={roleCatalog}
              permissions={permissionCatalog}
              actionData={actionFeedback}
            />
          ) : null}

          {section === "settings" ? (
            <SettingsSection
              admin={admin}
              profileSettings={profileSettings}
              profileSettingsError={profileSettingsError}
              platformSettings={platformSettings}
              platformSettingsError={platformSettingsError}
              roles={roleCatalog}
              actionData={actionFeedback}
            />
          ) : null}

          {section === "verification" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="KYC and business review"
                title="Payment verification queue"
                helper="Approve only when business identity, settlement account, and operator notes are clean."
              />
              {actionFeedback?.section === "verification" &&
              actionFeedback.message ? (
                <Alert severity={actionFeedback.severity ?? "success"}>
                  {actionFeedback.message}
                </Alert>
              ) : null}
              {verificationQueueError ? (
                <Alert severity="warning">{verificationQueueError}</Alert>
              ) : null}
              {verificationCases.length === 0 && !verificationQueueError ? (
                <Panel sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={1}>
                    <Typography variant="h6">No verification cases</Typography>
                    <Typography sx={{ color: "text.secondary" }}>
                      New businesses will appear here as soon as they need an
                      operator decision.
                    </Typography>
                  </Stack>
                </Panel>
              ) : null}
              {verificationCases.map((item) => (
                <VerificationCard
                  key={item.id}
                  item={item}
                  note={verificationNotes[item.id] ?? ""}
                  onNoteChange={updateVerificationNote}
                />
              ))}
            </Stack>
          ) : null}

          {section === "businesses" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Tenant operations"
                title="Businesses"
                helper="Search stores, monitor GMV and commission, and suspend risky tenants without touching customer data."
              />
              {actionFeedback?.section === "businesses" &&
              actionFeedback.message ? (
                <Alert severity={actionFeedback.severity ?? "success"}>
                  {actionFeedback.message}
                </Alert>
              ) : null}
              {businessManagementError ? (
                <Alert severity="warning">{businessManagementError}</Alert>
              ) : null}
              <Panel sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <TextField
                    label="Search business"
                    value={businessQuery}
                    onChange={(event) => setBusinessQuery(event.target.value)}
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRounded />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    select
                    label="Status"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                    sx={{ minWidth: { md: 220 } }}
                  >
                    {statusFilters.map((filter) => (
                      <MenuItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </Panel>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    xl: "minmax(0, 1fr) 380px",
                  },
                }}
              >
                <Stack spacing={1.5}>
                  {filteredBusinesses.map((business) => (
                    <BusinessRow
                      key={business.id}
                      business={business}
                      selected={selectedBusiness?.id === business.id}
                      onInspect={setSelectedBusiness}
                    />
                  ))}
                  {filteredBusinesses.length === 0 ? (
                    <Panel sx={{ p: 3, textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 800 }}>
                        No businesses match this view.
                      </Typography>
                      <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                        Clear the search or choose another status.
                      </Typography>
                    </Panel>
                  ) : null}
                </Stack>
                <BusinessInspector
                  business={selectedBusiness}
                  onReviewPayments={() => setSection("money")}
                  onOpenAudit={() => setSection("audit")}
                  onClose={() => setSelectedBusiness(null)}
                />
              </Box>
            </Stack>
          ) : null}

          {section === "customers" ? (
            <CustomerDirectoryPanel
              customers={adminCustomers}
              visibleCustomers={filteredCustomers}
              selectedCustomer={selectedCustomer}
              query={customerQuery}
              error={customerDirectoryError}
              onQueryChange={setCustomerQuery}
              onInspect={setSelectedCustomer}
              onCloseInspector={() => setSelectedCustomer(null)}
            />
          ) : null}

          {section === "money" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Paystack operations"
                title="Money rails"
                helper="Watch webhook delivery, split settlement, subaccount health, and payout holds without touching tenant funds."
              />
              {moneyRailsError ? (
                <Alert severity="warning">{moneyRailsError}</Alert>
              ) : null}
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", xl: "1.08fr 0.92fr" },
                }}
              >
                <Panel
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    borderColor: alpha(tokens.info, 0.16),
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", mb: 2 }}
                  >
                    <SyncRounded sx={{ color: tokens.burgundy }} />
                    <Box>
                      <Typography variant="h6">Webhook ledger</Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        Verified events, failed lookups, and safe replays.
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1.5}>
                    {moneyWebhookEvents.map((event) => {
                      const replayed = event.status === "replayed";
                      return (
                        <Box
                          key={event.id}
                          sx={{
                            p: 1.5,
                            border: "1px solid",
                            borderColor: alpha(
                              replayed
                                ? tokens.info
                                : webhookColor(event.status),
                              0.2,
                            ),
                            borderRadius: 1.5,
                            bgcolor: alpha(tokens.white, 0.7),
                            backgroundImage: `linear-gradient(90deg, ${alpha(
                              replayed
                                ? tokens.info
                                : webhookColor(event.status),
                              0.075,
                            )}, transparent 36%)`,
                            transition:
                              "transform 180ms ease, border-color 180ms ease",
                            "&:hover": {
                              transform: "translateX(3px)",
                              borderColor: alpha(
                                replayed
                                  ? tokens.info
                                  : webhookColor(event.status),
                                0.34,
                              ),
                            },
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1.5}
                            sx={{ justifyContent: "space-between" }}
                          >
                            <Box>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: "center", flexWrap: "wrap" }}
                              >
                                <Typography sx={{ fontWeight: 900 }}>
                                  {event.providerReference}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={
                                    replayed ? "replay queued" : event.status
                                  }
                                  sx={{
                                    bgcolor: alpha(
                                      replayed
                                        ? tokens.info
                                        : webhookColor(event.status),
                                      0.12,
                                    ),
                                    color: replayed
                                      ? tokens.info
                                      : webhookColor(event.status),
                                    textTransform: "capitalize",
                                  }}
                                />
                              </Stack>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary", mt: 0.5 }}
                              >
                                {event.business} · {event.purpose} ·{" "}
                                {formatGHS(event.amountMinor)} ·{" "}
                                {event.attempts} attempts
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {event.note}
                              </Typography>
                            </Box>
                            <Stack
                              spacing={1}
                              sx={{ alignItems: { md: "flex-end" } }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 800,
                                }}
                              >
                                {shortTime(event.receivedAt)}
                              </Typography>
                              <Form method="post">
                                <input
                                  type="hidden"
                                  name="intent"
                                  value="money:webhook-replay"
                                />
                                <input
                                  type="hidden"
                                  name="provider_reference"
                                  value={event.providerReference}
                                />
                                <input
                                  type="hidden"
                                  name="reason"
                                  value={event.note}
                                />
                                <Button
                                  type="submit"
                                  variant="outlined"
                                  size="small"
                                  startIcon={<SyncRounded />}
                                  disabled={
                                    event.status === "verified" || replayed
                                  }
                                >
                                  {replayed ? "Queued" : "Replay"}
                                </Button>
                              </Form>
                              {event.status === "verified" ? (
                                <Form method="post">
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value="money:payment-reversal"
                                  />
                                  <input
                                    type="hidden"
                                    name="provider_reference"
                                    value={event.providerReference}
                                  />
                                  <input
                                    type="hidden"
                                    name="reason"
                                    value="Refund or dispute confirmed by provider."
                                  />
                                  <Button
                                    type="submit"
                                    variant="outlined"
                                    color="warning"
                                    size="small"
                                  >
                                    Reverse
                                  </Button>
                                </Form>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                    {moneyWebhookEvents.length === 0 ? (
                      <Box
                        sx={{
                          p: 2,
                          border: "1px dashed",
                          borderColor: alpha(tokens.info, 0.28),
                          borderRadius: 1.5,
                          bgcolor: alpha(tokens.white, 0.68),
                        }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          No provider events yet.
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.5, color: "text.secondary" }}
                        >
                          Paystack webhook deliveries will appear here after
                          checkout confirmations reach the API.
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>
                </Panel>

                <Panel
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    borderColor: alpha(tokens.warning, 0.16),
                    backgroundImage: `
                      radial-gradient(circle at 92% 2%, ${alpha(tokens.warning, 0.14)}, transparent 34%),
                      linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                    `,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", mb: 2 }}
                  >
                    <AccountBalanceRounded sx={{ color: tokens.burgundy }} />
                    <Box>
                      <Typography variant="h6">Settlement review</Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        Subaccount status and operator holds.
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1.5}>
                    {moneyPayoutReviews.map((review) => {
                      const held = review.holdActive;
                      const blockedByBusinessState =
                        review.status === "blocked" && !review.holdActive;
                      return (
                        <Box
                          key={review.id}
                          sx={{
                            p: 1.5,
                            border: "1px solid",
                            borderColor: held
                              ? alpha(tokens.danger, 0.32)
                              : alpha(payoutColor(review.status), 0.2),
                            borderRadius: 1.5,
                            bgcolor: held
                              ? alpha(tokens.danger, 0.04)
                              : alpha(tokens.white, 0.72),
                            backgroundImage: `linear-gradient(90deg, ${alpha(
                              held ? tokens.danger : payoutColor(review.status),
                              0.075,
                            )}, transparent 38%)`,
                            transition:
                              "transform 180ms ease, border-color 180ms ease",
                            "&:hover": {
                              transform: "translateX(3px)",
                              borderColor: alpha(
                                held
                                  ? tokens.danger
                                  : payoutColor(review.status),
                                0.34,
                              ),
                            },
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Box>
                                <Typography sx={{ fontWeight: 900 }}>
                                  {review.business}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ color: "text.secondary" }}
                                >
                                  {review.subaccountRef}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                label={held ? "held" : review.status}
                                sx={{
                                  bgcolor: alpha(
                                    held
                                      ? tokens.danger
                                      : payoutColor(review.status),
                                    0.12,
                                  ),
                                  color: held
                                    ? tokens.danger
                                    : payoutColor(review.status),
                                  textTransform: "capitalize",
                                }}
                              />
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ justifyContent: "space-between" }}
                            >
                              <Typography variant="body2">
                                Settlement
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 900 }}
                              >
                                {formatGHS(review.settlementMinor)}
                              </Typography>
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ justifyContent: "space-between" }}
                            >
                              <Typography variant="body2">
                                Commission
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 900 }}
                              >
                                {formatGHS(review.commissionMinor)}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                            >
                              {review.nextAction}
                            </Typography>
                            <Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="money:settlement-hold"
                              />
                              <input
                                type="hidden"
                                name="business_id"
                                value={review.id}
                              />
                              <input
                                type="hidden"
                                name="hold"
                                value={held ? "false" : "true"}
                              />
                              <input
                                type="hidden"
                                name="reason"
                                value={
                                  held
                                    ? "Operator released settlement review hold."
                                    : review.nextAction
                                }
                              />
                              <Button
                                type="submit"
                                variant={held ? "contained" : "outlined"}
                                color={held ? "primary" : "error"}
                                size="small"
                                startIcon={
                                  held ? (
                                    <CheckCircleRounded />
                                  ) : (
                                    <BlockRounded />
                                  )
                                }
                                disabled={blockedByBusinessState}
                              >
                                {blockedByBusinessState
                                  ? "Blocked by status"
                                  : held
                                    ? "Release hold"
                                    : "Place review hold"}
                              </Button>
                            </Form>
                          </Stack>
                        </Box>
                      );
                    })}
                    {moneyPayoutReviews.length === 0 ? (
                      <Box
                        sx={{
                          p: 2,
                          border: "1px dashed",
                          borderColor: alpha(tokens.warning, 0.28),
                          borderRadius: 1.5,
                          bgcolor: alpha(tokens.white, 0.68),
                        }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          No settlement rows yet.
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.5, color: "text.secondary" }}
                        >
                          Verified stores with subaccounts or payment activity
                          will appear here for operator review.
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>
                </Panel>
              </Box>
            </Stack>
          ) : null}

          {section === "risk" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Trust and compliance"
                title="Risk review"
                helper="Open issues for payment integrity, tenant isolation evidence, complaints, and manual escalation."
              />
              {actionFeedback?.section === "risk" && actionFeedback.message ? (
                <Alert severity={actionFeedback.severity ?? "success"}>
                  {actionFeedback.message}
                </Alert>
              ) : null}
              {riskReviewError ? (
                <Alert severity="warning">{riskReviewError}</Alert>
              ) : null}
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", xl: "repeat(3, 1fr)" },
                }}
              >
                {riskReviews.map((item) => {
                  const closed = item.status === "closed";
                  return (
                    <Panel
                      key={item.id}
                      sx={{
                        p: 2.5,
                        minHeight: "100%",
                        borderColor: alpha(riskColor(item.level), 0.22),
                        backgroundImage: `
                          radial-gradient(circle at 100% 0%, ${alpha(riskColor(item.level), closed ? 0.06 : 0.12)}, transparent 34%),
                          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                        `,
                        opacity: closed ? 0.72 : 1,
                        "&:hover": {
                          transform: "translateY(-2px)",
                          borderColor: alpha(riskColor(item.level), 0.36),
                          boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
                        },
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Stack direction="row" spacing={1}>
                            <RiskChip level={item.level} />
                            {closed ? (
                              <Chip
                                size="small"
                                label="closed"
                                sx={{ color: tokens.success }}
                              />
                            ) : null}
                          </Stack>
                          <Chip
                            size="small"
                            label={item.owner}
                            variant="outlined"
                          />
                        </Stack>
                        <Box>
                          <Typography variant="h6">{item.title}</Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {item.business}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: "text.secondary" }}>
                          {item.reason}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          Updated {shortTime(item.updatedAt)}
                        </Typography>
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="admin-risk-review:update"
                          />
                          <input
                            type="hidden"
                            name="review_key"
                            value={item.id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value={closed ? "open" : "closed"}
                          />
                          <input
                            type="hidden"
                            name="reason"
                            value={
                              closed
                                ? `Reopened ${item.title}`
                                : `Closed ${item.title}`
                            }
                          />
                          <Button
                            type="submit"
                            variant={closed ? "contained" : "outlined"}
                            startIcon={
                              closed ? (
                                <CheckCircleRounded />
                              ) : (
                                <PersonSearchRounded />
                              )
                            }
                            fullWidth
                          >
                            {closed ? "Reopen review" : "Close review"}
                          </Button>
                        </Form>
                      </Stack>
                    </Panel>
                  );
                })}
                {!riskReviewError && riskReviews.length === 0 ? (
                  <Box
                    sx={{
                      p: 2,
                      border: "1px dashed",
                      borderColor: alpha(tokens.success, 0.28),
                      borderRadius: 1.5,
                      bgcolor: alpha(tokens.white, 0.68),
                    }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      No active risk signals.
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.5, color: "text.secondary" }}
                    >
                      Payment failures, active holds, suspended stores, and
                      rejected verification cases will appear here.
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Stack>
          ) : null}

          {section === "support" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Operator support"
                title="Support queue"
                helper="Prioritise payment, delivery, and tracking issues before they become trust problems."
              />
              {actionFeedback?.section === "support" &&
              actionFeedback.message ? (
                <Alert severity={actionFeedback.severity ?? "success"}>
                  {actionFeedback.message}
                </Alert>
              ) : null}
              {supportQueueError ? (
                <Alert severity="warning">{supportQueueError}</Alert>
              ) : null}
              <Stack spacing={1.5}>
                {supportTickets.map((ticket) => {
                  const resolved = ticket.status === "resolved";
                  const assignedToMe =
                    ticket.assignedAdminEmail === admin.adminEmail;
                  const assignee =
                    ticket.assignedAdminName || ticket.assignedAdminEmail;
                  return (
                    <Panel
                      key={ticket.id}
                      sx={{
                        p: 2.5,
                        borderColor: alpha(
                          ticket.priority === "urgent"
                            ? tokens.danger
                            : tokens.info,
                          ticket.priority === "urgent" ? 0.28 : 0.18,
                        ),
                        backgroundImage: `
                          linear-gradient(90deg, ${alpha(
                            ticket.priority === "urgent"
                              ? tokens.danger
                              : tokens.info,
                            ticket.priority === "urgent" ? 0.09 : 0.06,
                          )}, transparent 38%),
                          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                        `,
                        opacity: resolved ? 0.72 : 1,
                        "&:hover": {
                          transform: "translateY(-2px)",
                          boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.09)}`,
                        },
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Typography variant="h6">
                              {ticket.subject}
                            </Typography>
                            <Chip
                              size="small"
                              label={ticket.priority}
                              sx={{
                                bgcolor: alpha(
                                  ticket.priority === "urgent"
                                    ? tokens.danger
                                    : tokens.info,
                                  0.12,
                                ),
                                color:
                                  ticket.priority === "urgent"
                                    ? tokens.danger
                                    : tokens.info,
                                textTransform: "capitalize",
                              }}
                            />
                            {resolved ? (
                              <Chip
                                size="small"
                                label="resolved"
                                sx={{ color: tokens.success }}
                              />
                            ) : null}
                          </Stack>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {ticket.category} · {ticket.business} · opened{" "}
                            {shortTime(ticket.createdAt)}
                          </Typography>
                          <Typography sx={{ mt: 1 }}>
                            {ticket.summary}
                          </Typography>
                          {assignee ? (
                            <Chip
                              size="small"
                              icon={<AssignmentTurnedInRounded />}
                              label={`Assigned to ${assignee}`}
                              sx={{
                                mt: 1.5,
                                bgcolor: alpha(tokens.success, 0.1),
                                color: tokens.success,
                              }}
                            />
                          ) : null}
                        </Box>
                        <Stack
                          direction={{ xs: "row", md: "column" }}
                          spacing={1}
                          sx={{
                            alignSelf: { md: "center" },
                            flexWrap: "wrap",
                            minWidth: { md: 180 },
                          }}
                        >
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="admin-support-ticket:update"
                            />
                            <input
                              type="hidden"
                              name="ticket_key"
                              value={ticket.id}
                            />
                            <input type="hidden" name="status" value="open" />
                            <input
                              type="hidden"
                              name="assignment"
                              value={assignedToMe ? "unassigned" : "self"}
                            />
                            <input
                              type="hidden"
                              name="note"
                              value={
                                assignedToMe
                                  ? `Unassigned ${ticket.subject}`
                                  : `Assigned ${ticket.subject}`
                              }
                            />
                            <Button
                              type="submit"
                              variant={assignedToMe ? "outlined" : "contained"}
                              startIcon={<SupportAgentRounded />}
                              fullWidth
                            >
                              {assignedToMe ? "Unassign" : "Assign to me"}
                            </Button>
                          </Form>
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="admin-support-ticket:update"
                            />
                            <input
                              type="hidden"
                              name="ticket_key"
                              value={ticket.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value={resolved ? "open" : "resolved"}
                            />
                            <input
                              type="hidden"
                              name="assignment"
                              value="unchanged"
                            />
                            <input
                              type="hidden"
                              name="note"
                              value={
                                resolved
                                  ? `Reopened ${ticket.subject}`
                                  : `Resolved ${ticket.subject}`
                              }
                            />
                            <Button
                              type="submit"
                              variant="outlined"
                              startIcon={
                                resolved ? (
                                  <SupportAgentRounded />
                                ) : (
                                  <CheckCircleRounded />
                                )
                              }
                              fullWidth
                            >
                              {resolved ? "Reopen" : "Resolve"}
                            </Button>
                          </Form>
                        </Stack>
                      </Stack>
                    </Panel>
                  );
                })}
                {!supportQueueError && supportTickets.length === 0 ? (
                  <Box
                    sx={{
                      p: 2,
                      border: "1px dashed",
                      borderColor: alpha(tokens.success, 0.28),
                      borderRadius: 1.5,
                      bgcolor: alpha(tokens.white, 0.68),
                    }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      No support tickets need action.
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.5, color: "text.secondary" }}
                    >
                      Failed payments, delayed messages, stale orders, overdue
                      visits, and handover follow-ups will appear here.
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
            </Stack>
          ) : null}

          {section === "audit" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Operator accountability"
                title="Audit log"
                helper="Every sensitive operator decision should be attributable, reviewable, and ready for compliance export."
              />
              {auditLogError ? (
                <Alert severity="warning">{auditLogError}</Alert>
              ) : null}
              <Panel sx={{ p: 2 }}>
                <TextField
                  select
                  label="Severity"
                  value={auditFilter}
                  onChange={(event) =>
                    setAuditFilter(event.target.value as AuditFilter)
                  }
                  sx={{ minWidth: { xs: "100%", sm: 220 } }}
                >
                  {auditFilters.map((filter) => (
                    <MenuItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Panel>
              <Stack spacing={1.5}>
                {filteredAuditLog.map((event) => (
                  <Panel
                    key={event.id}
                    sx={{
                      p: 2,
                      borderColor: alpha(auditColor(event.severity), 0.18),
                      backgroundImage: `linear-gradient(90deg, ${alpha(
                        auditColor(event.severity),
                        0.065,
                      )}, transparent 36%)`,
                      "&:hover": {
                        transform: "translateY(-2px)",
                        borderColor: alpha(auditColor(event.severity), 0.32),
                        boxShadow: `0 18px 48px ${alpha(tokens.ink, 0.085)}`,
                      },
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      sx={{ justifyContent: "space-between", minWidth: 0 }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: "flex-start", minWidth: 0 }}
                      >
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 1.5,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: alpha(auditColor(event.severity), 0.12),
                            color: auditColor(event.severity),
                            flex: "0 0 auto",
                          }}
                        >
                          <HistoryRounded />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Typography sx={{ fontWeight: 900 }}>
                              {event.action}
                            </Typography>
                            <Chip
                              size="small"
                              label={event.severity}
                              sx={{
                                bgcolor: alpha(
                                  auditColor(event.severity),
                                  0.12,
                                ),
                                color: auditColor(event.severity),
                                textTransform: "capitalize",
                              }}
                            />
                          </Stack>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {event.target} · {event.actor}
                          </Typography>
                          <Typography
                            sx={{ mt: 0.75, overflowWrap: "anywhere" }}
                          >
                            {event.detail}
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shortTime(event.createdAt)}
                      </Typography>
                    </Stack>
                  </Panel>
                ))}
              </Stack>
            </Stack>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

function SectionHeader({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper: string;
}) {
  return (
    <Stack
      spacing={0.5}
      sx={{
        position: "relative",
        pl: 2,
        py: 0.35,
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          width: 4,
          borderRadius: 6,
          bgcolor: tokens.burgundy,
          boxShadow: `0 10px 24px ${alpha(tokens.burgundy, 0.24)}`,
        },
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: "primary.main", fontWeight: 900 }}
      >
        {eyebrow}
      </Typography>
      <Typography variant="h5">{title}</Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 760 }}>
        {helper}
      </Typography>
    </Stack>
  );
}
