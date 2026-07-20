import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bucketizeTrend,
  monthOverMonthTotals,
  trendBucketKey,
  trendBucketLabel,
  trendSpanFor,
} from "./trend-buckets";

test("trendSpanFor ladders day → week → month with the point count", () => {
  assert.equal(trendSpanFor(0), "day");
  assert.equal(trendSpanFor(30), "day");
  assert.equal(trendSpanFor(31), "day");
  assert.equal(trendSpanFor(32), "week");
  assert.equal(trendSpanFor(120), "week");
  assert.equal(trendSpanFor(121), "month");
  assert.equal(trendSpanFor(365), "month");
});

test("trendBucketKey groups weeks Monday-start and months by yyyy-mm", () => {
  assert.equal(trendBucketKey("2026-07-19", "day"), "2026-07-19");
  assert.equal(trendBucketKey("2026-07-19", "month"), "2026-07");
  // 2026-07-19 is a Sunday; the week bucket is the Monday that started it.
  assert.equal(trendBucketKey("2026-07-19", "week"), "2026-07-13");
  assert.equal(trendBucketKey("2026-07-13", "week"), "2026-07-13");
  // A week can span a month boundary and still key to its Monday.
  assert.equal(trendBucketKey("2026-08-01", "week"), "2026-07-27");
});

test("trendBucketLabel renders axis labels per span", () => {
  assert.equal(trendBucketLabel("2026-07-19", "day"), "19 Jul");
  assert.equal(trendBucketLabel("2026-07-13", "week"), "Week of 13 Jul");
  assert.equal(trendBucketLabel("2026-07", "month"), "Jul 2026");
});

test("bucketizeTrend keeps chronological order and groups per span", () => {
  const points = [
    { day: "2026-07-13", sales_minor: 100 },
    { day: "2026-07-14", sales_minor: 200 },
    { day: "2026-07-20", sales_minor: 300 },
  ];
  const daily = bucketizeTrend(points, (point) => point.day);
  assert.equal(daily.length, 3);
  assert.equal(daily[0]?.key, "2026-07-13");
  assert.equal(daily[0]?.label, "13 Jul");

  // 32 points forces weekly buckets: the first two Sundays share one week.
  const many = Array.from({ length: 32 }, (_, index) => ({
    day: `2026-06-${String(index + 1).padStart(2, "0")}`,
    sales_minor: index,
  }));
  const weekly = bucketizeTrend(many, (point) => point.day);
  assert.ok(weekly.length < 32);
  assert.ok(weekly[0]?.label.startsWith("Week of "));
  const totalItems = weekly.reduce((sum, bucket) => sum + bucket.items.length, 0);
  assert.equal(totalItems, 32);
});

test("monthOverMonthTotals compares the last two calendar months", () => {
  assert.equal(monthOverMonthTotals([], []), null);
  assert.equal(
    monthOverMonthTotals(["2026-07-01", "2026-07-02"], [100, 200]),
    null,
  );
  assert.deepEqual(
    monthOverMonthTotals(
      ["2026-06-15", "2026-06-30", "2026-07-01", "2026-07-02"],
      [100, 50, 300, 100],
    ),
    { current: 400, previous: 150 },
  );
});
