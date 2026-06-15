import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircleIcon from "@mui/icons-material/Circle";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import type { Route } from "./+types/track";
import { api, type Tracking, type TrackingStage } from "../lib/api";

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

function paletteFor(colour: string): Palette {
  return palettes[colour] ?? redPalette;
}

function StageRow({ stage }: { stage: TrackingStage }) {
  const palette = paletteFor(stage.colour);
  const active = stage.is_current || stage.is_complete;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      {stage.is_complete ? (
        <CheckCircleRounded sx={{ color: palette.main }} aria-hidden />
      ) : stage.is_current ? (
        <CircleIcon sx={{ color: palette.main }} aria-hidden />
      ) : (
        <RadioButtonUncheckedRounded sx={{ color: "divider" }} aria-hidden />
      )}
      <Typography
        sx={{ fontWeight: stage.is_current ? 700 : 500, color: active ? "text.primary" : "text.secondary" }}
      >
        {stage.name}
      </Typography>
      {stage.is_current ? (
        <Box
          sx={{
            ml: "auto",
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: 12,
            fontWeight: 700,
            bgcolor: palette.soft,
            color: palette.main,
          }}
        >
          Now
        </Box>
      ) : null}
    </Stack>
  );
}

export default function Track({ loaderData }: Route.ComponentProps) {
  const tracking: Tracking = loaderData.tracking;
  const fulfilled = tracking.status === "fulfilled";
  const colour = fulfilled ? "green" : tracking.colour;
  const palette = paletteFor(colour);
  const title = fulfilled ? "Ready" : headline[colour] ?? tracking.stage_name;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container sx={{ py: { xs: 4, md: 6 }, maxWidth: 560 }}>
        <Typography variant="overline" sx={{ color: "text.secondary" }}>
          {tracking.store_name} · Order #{tracking.order_id.slice(0, 5).toUpperCase()}
        </Typography>
        <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
          {tracking.design_title}
        </Typography>

        <Card sx={{ borderRadius: 4, overflow: "hidden", border: "none", boxShadow: "0 18px 50px -28px rgba(21,17,26,0.45)" }}>
          <Box sx={{ bgcolor: palette.soft, px: 3, py: 4, display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              aria-hidden
              sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: palette.main, display: "grid", placeItems: "center" }}
            >
              <CircleIcon sx={{ color: "#fff" }} />
            </Box>
            <Box>
              <Typography variant="h4" component="p" sx={{ color: palette.main, fontWeight: 800 }}>
                {title}
              </Typography>
              <Typography sx={{ color: "text.secondary" }}>
                {fulfilled ? "Your order is ready — come and collect it." : tracking.stage_name}
              </Typography>
            </Box>
          </Box>

          <CardContent sx={{ p: 3 }}>
            <Stack spacing={1.75}>
              {tracking.stages.map((stage) => (
                <StageRow key={`${stage.sequence}-${stage.name}`} stage={stage} />
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="body2" sx={{ mt: 3, color: "text.secondary", textAlign: "center" }}>
          This page updates as {tracking.store_name} moves your order forward.
        </Typography>
      </Container>
    </Box>
  );
}
