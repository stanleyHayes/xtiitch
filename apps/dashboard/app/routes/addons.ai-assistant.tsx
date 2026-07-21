import { Form, Link as RouterLink, redirect, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import type { Route } from "./+types/addons.ai-assistant";
import { apiFetch } from "../lib/auth";
import { tokens } from "../theme";

// The AI Assistant is a ✨ writing add-on billed separately from the plan via a
// Paystack direct-debit authorization. This page mirrors billing-onboarding.tsx:
// the loader reads the add-on status + price, and the action starts a Paystack
// checkout and redirects the browser out to authorize the recurring charge.

type BillingStatus = "active" | "manual" | "past_due" | "pending" | "none";

type AddonStatus = {
  addon: string;
  active: boolean;
  billing_status: BillingStatus;
  price_minor: number;
  currency: string;
  next_charge_at: string | null;
  // available is false when the add-on cannot be purchased on this deployment (no
  // AI provider configured, or the admin master switch is off).
  available?: boolean;
};

export function meta(): Route.MetaDescriptors {
  return [
    { title: "AI Assistant · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const response = await apiFetch(request, "/addons/ai_assistant", {
    method: "GET",
  });
  // Set by the callback when the owner returned from Paystack without
  // completing payment — shows a friendly nothing-was-charged banner.
  const abandoned =
    new URL(request.url).searchParams.get("billing") === "abandoned";
  if (!response.ok) {
    return { status: null as AddonStatus | null, abandoned };
  }
  const status = (await response.json()) as AddonStatus;
  return { status, abandoned };
}

// Ask the API for a Paystack authorization link for the add-on and redirect the
// owner out to Paystack; they return to the callback route below.
export async function action({ request }: Route.ActionArgs) {
  const origin = new URL(request.url).origin;
  const response = await apiFetch(request, "/addons/ai_assistant/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_url: `${origin}/addons/ai-assistant/callback`,
    }),
  });
  if (response.status === 503) {
    return {
      error:
        "Add-on billing is unavailable right now. Please try again in a few minutes.",
    };
  }
  if (!response.ok) {
    return {
      error: "We couldn't start checkout right now. Please try again.",
    };
  }
  const body = (await response.json()) as { redirect_url?: string };
  if (!body.redirect_url) {
    return {
      error: "Add-on checkout is not available right now. Please try again.",
    };
  }
  return redirect(body.redirect_url);
}

function formatPrice(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: currency || "GHS",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

// Pin the time zone to UTC so the server and client render the same string and
// hydration stays stable.
function formatRenewal(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function AiAssistantAddon({ // eslint-disable-line complexity, max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const status = loaderData?.status ?? null;
  const abandoned = loaderData?.abandoned ?? false;
  const result = (actionData ?? {}) as { error?: string };

  const priceLabel = status
    ? `${formatPrice(status.price_minor, status.currency)} / month`
    : "";
  const active = status?.active ?? false;
  const pastDue = status?.billing_status === "past_due";
  const renewal = formatRenewal(status?.next_charge_at ?? null);
  // Default true so an older API (no `available` field) keeps the buy button.
  const available = status?.available ?? true;

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
            color: "text.primary",
          }}
        >
          <Box
            sx={(theme) => ({
              width: 56,
              height: 56,
              borderRadius: 2,
              mb: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            })}
          >
            <AutoAwesomeRounded />
          </Box>

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", mb: 1 }}
          >
            <Typography variant="h4" component="h1">
              AI Assistant
            </Typography>
            {active ? (
              <Chip label="Active" color="success" size="small" />
            ) : pastDue ? (
              <Chip label="Payment failed" color="warning" size="small" />
            ) : (
              <Chip label="Add-on" variant="outlined" size="small" />
            )}
          </Stack>

          <Typography sx={{ color: "text.secondary", mb: 1 }}>
            A ✨ writing assistant that polishes your design descriptions,
            customer messages and promos.
          </Typography>

          {priceLabel ? (
            <Typography
              sx={{ color: "text.primary", fontWeight: 760, mb: 3 }}
            >
              {priceLabel}
            </Typography>
          ) : (
            <Box sx={{ mb: 3 }} />
          )}

          {status === null ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              We couldn't load the add-on status right now. Please refresh the
              page.
            </Alert>
          ) : null}

          {result.error ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {result.error}
            </Alert>
          ) : null}

          {abandoned && !active ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Payment wasn&apos;t completed — nothing was charged. You can try
              again whenever you&apos;re ready.
            </Alert>
          ) : null}

          {active ? (
            <>
              <Alert
                icon={<CheckCircleRounded fontSize="inherit" />}
                severity="success"
                sx={{ mb: 2 }}
              >
                Active{renewal ? ` — renews on ${renewal}` : ""}.
              </Alert>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                The AI Assistant renews automatically each month. The ✨ button is
                ready to use across your dashboard.
              </Typography>
              <Divider sx={{ my: 3 }} />
              <Button
                component={RouterLink}
                to="/dashboard"
                variant="text"
                sx={{ color: alpha(tokens.ink, 0.6) }}
              >
                Back to dashboard
              </Button>
            </>
          ) : !available ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                The ✨ AI writing add-on isn’t available right now. Please check
                back later.
              </Alert>
              <Link
                component={RouterLink}
                to="/dashboard"
                sx={{ color: alpha(tokens.ink, 0.6), textAlign: "center" }}
              >
                Back to dashboard
              </Link>
            </>
          ) : (
            <>
              {pastDue ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Payment failed — re-enable to continue using the AI Assistant.
                </Alert>
              ) : null}
              <Form method="post">
                <Stack spacing={1.5}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting || status === null}
                    endIcon={
                      isSubmitting ? undefined : <ArrowForwardRounded />
                    }
                  >
                    {isSubmitting
                      ? "Redirecting to Paystack…"
                      : pastDue
                        ? `Re-enable for ${priceLabel}`
                        : priceLabel
                          ? `Enable for ${priceLabel}`
                          : "Enable AI Assistant"}
                  </Button>
                  <Link
                    component={RouterLink}
                    to="/dashboard"
                    sx={{ color: alpha(tokens.ink, 0.6), textAlign: "center" }}
                  >
                    Maybe later
                  </Link>
                </Stack>
              </Form>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
