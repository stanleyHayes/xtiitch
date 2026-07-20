import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { bucketizeTrend } from "../../lib/trend-buckets";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { StackedBarChart, type ChartBar } from "./charts";
import type { OrdersTrendPoint } from "./types";

// §14.1 "Orders over time + standard vs custom split" — Starter+. Each bucket
// stacks standard orders against bespoke (custom) ones so the owner sees both
// the volume and the mix shifting over time.
export function OrdersTrendPanel({ points }: { points: OrdersTrendPoint[] }) {
  const buckets = bucketizeTrend(points, (point) => point.day);
  const bars: ChartBar[] = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    segments: [
      {
        value: bucket.items.reduce((sum, point) => sum + point.standard, 0),
        tone: tokens.info,
        label: "Standard",
      },
      {
        value: bucket.items.reduce((sum, point) => sum + point.bespoke, 0),
        tone: alpha(tokens.gold, 0.85),
        label: "Custom",
      },
    ],
  }));
  const totalOrders = points.reduce((sum, point) => sum + point.orders, 0);

  return (
    <Panel id="analytics-orders-trend">
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
              <TimelineRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Orders over time</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Volume with the standard-vs-custom split stacked per bucket.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${totalOrders} orders in the window`}
            tone={tokens.info}
          />
        </Stack>
        <Box sx={{ mt: 2 }}>
          {bars.length === 0 ? (
            <InlineEmptyState
              icon={<TimelineRounded sx={{ fontSize: 38 }} />}
              title="No orders in this window"
              helper="Standard and custom orders will chart here as customers place them."
            />
          ) : (
            <StackedBarChart
              bars={bars}
              formatValue={(value) => String(value)}
            />
          )}
        </Box>
      </Box>
    </Panel>
  );
}
