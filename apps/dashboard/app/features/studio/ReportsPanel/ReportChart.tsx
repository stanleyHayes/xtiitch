import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { SxProps } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { formatGHS } from "../../../lib/format";
import type { RevenueBucket } from "../../shared/types";

export function ReportChart({
  revenueBuckets,
  totalRevenueMinor,
  weekEntries,
}: {
  revenueBuckets: RevenueBucket[];
  totalRevenueMinor: number;
  weekEntries: number;
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
  const platformShare =
    totalRevenueMinor > 0 ? platformTotalMinor / totalRevenueMinor : 0;

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

  return (
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
                        ? alpha(theme.palette.common.white, 0.08)
                        : alpha(theme.palette.common.black, 0.08),
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
                  ? alpha(theme.palette.common.white, 0.08)
                  : alpha(theme.palette.common.black, 0.08),
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
                    ? alpha(theme.palette.common.white, 0.03)
                    : alpha(theme.palette.common.black, 0.015),
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
  );
}
