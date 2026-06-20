import { Link as RouterLink, redirect } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import type { Route } from "./+types/billing-callback";
import { apiFetch } from "../lib/auth";
import { tokens } from "../theme";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Confirming billing · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// Paystack redirects back here with ?reference=/?trxref=. Verify it with the API
// (which flips the subscription to recurring billing) then land in the dashboard.
export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  if (!reference) {
    return { ok: false };
  }
  const response = await apiFetch(
    request,
    "/auth/business/subscription/authorization-verifications",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    },
  );
  if (response.ok) {
    throw redirect("/dashboard?billing=active");
  }
  return { ok: false };
}

export default function BillingCallback() {
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
              bgcolor: alpha(tokens.warning, 0.12),
              color: tokens.warning,
            }}
          >
            <ErrorOutlineRounded />
          </Box>
          <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
            We couldn't confirm billing
          </Typography>
          <Typography sx={{ color: alpha(tokens.ink, 0.68), mb: 3 }}>
            The Paystack authorization didn't complete. You can try again, or set
            up billing later from your dashboard.
          </Typography>
          <Stack spacing={1.5}>
            <Button
              component={RouterLink}
              to="/onboarding/billing"
              variant="contained"
            >
              Try again
            </Button>
            <Button component={RouterLink} to="/dashboard" variant="text">
              Go to dashboard
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
