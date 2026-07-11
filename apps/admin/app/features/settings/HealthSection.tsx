import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import {
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
import { formatPercentBps } from "../shared/formatting";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useHealthChecks } from "./HealthChecks";
import { HealthSignals } from "./HealthSignals";

export function HealthSection({
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
  const {
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
  } = useHealthChecks({
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
  });

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

      <HealthSignals signals={healthSignals} onSelect={onSelect} />
    </Stack>
  );
}
