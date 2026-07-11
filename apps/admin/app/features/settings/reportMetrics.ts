import type {
  AdminReportItem,
  AdminPlatformSettings,
  AdminBusiness,
  AdminVerificationCase,
  AdminMoneyRails,
  AdminSubscription,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
  AdminRiskReview,
  AdminSupportTicket,
  AuditEvent,
} from "../shared/types";
import { formatGHS } from "../shared/formatting";

export function buildReportMetrics({ // eslint-disable-line complexity, max-lines-per-function -- dataset builder with many conditional branches; refactor in follow-up
  platformSettings,
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
}: {
  platformSettings: AdminPlatformSettings;
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

  return {
    pendingKyc,
    payoutReviews,
    failedWebhooks,
    openRisks,
    urgentSupport,
    suspendedBusinesses,
    derivedReportItems,
    criticalAudit,
    warningAudit,
  };
}
