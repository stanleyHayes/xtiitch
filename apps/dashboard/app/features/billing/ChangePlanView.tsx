import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import MuiLink from "@mui/material/Link";
import { Link as RouterLink } from "react-router";
import { tokens } from "../../theme";
import type { PlanChangeResult, PublicPlan } from "./billing-helpers";
import { upgradeBillingHref } from "./billing-helpers";
import { formatPrice, taxFeeNote } from "./PaymentMethodForm";
import {
  POPULAR_PLAN_CODE,
  cadencePriceCopy,
  planLimitLines,
} from "./PlansView";

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

// eslint-disable-next-line max-lines-per-function -- large presentational component; refactor in follow-up
export function ChangePlanView({
  currentPlan,
  plans,
  result,
  isSubmitting,
  abandoned,
}: {
  currentPlan: PublicPlan;
  plans: PublicPlan[];
  result: { error?: string; changeResult?: PlanChangeResult };
  isSubmitting: boolean;
  abandoned?: boolean;
}) {
  // Large plan cards, cheapest first — the same card design as the plans list
  // (PlansView): name, big monthly price, first-vs-renewal line, limit lines,
  // and a full-width "Choose …" button that posts the same change-plan intent
  // the old compact rows did (the API still classifies upgrade vs downgrade).
  const availablePlans = [...plans].sort(
    (a, b) => a.monthly_fee_minor - b.monthly_fee_minor,
  );
  const vat = taxFeeNote(currentPlan);
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        py: { xs: 3, md: 6 },
        px: 2,
      }}
    >
      <Container maxWidth="sm">
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
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
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
        {abandoned ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Payment wasn't completed — your current plan is unchanged and
            nothing was charged. You can retry the upgrade below.
          </Alert>
        ) : null}

        <Alert severity="info" icon={false} sx={{ mb: 3 }}>
          Upgrades open Paystack for a prorated payment and take effect only
          after that payment is confirmed. Future renewals bill the new plan.
          Downgrades take effect at your next renewal, with no charge or refund
          now.
          {vat ? ` ${vat}` : ""}
        </Alert>

        <Stack spacing={2.5}>
          {availablePlans.map((item) => {
            const isPaid = item.monthly_fee_minor > 0;
            const isCurrent = item.code === currentPlan.code;
            const isUpgrade =
              item.monthly_fee_minor > currentPlan.monthly_fee_minor;
            const popular = item.code.toLowerCase() === POPULAR_PLAN_CODE;
            const copy = cadencePriceCopy(item, "yearly");
            return (
              <Paper
                key={item.code}
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  display: "flex",
                  flexDirection: "column",
                  bgcolor: alpha(tokens.white, 0.98),
                  color: tokens.ink,
                  borderColor: popular
                    ? tokens.burgundy
                    : alpha(tokens.ink, 0.16),
                  borderWidth: popular ? 2 : 1,
                  position: "relative",
                }}
              >
                {popular ? (
                  <Chip
                    label="Most Popular"
                    color="primary"
                    size="small"
                    sx={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontWeight: 800,
                    }}
                  />
                ) : null}
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
                  {item.name}
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 26, mt: 0.5 }}>
                  {isPaid ? formatPrice(item.monthly_fee_minor) : "Free"}
                  {isPaid ? (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ color: alpha(tokens.ink, 0.6), fontWeight: 600 }}
                    >
                      /mo
                    </Typography>
                  ) : null}
                </Typography>
                {isPaid ? (
                  <Typography
                    variant="body2"
                    sx={{ color: tokens.burgundy, fontWeight: 700, mt: 0.5 }}
                  >
                    {copy.text}
                  </Typography>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{ color: alpha(tokens.ink, 0.6), mt: 0.5 }}
                  >
                    No subscription — upgrade when you're ready.
                  </Typography>
                )}
                <Stack spacing={0.5} sx={{ mt: 1.5, mb: 2, flex: 1 }}>
                  {planLimitLines(item).map((line) => (
                    <Typography
                      key={line}
                      variant="body2"
                      sx={{ color: alpha(tokens.ink, 0.72) }}
                    >
                      {line}
                    </Typography>
                  ))}
                </Stack>
                {/* Paystack is an external navigation. A native document submit
                    prevents browser Back from restoring React Router's stale
                    submitting state and leaving every retry button disabled. */}
                {isCurrent ? (
                  <Button variant="outlined" disabled fullWidth>
                    Current plan
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    component={RouterLink}
                    to={upgradeBillingHref(item.code)}
                    variant={popular ? "contained" : "outlined"}
                    endIcon={<ArrowForwardRounded />}
                    fullWidth
                  >
                    {`Choose ${item.name}`}
                  </Button>
                ) : (
                  <Form method="post" reloadDocument>
                    <input type="hidden" name="intent" value="change-plan" />
                    <input type="hidden" name="plan_code" value={item.code} />
                    <Button
                      type="submit"
                      variant={popular ? "contained" : "outlined"}
                      disabled={isSubmitting}
                      endIcon={<ArrowForwardRounded />}
                      fullWidth
                    >
                      {`Choose ${item.name}`}
                    </Button>
                  </Form>
                )}
              </Paper>
            );
          })}
        </Stack>

        {vat ? (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 2,
              textAlign: "center",
              color: alpha(tokens.ink, 0.6),
            }}
          >
            {vat}
          </Typography>
        ) : null}

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <MuiLink
            component={RouterLink}
            to="/dashboard"
            sx={{ color: alpha(tokens.ink, 0.68), fontWeight: 700 }}
          >
            Keep my {currentPlan.name} plan
          </MuiLink>
        </Box>
        <Box sx={{ mt: 1.5, textAlign: "center" }}>
          <MuiLink
            component={RouterLink}
            to="/dashboard"
            variant="caption"
            sx={{ color: alpha(tokens.ink, 0.6) }}
          >
            Back to dashboard
          </MuiLink>
        </Box>
      </Container>
    </Box>
  );
}
