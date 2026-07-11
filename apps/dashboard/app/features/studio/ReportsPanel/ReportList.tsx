import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { SxProps } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { tokens } from "../../../theme";
import type { FollowUpItem, StageMetric } from "../../shared/types";
import { MiniStat } from "../../../components/ui/MiniStat";
import { InlineEmptyState } from "../../../components/ui/InlineEmptyState";
import { ToneChip } from "../../../components/ui/ToneChip";
import { formatPercent, percentage } from "../../shared/utils";

export function ReportList({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  stageMetrics,
  followUps,
  completionRate,
  collectionRate,
}: {
  stageMetrics: StageMetric[];
  followUps: FollowUpItem[];
  completionRate: number;
  collectionRate: number;
}) {
  const totalStageCount = stageMetrics.reduce(
    (sum, metric) => sum + metric.count,
    0,
  );
  const reportSurfaceSx: SxProps<Theme> = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: (theme) =>
      theme.palette.mode === "dark"
        ? alpha(theme.palette.common.white, 0.035)
        : alpha(theme.palette.common.black, 0.018),
    backgroundImage: (theme) =>
      theme.palette.mode === "dark"
        ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.045)}, ${alpha(
            theme.palette.common.white,
            0.018,
          )})`
        : "none",
  };
  const reportHeaderSx: SxProps<Theme> = {
    px: 1.75,
    py: 1.5,
    bgcolor: (theme) =>
      theme.palette.mode === "dark"
        ? alpha(theme.palette.common.white, 0.055)
        : tokens.panel,
    color: "text.primary",
    backgroundImage: (theme) =>
      theme.palette.mode === "dark"
        ? `linear-gradient(90deg, ${alpha(tokens.burgundy, 0.16)}, transparent 62%)`
        : "none",
  };

  return (
    <Stack spacing={1.25}>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
        }}
      >
        <MiniStat
          icon={<TrendingUpRounded fontSize="small" />}
          label="Completion"
          value={formatPercent(completionRate)}
          helper="Fulfilled share of all orders"
          tone={tokens.success}
        />
        <MiniStat
          icon={<PaymentsRounded fontSize="small" />}
          label="Collection"
          value={formatPercent(collectionRate)}
          helper="Settled against known order totals"
          tone={tokens.info}
        />
      </Box>

      <Box
        sx={{
          ...reportSurfaceSx,
          overflow: "hidden",
        }}
      >
        <Box sx={reportHeaderSx}>
          <Typography sx={{ fontWeight: 900 }}>Stage throughput</Typography>
        </Box>
        {stageMetrics.map((metric) => {
          const width = formatPercent(
            percentage(metric.count, totalStageCount),
          );
          return (
            <Box
              key={metric.label}
              sx={{
                px: 1.75,
                py: 1.35,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>
                    {metric.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    {metric.helper}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 900 }}>
                  {metric.count}
                </Typography>
              </Stack>
              <Box
                sx={{
                  mt: 1,
                  height: 8,
                  borderRadius: 999,
                  bgcolor: alpha(metric.tone, 0.12),
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width,
                    height: "100%",
                    bgcolor: metric.tone,
                    borderRadius: 999,
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          ...reportSurfaceSx,
          overflow: "hidden",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{
            ...reportHeaderSx,
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Follow-up radar</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Overdue visits, open handovers, failed messages, and fulfilled
              orders waiting for pickup or delivery.
            </Typography>
          </Box>
          <ToneChip
            label={`${followUps.length} signals`}
            tone={followUps.length > 0 ? tokens.warning : tokens.success}
          />
        </Stack>

        {followUps.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <InlineEmptyState
              icon={<CheckCircleRounded sx={{ fontSize: 38 }} />}
              title="No risky follow-ups"
              helper="The dashboard will surface overdue visits, open handovers, and message problems here."
            />
          </Box>
        ) : (
          followUps.map((item) => (
            <Box
              key={item.id}
              sx={{
                px: 1.75,
                py: 1.35,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(0, 1fr) auto",
                },
                alignItems: "center",
              }}
            >
              <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    mt: 0.75,
                    bgcolor: item.tone,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                  >
                    {item.helper}
                  </Typography>
                </Box>
              </Stack>
              <Button
                component={RouterLink}
                to={item.href}
                size="small"
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
              >
                {item.meta}
              </Button>
            </Box>
          ))
        )}
      </Box>
    </Stack>
  );
}
