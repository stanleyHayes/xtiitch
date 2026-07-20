import { apiFetch } from "../../lib/auth";
import { analyticsLevel, scheduledReportsLevel } from "../../lib/entitlements";
import { isRedirectResponse, loadDashboardJSON } from "../shared/api";
import { normaliseDateInput } from "../shared/utils";
import type { Profile } from "../shared/types";
import {
  defaultAnalyticsData,
  type AnalyticsData,
  type AnalyticsSummary,
  type CustomersAnalytics,
  type DesignPerformanceRow,
  type OrdersTrendPoint,
  type OutstandingBalanceRow,
  type ReportSchedule,
  type RevenueBreakdowns,
  type SalesTrendPoint,
  type StaffActivityRow,
  type TopDesignRow,
} from "./types";

// §14.1: fetch ONLY what the plan's analytics_level entitles it to (the API
// 403s anything above the rung), always plus the summary every plan gets.
// Every endpoint fails soft — one bad endpoint downgrades to an empty slice
// and a warning banner instead of breaking the whole section.

// The §14.1 Studio custom date range. from/to are accepted only as
// yyyy-mm-dd (the API also takes RFC3339, but the picker submits dates);
// anything else is dropped so a hand-edited URL can never 400 the section.
function parseCustomRange(
  level: number,
  searchParams: URLSearchParams,
): { from: string; to: string } {
  if (level < 3) {
    return { from: "", to: "" };
  }
  const from = normaliseDateInput(searchParams.get("from") ?? "") ?? "";
  const to = normaliseDateInput(searchParams.get("to") ?? "") ?? "";
  if (from && to && from > to) {
    return { from: "", to: "" };
  }
  return { from, to };
}

function rangeParams(customRange: { from: string; to: string }): URLSearchParams {
  const params = new URLSearchParams();
  if (customRange.from) {
    params.set("from", customRange.from);
  }
  if (customRange.to) {
    params.set("to", customRange.to);
  }
  return params;
}

