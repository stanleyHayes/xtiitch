import { OVERVIEW_DAY_MS, OverviewDaySeries } from "./types";

export const overviewDayLabelFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
});

export function overviewParseMs(iso?: string | null): number {
  return iso ? Date.parse(iso) : Number.NaN;
}



// Bucket {timestamp,value} rows into `days` UTC calendar days ending at the
// latest timestamp present. Deterministic (no wall-clock) so it is SSR-safe and
// never triggers a hydration mismatch; invalid/empty timestamps are dropped.
export function buildOverviewSeries(
  rows: { ts: number; value: number }[],
  days: number,
): OverviewDaySeries[] {
  const valid = rows.filter((row) => Number.isFinite(row.ts));
  if (valid.length === 0) {
    return [];
  }
  const maxDay = valid.reduce(
    (max, row) => Math.max(max, Math.floor(row.ts / OVERVIEW_DAY_MS)),
    Number.NEGATIVE_INFINITY,
  );
  const startDay = maxDay - (days - 1);
  const series: OverviewDaySeries[] = [];
  for (let day = startDay; day <= maxDay; day += 1) {
    series.push({
      key: day,
      label: overviewDayLabelFmt.format(new Date(day * OVERVIEW_DAY_MS)),
      value: 0,
    });
  }
  for (const row of valid) {
    const day = Math.floor(row.ts / OVERVIEW_DAY_MS);
    const bucket = series[day - startDay];
    if (bucket) {
      bucket.value += row.value;
    }
  }
  return series;
}
