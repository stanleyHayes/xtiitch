import type {
  AdminNotificationCategory,
  AdminProfileSettings,
} from "../types";

export function notificationCategoryLabel(
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

export function notificationCategoryWatched(
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
