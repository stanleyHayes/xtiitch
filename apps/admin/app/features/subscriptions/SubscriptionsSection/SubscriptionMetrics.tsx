import Box from "@mui/material/Box";
import { MetricCard } from "../../../components/ui/MetricCard";
import { formatGHS } from "../../shared/formatting";
import type { AdminPlatformMetrics } from "../../shared/types";

export function SubscriptionMetrics({
  estimatedMrrMinor,
  billableCount,
  platformMetrics,
  attentionCount,
  pastDueCount,
  overDesignLimitCount,
  freeUpgradeCandidateCount,
}: {
  estimatedMrrMinor: number;
  billableCount: number;
  platformMetrics: AdminPlatformMetrics | null;
  attentionCount: number;
  pastDueCount: number;
  overDesignLimitCount: number;
  freeUpgradeCandidateCount: number;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(4, minmax(0, 1fr))",
        },
      }}
    >
      <MetricCard
        label="Estimated base MRR"
        value={formatGHS(estimatedMrrMinor)}
        helper="From active paid package rows"
        trend={`${billableCount} billable`}
      />
      <MetricCard
        label="Commission revenue"
        value={formatGHS(platformMetrics?.platformRevenueMonthMinor ?? 0)}
        helper="Current month money-rail commission"
        trend="Live"
      />
      <MetricCard
        label="Lifecycle attention"
        value={String(attentionCount)}
        helper="Past due, grace, package limits, billing, and upgrades"
        trend={pastDueCount ? `${pastDueCount} due` : "Clear"}
      />
      <MetricCard
        label="Over design limit"
        value={String(overDesignLimitCount)}
        helper="Active designs above package cap"
        trend={overDesignLimitCount ? "Review" : "Clear"}
      />
      <MetricCard
        label="Free upgrade candidates"
        value={String(freeUpgradeCandidateCount)}
        helper="Free stores above GHS 500 GMV"
        trend="Review"
      />
    </Box>
  );
}
