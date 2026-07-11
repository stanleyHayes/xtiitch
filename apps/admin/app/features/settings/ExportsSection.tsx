import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import {
  AdminExportDataset,
  AuditEvent,
  Section,
  AdminPlatformMetrics,
  AdminPlatformSettings,
  AdminProfileSettings,
  AdminUser,
  AdminBusiness,
  AdminCustomer,
  AdminVerificationCase,
  AdminMoneyRails,
  AdminRoleDefinition,
  AdminPlan,
  AdminSubscription,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
  AdminRiskReview,
  AdminSupportTicket,
  AdminLaunchReadiness,
} from "../shared/types";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { ExportDatasetCard } from "./ExportDatasetCard";
import { buildExportDatasets } from "./exportDatasets";

export function ExportsSection({
  platformMetrics,
  platformSettings,
  profileSettings,
  launchReadiness,
  adminUsers,
  adminBusinesses,
  adminCustomers,
  verificationCases,
  moneyRails,
  roleCatalog,
  plans,
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
  profileSettings: AdminProfileSettings;
  launchReadiness: AdminLaunchReadiness | null;
  adminUsers: AdminUser[];
  adminBusinesses: AdminBusiness[];
  adminCustomers: AdminCustomer[];
  verificationCases: AdminVerificationCase[];
  moneyRails: AdminMoneyRails | null;
  roleCatalog: AdminRoleDefinition[];
  plans: AdminPlan[];
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
  const exportDatasets: AdminExportDataset[] = buildExportDatasets({
    platformMetrics,
    platformSettings,
    profileSettings,
    launchReadiness,
    adminUsers,
    adminBusinesses,
    adminCustomers,
    verificationCases,
    moneyRails,
    roleCatalog,
    plans,
    subscriptions,
    promotions,
    adCampaigns,
    affiliates,
    referralProgrammes,
    riskReviews,
    supportTickets,
    auditEvents,
  });
  const exportRowCount = exportDatasets.reduce(
    (sum, dataset) => sum + Math.max(dataset.rows.length - 1, 0),
    0,
  );
  const blockedCount = exportDatasets.filter(
    (dataset) => dataset.tone === "blocked",
  ).length;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Operator exports"
        title="Exports"
        helper="Download CSV snapshots from the current admin read models for reporting, review, and compliance handoff."
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="Export packs"
          value={String(exportDatasets.length)}
          helper="Current admin datasets"
          trend="CSV"
        />
        <MetricCard
          label="Rows available"
          value={String(exportRowCount)}
          helper="Across all export files"
          trend="Live"
        />
        <MetricCard
          label="Blocked packs"
          value={String(blockedCount)}
          helper="Need operator attention"
          trend={blockedCount > 0 ? "Review" : "Clear"}
        />
        <MetricCard
          label="Audit rows"
          value={String(auditEvents.length)}
          helper="Durable admin evidence"
          trend="Traceable"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {exportDatasets.map((dataset) => (
          <ExportDatasetCard
            key={dataset.id}
            dataset={dataset}
            onSelect={onSelect}
          />
        ))}
      </Box>
    </Stack>
  );
}
