import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
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
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { ReportList } from "./ReportList";
import { ComplianceSnapshot } from "./ComplianceSnapshot";
import { RecentAuditEvidence } from "./RecentAuditEvidence";
import { buildReportMetrics } from "./reportMetrics";

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
  const {
    pendingKyc,
    payoutReviews,
    failedWebhooks,
    openRisks,
    urgentSupport,
    suspendedBusinesses,
    derivedReportItems,
  } = buildReportMetrics({
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
  });

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
        <ReportList items={reportItems} onSelect={onSelect} />
        <Stack spacing={2.5}>
          <ComplianceSnapshot
            pendingKyc={pendingKyc}
            payoutReviews={payoutReviews.length}
            failedWebhooks={failedWebhooks.length}
            openRisks={openRisks.length}
            urgentSupport={urgentSupport.length}
            platformSettings={platformSettings}
          />
          <RecentAuditEvidence
            events={latestAuditEvents}
            onSelect={onSelect}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
