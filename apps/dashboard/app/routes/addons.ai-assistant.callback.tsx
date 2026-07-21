import { Link as RouterLink, redirect } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import type { Route } from "./+types/addons.ai-assistant.callback";
import { apiFetch } from "../lib/auth";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Confirming AI Assistant · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// Paystack redirects back here with ?reference=/?trxref= after the owner
// authorizes the add-on direct debit. Verify it with the API (which flips the
// add-on active) and render success. No reference (backed out before Paystack
// created a transaction) or a not-success verification (abandoned/failed/
// pending) redirects back to the add-on page with the "abandoned" flag, which
// shows a friendly nothing-was-charged banner and a working Enable button —
// never a blank pending navigation, never a dead retry card.
export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  if (!reference) {
    throw redirect("/addons/ai-assistant?billing=abandoned");
  }
  const response = await apiFetch(request, "/addons/ai_assistant/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  if (!response.ok) {
    throw redirect("/addons/ai-assistant?billing=abandoned");
  }
  const body = (await response.json()) as {
    active?: boolean;
    billing_status?: string;
  };
  if (!body.active) {
    throw redirect("/addons/ai-assistant?billing=abandoned");
  }
  return { active: true };
}

export default function AiAssistantCallback({
  loaderData,
}: Route.ComponentProps) {
  const active = loaderData?.active ?? false;

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
            borderColor: "divider",
            borderRadius: 3,
            textAlign: "center",
            color: "text.primary",
          }}
        >
          {active ? (
            <>
              <Box
                sx={(theme) => ({
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  mx: "auto",
                  mb: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                })}
              >
                <AutoAwesomeRounded />
              </Box>
              <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
                AI Assistant is now active ✨
              </Typography>
              <Typography sx={{ color: "text.secondary", mb: 3 }}>
                The ✨ writing assistant is ready to use across your dashboard. It
                renews automatically each month.
              </Typography>
              <Stack spacing={1.5}>
                <Button
                  component={RouterLink}
                  to="/dashboard"
                  variant="contained"
                >
                  Go to dashboard
                </Button>
              </Stack>
            </>
          ) : null}
        </Paper>
      </Container>
    </Box>
  );
}
