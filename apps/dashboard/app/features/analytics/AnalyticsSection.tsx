import QueryStatsRounded from "@mui/icons-material/QueryStatsRounded";
import RocketLaunchRounded from "@mui/icons-material/RocketLaunchRounded";
import { analyticsLevel } from "../../lib/entitlements";
import { UpgradeNudge } from "../../components/ui/UpgradeNudge";
import type { Profile } from "../shared/types";
import type { AnalyticsData } from "./types";
import { TotalsPanel } from "./TotalsPanel";
import { CustomRangePanel } from "./CustomRangePanel";
import { SalesTrendPanel } from "./SalesTrendPanel";
import { OrdersTrendPanel } from "./OrdersTrendPanel";
import { TopDesignsPanel } from "./TopDesignsPanel";
import { CustomersAnalyticsPanel } from "./CustomersAnalyticsPanel";
import { BalancesPanel } from "./BalancesPanel";
import { BreakdownsPanel } from "./BreakdownsPanel";
import { DesignPerformancePanel } from "./DesignPerformancePanel";
import { StaffPanel } from "./StaffPanel";
import { ExportsPanel } from "./ExportsPanel";
import { ReportSchedulePanel } from "./ReportSchedulePanel";
import { analyticsLookbackDays } from "../../lib/entitlements";

// §14 Analytics — the whole level-laddered section. Every plan sees totals;
// Starter adds trends/top-designs/customer-mix/balances; Growth adds
// breakdowns/design-performance/full customer analytics/scheduled reports;
// Studio adds team analytics and the custom date range. Gated rungs render
// upgrade nudges (§14.2 "a clear reason to upgrade"), never silent gaps.
export function AnalyticsSection({
  profile,
  data,
  scheduleError,
}: {
  profile: Profile;
  data: AnalyticsData;
  scheduleError?: string;
}) {
  const level = analyticsLevel(profile.entitlement_limits);
  const lookbackDays = analyticsLookbackDays(profile.entitlement_limits);
  const customRangeActive = Boolean(data.customRange.from || data.customRange.to);

  return (
    <>
      {level >= 3 ? <CustomRangePanel range={data.customRange} /> : null}

      <TotalsPanel
        summary={data.summary}
        lookbackDays={lookbackDays}
        customRangeActive={customRangeActive}
      />

      {level >= 1 ? (
        <>
          <SalesTrendPanel
            points={data.salesTrend}
            showMonthComparison={level >= 2}
          />
          <OrdersTrendPanel points={data.ordersTrend} />
          <TopDesignsPanel
            designs={data.topDesigns}
            limit={data.topDesignsLimit}
          />
          <CustomersAnalyticsPanel customers={data.customers} />
          <BalancesPanel
            balances={data.balances}
            totalOutstandingMinor={data.totalOutstandingMinor}
          />
        </>
      ) : (
        <UpgradeNudge
          icon={<QueryStatsRounded />}
          title="Trends, top sellers and what's owed"
          description="Starter adds sales and orders over time, your top 5 designs, new-vs-returning customers, and outstanding bespoke balances — plus CSV exports and a full year of history."
          requiredPlan="Starter"
        />
      )}

      {level >= 2 ? (
        <>
          <BreakdownsPanel breakdowns={data.breakdowns} />
          <DesignPerformancePanel designs={data.designPerformance} />
        </>
      ) : level === 1 ? (
        <UpgradeNudge
          icon={<QueryStatsRounded />}
          title="Breakdowns, conversion and customer depth"
          description="Growth breaks revenue down by design, collection, order type and delivery/pickup, scores every design's view→order conversion, adds repeat rate, top customers and growth — over unlimited history, with monthly scheduled reports."
          requiredPlan="Growth"
        />
      ) : null}

      {level >= 3 ? (
        <StaffPanel staff={data.staff} />
      ) : level === 2 ? (
        <UpgradeNudge
          icon={<RocketLaunchRounded />}
          title="Team analytics and custom ranges"
          description="Studio adds performance & activity per team member, custom date ranges on every chart, export in any format (PDF, DOCX, CSV, XLSX), and scheduled reports on any cadence."
          requiredPlan="Studio"
        />
      ) : null}

      <ExportsPanel profile={profile} customRange={data.customRange} />
      <ReportSchedulePanel
        profile={profile}
        schedule={data.reportSchedule}
        error={scheduleError}
      />
    </>
  );
}
