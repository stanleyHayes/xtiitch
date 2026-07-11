import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CircleIcon from "@mui/icons-material/Circle";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { Route } from "../../routes/+types/track";
import { tokens } from "../../theme";
import { HandoverPanel } from "./handover-panel";
import { StageRow } from "./stage-row";
import { headline, paletteFor } from "./utils";
import type { TrackingWithHandover } from "./types";

export default function Track({ loaderData }: Route.ComponentProps) {
  const tracking = loaderData.tracking as TrackingWithHandover;
  const fulfilled = tracking.status === "fulfilled";
  const showHandover = fulfilled || Boolean(tracking.handover);
  const colour = fulfilled ? "green" : tracking.colour;
  const palette = paletteFor(colour);
  const title = fulfilled ? "Ready" : (headline[colour] ?? tracking.stage_name);
  const completedCount = tracking.stages.filter(
    (stage) => stage.is_complete,
  ).length;
  const currentStage = tracking.stages.find((stage) => stage.is_current);
  const progressValue = fulfilled
    ? 100
    : tracking.stages.length
      ? Math.min(
          100,
          Math.round(
            ((completedCount + (currentStage ? 0.5 : 0)) /
              tracking.stages.length) *
              100,
          ),
        )
      : 0;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px)`,
        backgroundSize: "34px 34px",
        "@keyframes trackingSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      <Container sx={{ py: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2, lg: 3 },
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.95fr) 1fr" },
            alignItems: "stretch",
            "@media (prefers-reduced-motion: no-preference)": {
              animation: "trackingSurfaceIn 460ms ease both",
            },
          }}
        >
          <Card
            sx={{
              p: { xs: 2.25, md: 3 },
              bgcolor: tokens.charcoal,
              color: tokens.white,
              overflow: "hidden",
              position: "relative",
              minHeight: { lg: 520 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderColor: alpha(tokens.ink, 0.1),
              backgroundImage: `linear-gradient(135deg, ${alpha(palette.main, 0.42)}, transparent 48%), linear-gradient(${alpha(tokens.white, 0.05)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.white, 0.05)} 1px, transparent 1px)`,
              backgroundSize: "auto, 34px 34px, 34px 34px",
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                right: -34,
                bottom: -42,
                color: alpha(tokens.white, 0.08),
                "& .MuiSvgIcon-root": { fontSize: 230 },
              }}
            >
              <ContentCutRounded />
            </Box>
            <Box sx={{ position: "relative" }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <Chip
                  size="small"
                  icon={<StorefrontRounded />}
                  label={tracking.store_name}
                  sx={{
                    color: tokens.white,
                    bgcolor: "rgba(var(--surface-rgb), 0.12)",
                    border: "1px solid",
                    borderColor: alpha(tokens.white, 0.16),
                    "& .MuiChip-icon": { color: alpha(tokens.white, 0.76) },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ color: alpha(tokens.white, 0.62), fontWeight: 900 }}
                >
                  Order #{tracking.order_id.slice(0, 5).toUpperCase()}
                </Typography>
              </Stack>
              <Typography
                variant="h3"
                component="h1"
                sx={{ mt: { xs: 3.5, md: 6 }, maxWidth: 560 }}
              >
                {tracking.design_title}
              </Typography>
              <Typography
                sx={{
                  mt: 1.5,
                  color: alpha(tokens.white, 0.72),
                  maxWidth: 500,
                  fontSize: { xs: 16, md: 18 },
                }}
              >
                {fulfilled
                  ? "Your piece is ready. Coordinate pickup or delivery with the store."
                  : "Follow the production stage as the store moves your order forward."}
              </Typography>
            </Box>

            <Box sx={{ position: "relative", mt: { xs: 4, md: 6 } }}>
              <Typography
                variant="caption"
                sx={{ color: alpha(tokens.white, 0.62), fontWeight: 900 }}
              >
                Current status
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ mt: 1, alignItems: { sm: "center" } }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: "8px",
                    bgcolor: palette.main,
                    display: "grid",
                    placeItems: "center",
                    boxShadow: `0 18px 46px ${alpha(palette.main, 0.34)}`,
                    flexShrink: 0,
                  }}
                >
                  <CircleIcon sx={{ color: "#fff" }} />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    component="p"
                    sx={{ color: tokens.white, fontWeight: 950 }}
                  >
                    {title}
                  </Typography>
                  <Typography sx={{ color: alpha(tokens.white, 0.66) }}>
                    {fulfilled ? "Ready for handover" : tracking.stage_name}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Card>

          <Card
            sx={{ p: { xs: 2, md: 3 }, bgcolor: "rgba(var(--surface-rgb), 0.96)" }}
          >
            <Stack spacing={2.25}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 900,
                    textTransform: "uppercase",
                  }}
                >
                  Order progress
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 0.5, alignItems: "center" }}
                >
                  <Typography variant="h5" component="h2">
                    {progressValue}% complete
                  </Typography>
                  <Chip
                    size="small"
                    label={fulfilled ? "Ready" : "Active"}
                    sx={{
                      ml: "auto",
                      bgcolor: palette.soft,
                      color: palette.main,
                      fontWeight: 900,
                    }}
                  />
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={progressValue}
                  sx={{
                    mt: 1.5,
                    height: 8,
                    borderRadius: 999,
                    bgcolor: alpha(palette.main, 0.12),
                    "& .MuiLinearProgress-bar": {
                      bgcolor: palette.main,
                      borderRadius: 999,
                    },
                  }}
                />
              </Box>

              <Divider />

              {showHandover ? (
                <>
                  <HandoverPanel
                    handover={tracking.handover}
                    storeName={tracking.store_name}
                  />
                  <Divider />
                </>
              ) : null}

              <Stack spacing={1}>
                {tracking.stages.map((stage) => (
                  <StageRow
                    key={`${stage.sequence}-${stage.name}`}
                    stage={stage}
                  />
                ))}
              </Stack>

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: "8px",
                  bgcolor: alpha(tokens.burgundy, 0.06),
                  border: "1px solid",
                  borderColor: alpha(tokens.burgundy, 0.12),
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  Updates come from {tracking.store_name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mt: 0.5 }}
                >
                  Refresh this link whenever you need the latest production
                  state for your order.
                </Typography>
              </Box>

              <Button
                href="https://xtiitch.com"
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                sx={{ alignSelf: "flex-start" }}
              >
                About Xtiitch
              </Button>
            </Stack>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
