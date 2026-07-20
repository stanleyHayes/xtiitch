import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { bucketizeTrend, monthOverMonthTotals } from "../../lib/trend-buckets";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { StackedBarChart, type ChartBar } from "./charts";
import type { SalesTrendPoint } from "./types";

// §14.1 "Sales trend chart (over time)" — Starter+. Checkout settlements and
// manual takings stack per bucket, so the chart reconciles with the Money
// Desk's two income streams (§14.5 one data source). Growth+ additionally
// frames the series month-on-month (§14.1 "month-on-month comparisons").
export function SalesTrendPanel({
  points,
  showMonthComparison,
}: {
  points: SalesTrendPoint[];
  showMonthComparison: boolean;
}) {
  const buckets = bucketizeTrend(points, (point) => point.day);
  const bars: ChartBar[] = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    segments: [
      {
        value: bucket.items.reduce((sum, point) => sum + point.sales_minor, 0),
        tone: tokens.burgundy,
        label: "Checkout",
      },
      {
        value: bucket.items.reduce(
          (sum, point) => sum + point.manual_takings_minor,
          0,
        ),
        tone: alpha(tokens.info, 0.75),
        label: "Manual",
      },
    ],
  }));
  const totalMinor = points.reduce((sum, point) => sum + point.sales_minor, 0);
  const comparison = showMonthComparison
    ? monthOverMonthTotals(
        points.map((point) => point.day),
        points.map((point) => point.sales_minor),
      )
    : null;

  return (
    <Panel id="analytics-sales-trend">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <TrendingUpRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Sales over time</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Checkout settlements plus manual takings, bucketed for your
                window.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <ToneChip
              label={`${formatGHS(totalMinor)} in the window`}
              tone={tokens.success}
            />
            {comparison ? (
              <ToneChip
                label={`This month ${formatGHS(comparison.current)} vs ${formatGHS(comparison.previous)} last month`}
                tone={tokens.info}
              />
            ) : null}
          </Stack>
        </Stack>
        <Box sx={{ mt: 2 }}>
          {bars.length === 0 ? (
            <InlineEmptyState
              icon={<TrendingUpRounded sx={{ fontSize: 38 }} />}
              title="No sales in this window"
              helper="Checkout settlements and manual takings will chart here as they land."
            />
          ) : (
            <StackedBarChart bars={bars} formatValue={formatGHS} />
          )}
        </Box>
      </Box>
    </Panel>
  );
}
