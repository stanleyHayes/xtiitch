import { Link as RouterLink, redirect } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import MuiLink from "@mui/material/Link";
import { alpha } from "@mui/material/styles";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { Route } from "./+types/activate";
import {
  activationPlanLabel,
  activationPromptMessage,
  fetchActivationStatus,
} from "../lib/activation";
import { formatGHS } from "../lib/format";
import { tokens } from "../theme";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Activate your plan · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// The single, plan-agnostic activation page. It resolves the pending plan itself
// so any caller (banner, blocked action, 402 handler) can link here without
// knowing the plan code. Free / already-active owners have nothing to activate,
// so they are bounced back to the dashboard rather than stranded here.
export async function loader({ request }: Route.LoaderArgs) {
  const activation = await fetchActivationStatus(request);
  if (activation.activated) {
    throw redirect("/dashboard");
  }
  const blocked = new URL(request.url).searchParams.has("blocked");
  return { activation, blocked };
}

export default function Activate({ loaderData }: Route.ComponentProps) {
  const { activation, blocked } = loaderData;
  const planLabel = activationPlanLabel(activation);
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "grid",
        placeItems: "center",
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.12),
            borderRadius: 3,
            textAlign: "center",
            bgcolor: alpha(tokens.white, 0.98),
            color: tokens.ink,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              mx: "auto",
              mb: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <PaymentsRounded />
          </Box>
          <Chip label="One step left" color="primary" sx={{ mb: 1.5 }} />
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            Activate your {planLabel} plan
          </Typography>
          <Typography sx={{ color: alpha(tokens.ink, 0.68), mb: 3 }}>
            {activationPromptMessage(planLabel)}. Complete your first payment to
            unlock designs, storefront settings, and payouts.
          </Typography>
          {blocked ? (
            <Alert severity="info" sx={{ mb: 2, textAlign: "left" }}>
              That action needs an active plan. Activate {planLabel} to continue
              — your other pages stay available.
            </Alert>
          ) : null}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 2,
              textAlign: "left",
              borderColor: alpha(tokens.ink, 0.16),
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "baseline", justifyContent: "space-between" }}
            >
              <Typography sx={{ fontWeight: 700 }}>{planLabel} plan</Typography>
              <Typography
                sx={{ fontWeight: 900, fontSize: 20, color: tokens.burgundy }}
              >
                {activation.amount_due_minor > 0
                  ? formatGHS(activation.amount_due_minor)
                  : "Set at checkout"}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: alpha(tokens.ink, 0.6), mt: 0.5 }}
            >
              Amount due to activate. You&apos;ll confirm your billing cycle and
              pay securely with Paystack.
            </Typography>
          </Paper>
          <Stack spacing={1.5}>
            <Button
              component={RouterLink}
              to={`/onboarding/billing?plan=${encodeURIComponent(
                activation.plan_code,
              )}`}
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRounded />}
            >
              Continue to secure payment
            </Button>
            <MuiLink
              component={RouterLink}
              to="/dashboard"
              sx={{ color: alpha(tokens.ink, 0.6) }}
            >
              Back to dashboard
            </MuiLink>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
