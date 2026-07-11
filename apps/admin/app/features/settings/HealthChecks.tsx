import {
  AdminReportItem,
  AuditEvent,
  Section,
  AdminPlatformMetrics,
  AdminPlatformSettings,
  AdminUser,
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
  AdminOperationsHealth,
} from "../shared/types";
import { formatGHS, formatPercentBps } from "../shared/formatting";

export function useHealthChecks({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
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

  return {
    healthSignals,
    blockedCount,
    watchCount,
    healthScore,
    paymentHealthMetric,
    failedWebhookMetric,
    payoutHoldMetric,
    trustPressureMetric,
    urgentSupportMetric,
    auditEventMetric,
    criticalAuditMetric,
  };
}
