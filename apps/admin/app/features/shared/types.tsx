import type { ReactNode } from "react";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import CampaignRounded from "@mui/icons-material/CampaignRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import type {
  AdminVerificationDecision,
  AdminBusinessStatus,
  AdminAuditEvent,
  AdminAuditSeverity,
} from "../../lib/api";
export type * from "../../lib/api";

export type Section =
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
  | "waitlist"
  | "audit";



// Sections are reflected in the URL (?section=…) so operators can deep-link,
// bookmark and use browser back/forward across the console.
export const KNOWN_SECTIONS: readonly Section[] = [
  "overview",
  "notifications",
  "reports",
  "exports",
  "health",
  "readiness",
  "subscriptions",
  "promotions",
  "ads",
  "affiliates",
  "referrals",
  "users",
  "roles",
  "verification",
  "businesses",
  "customers",
  "money",
  "risk",
  "support",
  "settings",
  "waitlist",
  "audit",
];


export function sectionFromParam(value: string | null): Section | null {
  return value && (KNOWN_SECTIONS as readonly string[]).includes(value)
    ? (value as Section)
    : null;
}


export type Decision = AdminVerificationDecision;


export type StatusFilter = "all" | AdminBusinessStatus;


export type AuditEvent = AdminAuditEvent;


export type AuditSeverity = AdminAuditSeverity;


export type AuditFilter = "all" | AuditSeverity;


export type AdminActionFeedback = {
  section?: Section;
  severity?: "success" | "error" | "warning" | "info";
  message?: string;
  detail?: string;
  href?: string;
  hrefLabel?: string;
};


export type AdminNotificationTone = "critical" | "warning" | "info" | "success";


export type AdminNotificationCategory =
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


export type AdminNotificationFilter = "all" | AdminNotificationCategory;


export type AdminNotification = {
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


export type AdminReportStatus = "ready" | "watch" | "blocked";


export type AdminExportDatasetId =
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


export type AdminReportItem = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminReportStatus;
  target: Section;
  targetLabel: string;
};


export type AdminExportDataset = {
  id: AdminExportDatasetId;
  title: string;
  helper: string;
  source: Section;
  sourceLabel: string;
  rows: (string | number)[][];
  tone: AdminReportStatus;
};



export type EntitlementFormRow = {
  planId: string;
  featureKey: string;
  valueType: "boolean" | "limit";
};



export type AdminNavItem = {
  id: Section;
  label: string;
  helper: string;
  icon: ReactNode;
};



export type AdminNavGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  items: AdminNavItem[];
};



export const adminRailWidth = 296;


export const adminRailCollapsedWidth = 88;



export const navItems: AdminNavItem[] = [
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
    id: "waitlist",
    label: "Waitlist",
    helper: "Launch signups",
    icon: <GroupAddRounded />,
  },
  {
    id: "audit",
    label: "Audit log",
    helper: "Operator trail",
    icon: <HistoryRounded />,
  },
];



export function adminNavItem(id: Section): AdminNavItem {
  const item = navItems.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Missing admin nav item: ${id}`);
  }
  return item;
}



export function adminNavItems(ids: Section[]): AdminNavItem[] {
  return ids.map((id) => adminNavItem(id));
}



// Overview is rendered standalone at the top of the rail (see renderNavItem in
// the sidebar). The remaining groups flow in order, with Command last — it is no
// longer pinned to the bottom.
export const adminOverviewNavId: Section = "overview";



export const adminNavGroups: AdminNavGroup[] = [
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
    items: adminNavItems([
      "money",
      "risk",
      "support",
      "settings",
      "waitlist",
      "audit",
    ]),
  },
  {
    id: "command",
    label: "Command",
    icon: <TrendingUpRounded />,
    items: adminNavItems([
      "notifications",
      "reports",
      "exports",
      "health",
      "readiness",
    ]),
  },
];



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



export const serverExportDatasetIds: AdminExportDatasetId[] = [
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



export type AdminLoadResult<T> = {
  data: T;
  error: string | null;
};



export const ADMIN_PAGE_SIZE = 8;
