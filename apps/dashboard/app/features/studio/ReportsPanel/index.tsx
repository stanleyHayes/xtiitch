import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import QueryStatsRounded from "@mui/icons-material/QueryStatsRounded";
import { tokens } from "../../../theme";
import { Panel } from "../../../components/ui/Panel";
import { ToneChip } from "../../../components/ui/ToneChip";
import type { FollowUpItem, RevenueBucket, StageMetric } from "../../shared/types";
import { formatPercent } from "../../shared/utils";
import { ReportChart } from "./ReportChart";
import { ReportList } from "./ReportList";

export function ReportsPanel({
  revenueBuckets,
  stageMetrics,
  followUps,
  totalRevenueMinor,
  completionRate,
  collectionRate,
}: {
  revenueBuckets: RevenueBucket[];
  stageMetrics: StageMetric[];
  followUps: FollowUpItem[];
  totalRevenueMinor: number;
  completionRate: number;
  collectionRate: number;
}) {
  const weekEntries = revenueBuckets.reduce(
    (sum, bucket) => sum + bucket.entries,
    0,
  );

  return (
    <Panel id="reports">
      <Box sx={{ p: { xs: 2, md: 2.75 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <QueryStatsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Reports snapshot</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Recorded revenue, stage flow, and work that needs a follow-up.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <ToneChip
              label={`${formatPercent(collectionRate)} collected`}
              tone={tokens.success}
            />
            <ToneChip
              label={`${formatPercent(completionRate)} fulfilled`}
              tone={tokens.info}
            />
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1.25fr) minmax(340px, 0.75fr)",
            },
          }}
        >
          <ReportChart
            revenueBuckets={revenueBuckets}
            totalRevenueMinor={totalRevenueMinor}
            weekEntries={weekEntries}
          />
          <ReportList
            stageMetrics={stageMetrics}
            followUps={followUps}
            completionRate={completionRate}
            collectionRate={collectionRate}
          />
        </Box>
      </Box>
    </Panel>
  );
}
