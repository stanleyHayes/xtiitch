import type { Section } from "./navigation";

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
