// §14.1 chart bucketing. The analytics API returns PER-DAY trend points, and
// the lookback window ladders from 30 days (Free) to full history (Growth+) —
// a 12-month Starter window is ~365 points and cannot render as one bar per
// day on a phone (§1.3 mobile-first). These helpers collapse the points into a
// renderable number of chronological buckets: daily up to 31 points, weekly to
// 120, monthly beyond that.
//
// Kept pure so the node:test suite can pin the span/key/label rules.

export type TrendSpan = "day" | "week" | "month";

export type TrendBucket<T> = {
  key: string;
  label: string;
  items: T[];
};

// How many raw points force which aggregation span.
export function trendSpanFor(pointCount: number): TrendSpan {
  if (pointCount <= 31) {
    return "day";
  }
  if (pointCount <= 120) {
    return "week";
  }
  return "month";
}

// The bucket identity for one ISO day ("2026-07-19"). Weeks start Monday
// (Ghana's business week); months use their yyyy-mm key.
export function trendBucketKey(day: string, span: TrendSpan): string {
  if (span === "day") {
    return day;
  }
  if (span === "month") {
    return day.slice(0, 7);
  }
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return day;
  }
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function shortDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return day;
  }
  return `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]}`;
}

// The axis label for a bucket key under its span.
export function trendBucketLabel(key: string, span: TrendSpan): string {
  if (span === "month") {
    const month = Number.parseInt(key.slice(5, 7), 10);
    const name = monthNames[month - 1] ?? key;
    return `${name} ${key.slice(0, 4)}`;
  }
  if (span === "week") {
    return `Week of ${shortDayLabel(key)}`;
  }
  return shortDayLabel(key);
}

// Collapse an ordered series of per-day points into ordered buckets. Items
// keep their relative order inside each bucket; callers sum the series they
// care about per bucket.
export function bucketizeTrend<T>(
  points: T[],
  dayOf: (point: T) => string,
): TrendBucket<T>[] {
  const span = trendSpanFor(points.length);
  const buckets = new Map<string, T[]>();
  for (const point of points) {
    const key = trendBucketKey(dayOf(point), span);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(point);
    } else {
      buckets.set(key, [point]);
    }
  }
  return [...buckets.entries()].map(([key, items]) => ({
    key,
    label: trendBucketLabel(key, span),
    items,
  }));
}

// §14.1 Growth "month-on-month comparisons": totals for the most recent two
// calendar months present in a per-day series, so the sales panel can frame
// "this month vs last month" without another endpoint. Returns null when the
// series spans fewer than two months (e.g. the Free 30-day window).
export function monthOverMonthTotals(
  days: string[],
  values: number[],
): { current: number; previous: number } | null {
  const totals = new Map<string, number>();
  for (let index = 0; index < days.length; index += 1) {
    const key = (days[index] ?? "").slice(0, 7);
    if (key.length !== 7) {
      continue;
    }
    totals.set(key, (totals.get(key) ?? 0) + (values[index] ?? 0));
  }
  const keys = [...totals.keys()];
  if (keys.length < 2) {
    return null;
  }
  const currentKey = keys[keys.length - 1] ?? "";
  const previousKey = keys[keys.length - 2] ?? "";
  return {
    current: totals.get(currentKey) ?? 0,
    previous: totals.get(previousKey) ?? 0,
  };
}
