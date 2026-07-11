import type {
  AdminNotification,
  AdminNotificationTone,
  AuditEvent,
  AdminVerificationCase,
  AdminMoneyRails,
  AdminPlatformMetrics,
  AdminPlatformSettings,
  AdminSubscription,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
  AdminRiskReview,
  AdminSupportTicket,
} from "../types";
import { formatGHS } from "../formatting";
import { shortTime } from "../dates";
import {
  billingModeLabel,
  subscriptionStatusLabel,
} from "../../subscriptions/utils";
import {
  adPlacementLabel,
  affiliateCommissionLabel,
  affiliatePayoutLabel,
  referralAudienceLabel,
  referralRewardLabel,
  referralStatusLabel,
} from "../../growth/utils";

export {
  notificationCategoryLabel,
  notificationCategoryWatched,
} from "./categories";

export function buildAdminNotifications({ // eslint-disable-line max-lines-per-function -- large function with conditional branches; refactor in follow-up
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
