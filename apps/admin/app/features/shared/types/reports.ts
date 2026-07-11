import type { Section } from "./navigation";

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
