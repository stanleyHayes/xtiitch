import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CircleIcon from "@mui/icons-material/Circle";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { Route } from "./+types/track";
import { api, type Tracking, type TrackingStage } from "../lib/api";
import { tokens } from "../theme";

export async function loader({ params }: Route.LoaderArgs) {
  const tracking = await api.tracking(params.orderId);
  if (!tracking) {
    throw new Response("Order not found", { status: 404 });
  }
  return { tracking };
}

export function meta({ data }: Route.MetaArgs) {
  const store = data?.tracking.store_name ?? "Order";
  return [
    { title: `Track your order · ${store}` },
    { name: "robots", content: "noindex" },
  ];
}

type Palette = { main: string; soft: string };

// Colour is the primary signal; it is always paired with a word and an icon so
// it never depends on colour alone (Spec 16.6).
const redPalette: Palette = { main: "#a92727", soft: "rgba(169,39,39,0.12)" };

const palettes: Record<string, Palette> = {
  red: redPalette,
  yellow: { main: "#b87914", soft: "rgba(184,121,20,0.14)" },
  green: { main: "#237a4b", soft: "rgba(35,122,75,0.14)" },
};

const headline: Record<string, string> = {
  red: "Order received",
  yellow: "Being made",
  green: "Ready",
};

type TrackingHandover = {
  method: "pickup" | "delivery" | string;
  status: "pending" | "dispatched" | "completed" | "cancelled" | string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  courier: string;
  note: string;
  updated_at: string;
};

type TrackingWithHandover = Tracking & {
  handover?: TrackingHandover | null;
};

const handoverStatusLabels: Record<string, string> = {
  pending: "Arranged",
  dispatched: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

function paletteFor(colour: string): Palette {
  return palettes[colour] ?? redPalette;
}

function formatHandoverMethod(method: string) {
  return method === "delivery" ? "Delivery" : "Pickup";
}

function formatHandoverStatus(status: string) {
  return handoverStatusLabels[status] ?? "Handover";
}

function HandoverPanel({
  handover,
  storeName,
}: {
  handover?: TrackingHandover | null;
  storeName: string;
}) {
  const method = handover?.method ?? "pickup";
  const isDelivery = method === "delivery";
  const status = handover ? formatHandoverStatus(handover.status) : "Being arranged";
  const icon = isDelivery ? <LocalShippingRounded /> : <ShoppingBagRounded />;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "8px",
        bgcolor: alpha(tokens.charcoal, 0.04),
        border: "1px solid",
        borderColor: alpha(tokens.charcoal, 0.1),
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { sm: "center" } }}
      >
        <Box
          aria-hidden
          sx={{
            width: 42,
            height: 42,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(tokens.burgundy, 0.1),
            color: tokens.burgundy,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography sx={{ fontWeight: 950 }}>
              {handover ? formatHandoverMethod(method) : "Handover"}
            </Typography>
            <Chip
              size="small"
              label={status}
              sx={{
                bgcolor: alpha(tokens.burgundy, 0.08),
                color: tokens.burgundy,
                fontWeight: 900,
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {handover
              ? isDelivery
                ? handover.address || "Delivery details are being finalised."
                : "Pickup is handled directly with the store."
              : `${storeName} will add pickup or delivery details when the piece is ready.`}
          </Typography>
        </Box>
      </Stack>

      {handover ? (
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          {handover.recipient_name || handover.recipient_phone ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {handover.recipient_name}
              {handover.recipient_name && handover.recipient_phone ? " · " : ""}
              {handover.recipient_phone}
            </Typography>
          ) : null}
          {handover.courier ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Courier: {handover.courier}
            </Typography>
          ) : null}
          {handover.note ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {handover.note}
            </Typography>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}

function StageRow({ stage }: { stage: TrackingStage }) {
  const palette = paletteFor(stage.colour);
  const active = stage.is_current || stage.is_complete;
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: active ? alpha(palette.main, 0.22) : "divider",
        bgcolor: active ? palette.soft : alpha(tokens.white, 0.7),
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box
          aria-hidden
          sx={{
            width: 34,
            height: 34,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            bgcolor: active ? alpha(palette.main, 0.12) : "background.default",
            flexShrink: 0,
          }}
        >
          {stage.is_complete ? (
            <CheckCircleRounded sx={{ color: palette.main }} />
          ) : stage.is_current ? (
            <CircleIcon sx={{ color: palette.main, fontSize: 18 }} />
          ) : (
            <RadioButtonUncheckedRounded sx={{ color: "text.disabled" }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontWeight: stage.is_current ? 900 : 700,
              color: active ? "text.primary" : "text.secondary",
            }}
          >
            {stage.name}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {stage.is_complete
              ? "Completed"
              : stage.is_current
                ? "In progress"
                : "Up next"}
          </Typography>
        </Box>
        {stage.is_current ? (
          <Chip
            size="small"
            label="Now"
            sx={{ bgcolor: palette.main, color: "#fff", fontWeight: 900 }}
          />
        ) : null}
      </Stack>
    </Box>
  );
}

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
