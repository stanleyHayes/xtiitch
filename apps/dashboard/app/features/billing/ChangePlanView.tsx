import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import MuiLink from "@mui/material/Link";
import { Link as RouterLink } from "react-router";
import { tokens } from "../../theme";
import type { PlanChangeResult, PublicPlan } from "./billing-helpers";
import { formatPrice, vatGross, vatNote } from "./PaymentMethodForm";

// Human date for a plan change's effective moment (RFC3339 → e.g. "1 September 2026").
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "your next renewal";
  }
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Short, plain-language summary of a completed plan change, driven entirely by the
// API's response (immediate upgrade vs scheduled downgrade + any prorated charge).
function changeSummary(change: PlanChangeResult): string {
  if (change.immediate) {
    if (change.prorated_charge_minor > 0) {
      return `You're now on ${change.plan_code}. We charged ${formatPrice(
        change.prorated_charge_minor,
      )} for the rest of your current billing period; future renewals bill the full ${change.plan_code} rate.`;
    }
    return `You're now on ${change.plan_code}, effective immediately. There's no extra charge for the rest of this period.`;
  }
  return `Your switch to ${change.plan_code} is scheduled for ${formatDate(
    change.effective_at,
  )}. You keep your current plan until then — no charge or refund now.`;
}

export function ChangePlanView({
  currentPlan,
  plans,
  result,
  isSubmitting,
}: {
  currentPlan: PublicPlan;
  plans: PublicPlan[];
  result: { error?: string; changeResult?: PlanChangeResult };
  isSubmitting: boolean;
}) {
  const others = plans.filter((item) => item.code !== currentPlan.code);
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
            bgcolor: alpha(tokens.white, 0.98),
            color: tokens.ink,
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", mb: 1 }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(tokens.burgundy, 0.1),
                color: tokens.burgundy,
              }}
            >
              <PaymentsRounded />
            </Box>
            <Typography variant="h5" component="h1">
              Change your plan
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mb: 2 }}
          >
            <Typography variant="body2" sx={{ color: alpha(tokens.ink, 0.68) }}>
              You're currently on
            </Typography>
            <Chip label={currentPlan.name} color="primary" size="small" />
          </Stack>

          {result.changeResult ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              {changeSummary(result.changeResult)}
            </Alert>
          ) : null}
          {result.error ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {result.error}
            </Alert>
          ) : null}

          <Alert severity="info" icon={false} sx={{ mb: 2 }}>
            Upgrades take effect immediately — you pay a prorated amount for the
            rest of your current billing period, and future renewals bill the
            new plan. Downgrades take effect at your next renewal, with no
            charge or refund now.
            {vatNote(currentPlan) ? ` ${vatNote(currentPlan)}` : ""}
          </Alert>

          <Stack spacing={1.5}>
            {others.map((item) => {
              const upgrade =
                item.monthly_fee_minor > currentPlan.monthly_fee_minor;
              return (
                <Paper
                  key={item.code}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: alpha(tokens.ink, 0.16),
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {item.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: alpha(tokens.ink, 0.6) }}
                      >
                        {item.monthly_fee_minor > 0
                          ? `${formatPrice(
                              vatGross(item.quarterly_renewal_minor, item),
                            )}/quarter · ${formatPrice(
                              vatGross(item.yearly_renewal_minor, item),
                            )}/year`
                          : "Free"}
                      </Typography>
                    </Box>
                    <Form method="post">
                      <input type="hidden" name="intent" value="change-plan" />
                      <input type="hidden" name="plan_code" value={item.code} />
                      <Button
                        type="submit"
                        variant={upgrade ? "contained" : "outlined"}
                        size="small"
                        disabled={isSubmitting}
                      >
                        {upgrade ? "Upgrade now" : "Downgrade at renewal"}
                      </Button>
                    </Form>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          <Divider sx={{ my: 2 }} />
          <MuiLink
            component={RouterLink}
            to="/dashboard"
            sx={{ color: alpha(tokens.ink, 0.6) }}
          >
            Back to dashboard
          </MuiLink>
        </Paper>
      </Container>
    </Box>
  );
}
