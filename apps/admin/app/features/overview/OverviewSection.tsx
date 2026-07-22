import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import type {
  AdminPlatformMetrics,
  AdminOperationsHealth,
  AdminBusiness,
  AdminCustomer,
  AdminSubscription,
  AdminVerificationCase,
  AdminSupportTicket,
  AdminRiskReview,
  AdminMoneyRails,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
} from "../../lib/api";
import { AuditEvent, Section } from "../shared/types";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { OverviewStats } from "./OverviewStats";
import { OverviewCharts } from "./OverviewCharts";
import { OverviewRecentActivity } from "./OverviewRecentActivity";

export function OverviewSection({
  platformMetrics,
  platformMetricsError,
  operationsHealth,
  businesses,
  customers,
  subscriptions,
  verificationCases,
  supportTickets,
  riskReviews,
  auditEvents,
  moneyRails,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  pendingCount,
  onSelect,
}: {
  platformMetrics: AdminPlatformMetrics | null;
  platformMetricsError: string | null;
  operationsHealth: AdminOperationsHealth | null;
  businesses: AdminBusiness[];
  customers: AdminCustomer[];
  subscriptions: AdminSubscription[];
  verificationCases: AdminVerificationCase[];
  supportTickets: AdminSupportTicket[];
  riskReviews: AdminRiskReview[];
  auditEvents: AuditEvent[];
  moneyRails: AdminMoneyRails | null;
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  pendingCount: number;
  onSelect: (section: Section) => void;
}) {
  return (
    <Stack spacing={3}>
      <SectionHeader
        eyebrow="Control room"
        title="Good morning. Here is the platform pulse."
        helper="Revenue, operations, trust, and customer pressure in one calm briefing. Open a workspace only when something needs action."
      />

      {platformMetricsError ? (
        <Alert severity="warning">{platformMetricsError}</Alert>
      ) : null}

      <OverviewStats
        platformMetrics={platformMetrics}
        businesses={businesses}
        customers={customers}
        subscriptions={subscriptions}
        riskReviews={riskReviews}
        supportTickets={supportTickets}
        operationsHealth={operationsHealth}
        pendingCount={pendingCount}
      />

      <OverviewRecentActivity
        operationsHealth={operationsHealth}
        subscriptions={subscriptions}
        verificationCases={verificationCases}
        supportTickets={supportTickets}
        auditEvents={auditEvents}
        moneyRails={moneyRails}
        onSelect={onSelect}
      />

      <OverviewCharts
        businesses={businesses}
        customers={customers}
        subscriptions={subscriptions}
        riskReviews={riskReviews}
        supportTickets={supportTickets}
        moneyRails={moneyRails}
        promotions={promotions}
        adCampaigns={adCampaigns}
        affiliates={affiliates}
        referralProgrammes={referralProgrammes}
        auditEvents={auditEvents}
        onSelect={onSelect}
      />
    </Stack>
  );
}
