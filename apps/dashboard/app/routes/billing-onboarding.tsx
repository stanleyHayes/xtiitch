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
import { alpha } from "@mui/material/styles";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { Route } from "./+types/billing-onboarding";
import { apiFetch } from "../lib/auth";
import { fetchApi } from "../lib/api-base";
import { tokens } from "../theme";

type PublicPlan = {
  code: string;
  name: string;
  monthly_fee_minor: number;
};

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Set up billing · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const planCode = new URL(request.url).searchParams.get("plan") ?? "";
  let plan: PublicPlan | null = null;
  if (planCode) {
    try {
      const response = await fetchApi("/plans", { method: "GET" });
      if (response.ok) {
        const plans = (await response.json()) as PublicPlan[];
        plan = plans.find((item) => item.code === planCode) ?? null;
      }
    } catch {
      plan = null;
    }
  }
  return { plan };
}

// Ask the API for a Paystack recurring-authorization link (owner-scoped) and
// redirect the owner out to Paystack; they return to the callback route.
export async function action({ request }: Route.ActionArgs) {
  const origin = new URL(request.url).origin;
  const response = await apiFetch(
    request,
    "/auth/business/subscription/authorization-link",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_url: `${origin}/onboarding/billing/callback`,
      }),
    },
  );
  if (!response.ok) {
    return {
      error:
        "We couldn't start billing setup right now. You can finish this later from your dashboard.",
    };
  }
  const body = (await response.json()) as { redirect_url?: string };
  if (!body.redirect_url) {
    return {
      error: "Billing setup is not available yet. You can finish this later.",
    };
  }
  return redirect(body.redirect_url);
}

function formatPrice(minor: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export default function BillingOnboarding({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const plan = loaderData?.plan ?? null;
  const result = (actionData ?? {}) as { error?: string };
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
          <Chip label="Almost there" color="primary" sx={{ mb: 1.5 }} />
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            Set up billing{plan ? ` for ${plan.name}` : ""}
          </Typography>
          <Typography sx={{ color: alpha(tokens.ink, 0.68), mb: 3 }}>
            {plan && plan.monthly_fee_minor > 0
              ? `Authorize ${formatPrice(plan.monthly_fee_minor)}/month with Paystack to activate your plan. You can manage or cancel anytime.`
              : "Authorize recurring billing with Paystack to activate your plan."}
          </Typography>
          {result.error ? (
            <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
              {result.error}
            </Alert>
          ) : null}
          <Form method="post">
            <Stack spacing={1.5}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
              >
                {isSubmitting
                  ? "Redirecting to Paystack…"
                  : "Set up billing with Paystack"}
              </Button>
              <Link
                component={RouterLink}
                to="/dashboard"
                sx={{ color: alpha(tokens.ink, 0.6) }}
              >
                Skip for now — I'll do this later
              </Link>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </Box>
  );
}
