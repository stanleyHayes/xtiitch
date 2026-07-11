import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { tokens } from "../../theme";
import {
  AdminReportItem,
  AuditEvent,
  Section,
  AdminPlatformMetrics,
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
} from "../shared/types";
import { formatGHS, formatPercentBps } from "../shared/formatting";
import { auditColor, reportStatusColor } from "../shared/colors";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import { DetailLine } from "../shared/DetailLine";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function ReportsSection({
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
  const {
    page: reportPage,
    pageCount: reportPageCount,
    pagedItems: pagedReportItems,
    setPage: setReportPage,
  } = usePagedItems(reportItems, 7, backendReportItems.length);
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
              {pagedReportItems.map((item) => {
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
            <PaginationFooter
              count={reportPageCount}
              label="report rows"
              page={reportPage}
              pageSize={7}
              total={reportItems.length}
              onChange={setReportPage}
            />
          </Stack>
        </Panel>

        <Stack spacing={2.5}>
          <Panel
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(tokens.info, 0.16),
              backgroundImage: `
                radial-gradient(circle at 96% 0%, ${alpha(tokens.info, 0.14)}, transparent 34%),
                linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
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
