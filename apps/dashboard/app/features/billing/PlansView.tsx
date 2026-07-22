import { useState } from "react";
import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { tokens } from "../../theme";
import type { BillingCadence, PublicPlan } from "./billing-helpers";
import { formatPrice, taxFeeNote } from "./PaymentMethodForm";

// The plan code that carries the "Most Popular" ribbon on the plans list.
export const POPULAR_PLAN_CODE = "growth";

// First-purchase vs renewal disclosure for the chosen cadence (Pricing Book:
// the FIRST figure bills once, the RENEWAL figure bills every cycle after) —
// e.g. "GHS 891 year one, then GHS 1,188/year". These are package figures;
// Tax fee and the Transaction fee are added at checkout (§4.1/§4.6) and
// itemised on the payment screen.
export function cadencePriceCopy(
  plan: PublicPlan,
  cadence: BillingCadence,
): { first: number; renewal: number; text: string } {
  const first =
    cadence === "quarterly"
      ? plan.quarterly_first_minor
      : plan.yearly_first_minor;
  const renewal =
    cadence === "quarterly"
      ? plan.quarterly_renewal_minor
      : plan.yearly_renewal_minor;
  const per = cadence === "quarterly" ? "quarter" : "year";
  const firstLabel = cadence === "quarterly" ? "first 3 months" : "year one";
  if (first === renewal) {
    return { first, renewal, text: `${formatPrice(renewal)}/${per}` };
  }
  return {
    first,
    renewal,
    text: `${formatPrice(first)} ${firstLabel}, then ${formatPrice(renewal)}/${per}`,
  };
}

// The API's design_limit is `number | null` (null = unlimited), but an older API
// may omit the field entirely — undefined must also read as unlimited, otherwise
// the line renders "Up to undefined active designs".
export function planLimitLines(plan: PublicPlan): string[] {
  const lines = [
    typeof plan.design_limit === "number"
      ? `Up to ${plan.design_limit} active designs`
      : "Unlimited active designs",
  ];
  if (plan.commission_bps > 0) {
    const pct = (plan.commission_bps / 100).toLocaleString("en-GH", {
      maximumFractionDigits: 2,
    });
    lines.push(`${pct}% Xtiitch fee per sale`);
  }
  return lines;
}

// The reusable subscription plans list (§7.1/§7.2): all four plans, a
// Quarterly/Yearly cadence toggle (there is no monthly billing), first-vs-
// renewal pricing, and a CTA per plan that enters the existing payment flow
// (?plan=code&cadence=). Rendered wherever an owner must pick a plan — the
// billing onboarding fall-through (Free accounts) and the activation page's
// "choose a different package instead".
export function PlansView({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  plans,
  currentPlanCode,
  title = "Choose your plan",
  subtitle = "Pick the package that fits your store. You can change it later from your dashboard.",
  notice,
  onBack,
  backTo,
  backLabel = "Back to dashboard",
}: {
  plans: PublicPlan[];
  // The plan the business is currently on, when known — its CTA is disabled.
  currentPlanCode?: string;
  title?: string;
  subtitle?: string;
  // Optional info banner (e.g. the billing callback's "payment wasn't
  // completed" message after an abandoned Paystack checkout).
  notice?: string;
  // In-place back action (the activation page toggles this view open) or a
  // plain link target (billing onboarding). One of the two.
  onBack?: () => void;
  backTo?: string;
  backLabel?: string;
}) {
  const [cadence, setCadence] = useState<BillingCadence>("yearly");
  const ordered = [...plans].sort(
    (a, b) => a.monthly_fee_minor - b.monthly_fee_minor,
  );
  const vat = plans.find((plan) => plan.vat_rate_bps > 0);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        py: { xs: 3, md: 6 },
        px: 2,
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <PaymentsRounded />
          </Box>
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          <Typography sx={{ color: alpha(tokens.ink, 0.68), maxWidth: 560 }}>
            {subtitle}
          </Typography>
          {notice ? (
            <Alert severity="info" sx={{ mt: 1.5, textAlign: "left" }}>
              {notice}
            </Alert>
          ) : null}
          {/* Quarterly/Yearly only — the Pricing Book has no monthly billing. */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              mt: 1.5,
              p: 0.5,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.16),
              borderRadius: 999,
              bgcolor: alpha(tokens.white, 0.9),
            }}
          >
            {(["quarterly", "yearly"] as BillingCadence[]).map((option) => (
              <Button
                key={option}
                size="small"
                variant={cadence === option ? "contained" : "text"}
                onClick={() => setCadence(option)}
                sx={{ borderRadius: 999, px: 2.5, textTransform: "capitalize" }}
              >
                {option}
              </Button>
            ))}
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 3,
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            alignItems: "stretch",
          }}
        >
          {ordered.map((plan) => {
            const isPaid = plan.monthly_fee_minor > 0;
            const isCurrent =
              currentPlanCode !== undefined && plan.code === currentPlanCode;
            const popular = plan.code.toLowerCase() === POPULAR_PLAN_CODE;
            const copy = cadencePriceCopy(plan, cadence);
            return (
              <Paper
                key={plan.code}
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
                  {plan.name}
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 26, mt: 0.5 }}>
                  {isPaid ? formatPrice(plan.monthly_fee_minor) : "Free"}
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
                  {planLimitLines(plan).map((line) => (
                    <Typography
                      key={line}
                      variant="body2"
                      sx={{ color: alpha(tokens.ink, 0.72) }}
                    >
                      {line}
                    </Typography>
                  ))}
                </Stack>
                {isPaid ? (
                  <Button
                    component={RouterLink}
                    to={`/onboarding/billing?plan=${encodeURIComponent(
                      plan.code,
                    )}&cadence=${cadence}`}
                    variant={popular ? "contained" : "outlined"}
                    disabled={isCurrent}
                    endIcon={isCurrent ? undefined : <ArrowForwardRounded />}
                    fullWidth
                  >
                    {isCurrent ? "Current plan" : `Choose ${plan.name}`}
                  </Button>
                ) : isCurrent ? (
                  <Button variant="outlined" disabled fullWidth>
                    Current plan
                  </Button>
                ) : null}
              </Paper>
            );
          })}
        </Box>

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
            {taxFeeNote(vat)}
          </Typography>
        ) : null}

        <Box sx={{ mt: 3, textAlign: "center" }}>
          {onBack ? (
            <Button onClick={onBack} sx={{ color: alpha(tokens.ink, 0.6) }}>
              {backLabel}
            </Button>
          ) : backTo ? (
            <MuiLink
              component={RouterLink}
              to={backTo}
              sx={{ color: alpha(tokens.ink, 0.6) }}
            >
              {backLabel}
            </MuiLink>
          ) : null}
        </Box>
      </Container>
    </Box>
  );
}