function withParams(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

// The scheduled-report config (§14.1 Growth+). Unlike the other reads, 404 is
// NOT a failure — it means "no schedule configured yet", which the form shows
// as its blank initial state, so this fetch cannot reuse loadDashboardJSON.
async function loadReportSchedule(
  request: Request,
  limits: Profile["entitlement_limits"],
): Promise<{ schedule: ReportSchedule | null; warning: string | null }> {
  if (scheduledReportsLevel(limits) < 1) {
    return { schedule: null, warning: null };
  }
  try {
    const response = await apiFetch(request, "/reports/schedule");
    if (response.status === 404) {
      return { schedule: null, warning: null };
    }
    if (!response.ok) {
      return {
        schedule: null,
        warning: "The report schedule could not be loaded right now.",
      };
    }
    const body = (await response.json()) as { schedule?: ReportSchedule };
    return { schedule: body.schedule ?? null, warning: null };
  } catch (error) {
    if (isRedirectResponse(error)) {
      throw error;
    }
    return {
      schedule: null,
      warning: "The report schedule could not be loaded right now.",
    };
  }
}

export async function loadAnalyticsData({ // eslint-disable-line complexity -- level-laddered fetch assembly; each branch is one entitled endpoint
  request,
  profile,
  searchParams,
}: {
  request: Request;
  profile: Profile;
  searchParams: URLSearchParams;
}): Promise<{ data: AnalyticsData; warnings: string[] }> {
  const limits = profile.entitlement_limits;
  const level = analyticsLevel(limits);
  const customRange = parseCustomRange(level, searchParams);
  const range = rangeParams(customRange);
  const warnings: string[] = [];
  const collect = <T,>(result: { data: T; warning: string | null }): T => {
    if (result.warning) {
      warnings.push(result.warning);
    }
    return result.data;
  };

  const summary = collect(
    await loadDashboardJSON<AnalyticsSummary | null>(
      request,
      withParams("/analytics/summary", range),
      null,
      "Analytics totals could not be loaded right now.",
    ),
  );

  if (level < 1) {
    // Free: totals only (§14.1) — no other endpoint is entitled, so none is
    // called. The UI renders upgrade nudges in place of the charts.
    const schedule = await loadReportSchedule(request, limits);
    if (schedule.warning) {
      warnings.push(schedule.warning);
    }
    return {
      data: {
        ...defaultAnalyticsData,
        summary,
        reportSchedule: schedule.schedule,
        customRange,
      },
      warnings,
    };
  }

  // §14.1: Starter's top-designs list is pinned to 5 API-side; only fuller
  // plans may ask for more.
  const topParams = new URLSearchParams(range);
  if (level >= 2) {
    topParams.set("limit", "10");
  }

  // Every promise is created BEFORE the first await so the entitled endpoints
  // are fetched concurrently; each is then collected (and fail-soft warned)
  // in a stable order.
  const trendPromise = loadDashboardJSON<{ points: SalesTrendPoint[] }>(
    request,
    withParams("/analytics/sales-trend", range),
    { points: [] },
    "The sales trend could not be loaded right now.",
  );
  const ordersPromise = loadDashboardJSON<{
    points: OrdersTrendPoint[];
  }>(
    request,
    withParams("/analytics/orders-trend", range),
    { points: [] },
    "The orders trend could not be loaded right now.",
  );
  const topPromise = loadDashboardJSON<{
    designs: TopDesignRow[];
    limit: number;
  }>(
    request,
    withParams("/analytics/top-designs", topParams),
    { designs: [], limit: 5 },
    "Top designs could not be loaded right now.",
  );
  const customersPromise = loadDashboardJSON<CustomersAnalytics | null>(
    request,
    withParams("/analytics/customers", range),
    null,
    "Customer analytics could not be loaded right now.",
  );
  const balancesPromise = loadDashboardJSON<{
    balances: OutstandingBalanceRow[];
    total_outstanding_minor: number;
  }>(
    request,
    withParams("/analytics/outstanding-balances", range),
    { balances: [], total_outstanding_minor: 0 },
    "Outstanding balances could not be loaded right now.",
  );
  const breakdownsPromise =
    level >= 2
      ? loadDashboardJSON<RevenueBreakdowns | null>(
          request,
          withParams("/analytics/revenue-breakdowns", range),
          null,
          "Revenue breakdowns could not be loaded right now.",
        )
      : null;
  const performancePromise =
    level >= 2
      ? loadDashboardJSON<{
          designs: DesignPerformanceRow[];
        }>(
          request,
          withParams("/analytics/design-performance", range),
          { designs: [] },
          "Design performance could not be loaded right now.",
        )
      : null;
  const staffPromise =
    level >= 3
      ? loadDashboardJSON<{ staff: StaffActivityRow[] }>(
          request,
          withParams("/analytics/staff", range),
          { staff: [] },
          "Team analytics could not be loaded right now.",
        )
      : null;
  const schedulePromise = loadReportSchedule(request, limits);

  const trend = collect(await trendPromise);
  const orders = collect(await ordersPromise);
  const top = collect(await topPromise);
  const customers = collect(await customersPromise);
  const balances = collect(await balancesPromise);
  const breakdowns = breakdownsPromise ? collect(await breakdownsPromise) : null;
  const designPerformance = performancePromise
    ? (collect(await performancePromise).designs ?? [])
    : [];
  const staff = staffPromise ? (collect(await staffPromise).staff ?? []) : [];
  const schedule = await schedulePromise;
  if (schedule.warning) {
    warnings.push(schedule.warning);
  }

  return {
    data: {
      summary,
      salesTrend: trend.points ?? [],
      ordersTrend: orders.points ?? [],
      topDesigns: top.designs ?? [],
      topDesignsLimit: top.limit ?? null,
      customers,
      balances: balances.balances ?? [],
      totalOutstandingMinor: balances.total_outstanding_minor ?? 0,
      breakdowns,
      designPerformance,
      staff,
      reportSchedule: schedule.schedule,
      customRange,
    },
    warnings,
  };
}
