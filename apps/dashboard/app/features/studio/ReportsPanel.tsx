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
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import QueryStatsRounded from "@mui/icons-material/QueryStatsRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { RevenueBucket, StageMetric, FollowUpItem } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { formatPercent, percentage } from "../shared/utils";
import { MiniStat } from "../../components/ui/MiniStat";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";

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
  const peakRevenue = Math.max(
    1,
    ...revenueBuckets.map((bucket) => bucket.total_minor),
  );
  const bestDay = revenueBuckets.reduce<RevenueBucket | null>(
    (best, bucket) =>
      !best || bucket.total_minor > best.total_minor ? bucket : best,
    null,
  );
  const activeDays = revenueBuckets.filter(
    (bucket) => bucket.total_minor > 0,
  ).length;
  const dailyAverageMinor = Math.round(
    totalRevenueMinor / Math.max(revenueBuckets.length, 1),
  );
  const platformTotalMinor = revenueBuckets.reduce(
    (sum, bucket) => sum + bucket.platform_minor,
    0,
  );
  const manualTotalMinor = revenueBuckets.reduce(
    (sum, bucket) => sum + bucket.manual_minor,
    0,
  );
  const weekEntries = revenueBuckets.reduce(
    (sum, bucket) => sum + bucket.entries,
    0,
  );
  const platformShare =
    totalRevenueMinor > 0 ? platformTotalMinor / totalRevenueMinor : 0;
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
        ? alpha(tokens.white, 0.035)
        : alpha(tokens.ink, 0.018),
    backgroundImage: (theme) =>
      theme.palette.mode === "dark"
        ? `linear-gradient(180deg, ${alpha(tokens.white, 0.045)}, ${alpha(
            tokens.white,
            0.018,
          )})`
        : "none",
  };
  const reportHeaderSx: SxProps<Theme> = {
    px: 1.75,
    py: 1.5,
    bgcolor: (theme) =>
      theme.palette.mode === "dark" ? alpha(tokens.white, 0.055) : tokens.panel,
    color: "text.primary",
    backgroundImage: (theme) =>
      theme.palette.mode === "dark"
        ? `linear-gradient(90deg, ${alpha(tokens.burgundy, 0.16)}, transparent 62%)`
        : "none",
  };

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
          <Box
            sx={{
              ...reportSurfaceSx,
              p: { xs: 1.5, md: 2 },
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 900 }}>
                  Seven-day recorded income
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Checkout settlement plus manual takings.
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ lineHeight: 1 }}>
                {formatGHS(totalRevenueMinor)}
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "repeat(7, minmax(34px, 1fr))",
                  md: "repeat(7, minmax(54px, 1fr))",
                },
                alignItems: "end",
                minHeight: 188,
              }}
            >
              {revenueBuckets.map((bucket) => {
                const height = Math.max(
                  14,
                  Math.round((bucket.total_minor / peakRevenue) * 120),
                );
                return (
                  <Stack
                    key={bucket.key}
                    spacing={0.75}
                    sx={{
                      minWidth: 0,
                      alignItems: "stretch",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        textAlign: "center",
                        minHeight: 32,
                        display: "grid",
                        alignItems: "end",
                      }}
                    >
                      {bucket.total_minor > 0
                        ? formatGHS(bucket.total_minor)
                        : "GHS 0"}
                    </Typography>
                    <Box
                      sx={{
                        height,
                        borderRadius: 1.25,
                        bgcolor: (theme) =>
                          bucket.total_minor > 0
                            ? theme.palette.primary.main
                            : theme.palette.mode === "dark"
                              ? alpha(tokens.white, 0.08)
                              : alpha(tokens.ink, 0.08),
                        border: "1px solid",
                        borderColor: (theme) =>
                          bucket.total_minor > 0
                            ? alpha(theme.palette.primary.main, 0.3)
                            : theme.palette.divider,
                        transition: "height 180ms ease",
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 800,
                        textAlign: "center",
                        whiteSpace: "normal",
                      }}
                    >
                      {bucket.label}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>

            <Box sx={{ mt: "auto" }}>
              <Box
                sx={{
                  mt: 2.5,
                  pt: 2,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Income mix
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary" }}
                  >
                    {weekEntries} {weekEntries === 1 ? "entry" : "entries"} this
                    week
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    display: "flex",
                    height: 10,
                    borderRadius: 999,
                    overflow: "hidden",
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? alpha(tokens.white, 0.08)
                        : alpha(tokens.ink, 0.08),
                  }}
                >
                  {totalRevenueMinor > 0 ? (
                    <>
                      <Box
                        sx={{
                          width: `${Math.round(platformShare * 100)}%`,
                          bgcolor: "primary.main",
                        }}
                      />
                      <Box
                        sx={{
                          flex: 1,
                          bgcolor: (theme) =>
                            alpha(theme.palette.info.main, 0.7),
                        }}
                      />
                    </>
                  ) : null}
                </Box>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ mt: 1, flexWrap: "wrap" }}
                >
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center" }}
                  >
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      Checkout {formatGHS(platformTotalMinor)}
                    </Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center" }}
                  >
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        bgcolor: (theme) => alpha(theme.palette.info.main, 0.7),
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      Manual {formatGHS(manualTotalMinor)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

              <Box
                sx={{
                  mt: 2,
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(3, 1fr)",
                }}
              >
                {[
                  {
                    label: "Best day",
                    primary:
                      bestDay && bestDay.total_minor > 0
                        ? formatGHS(bestDay.total_minor)
                        : "—",
                    secondary:
                      bestDay && bestDay.total_minor > 0
                        ? bestDay.label
                        : "No income yet",
                  },
                  {
                    label: "Active days",
                    primary: `${activeDays}/${revenueBuckets.length}`,
                    secondary: "Days with income",
                  },
                  {
                    label: "Daily average",
                    primary: formatGHS(dailyAverageMinor),
                    secondary: "Across the week",
                  },
                ].map((tile) => (
                  <Box
                    key={tile.label}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? alpha(tokens.white, 0.03)
                          : alpha(tokens.ink, 0.015),
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 800,
                        display: "block",
                      }}
                    >
                      {tile.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 900,
                        lineHeight: 1.2,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {tile.primary}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      {tile.secondary}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

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
                <Typography sx={{ fontWeight: 900 }}>
                  Stage throughput
                </Typography>
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
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          px: { xs: 2, md: 2.75 },
          pb: { xs: 2, md: 2.75 },
        }}
      >
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
      </Box>
    </Panel>
  );
}