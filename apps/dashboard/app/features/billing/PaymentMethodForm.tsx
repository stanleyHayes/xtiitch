import { Form, Link as RouterLink, useSearchParams } from "react-router";
import MuiLink from "@mui/material/Link";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import TextField from "../../components/form-text-field";
import { XCreativsPaymentNotice } from "../../components/ui/XCreativsPaymentNotice";
import { tokens } from "../../theme";
import type { BillingCadence, PublicPlan } from "./billing-helpers";
import { BillingCyclePicker } from "./BillingCyclePicker";

type VATPolicy = { vat_rate_bps: number; vat_inclusive: boolean };

export function formatPrice(minor: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

// Mirror of the API's money.ApplyVAT so displayed charges match what the API
// bills. rate 0 (default) or inclusive pricing returns the figure unchanged;
// added-at-checkout grosses it up by the VAT rate, rounded to the nearest pesewa.
export function vatGross(minor: number, vat: VATPolicy): number {
  if (vat.vat_rate_bps <= 0 || minor <= 0 || vat.vat_inclusive) {
    return minor;
  }
  return minor + Math.round((minor * vat.vat_rate_bps) / 10000);
}

// Customer-facing fee disclosure for the billing screen. Keep the accounting
// term VAT internal; the product language consistently calls it a Tax fee.
export function taxFeeNote(vat: VATPolicy): string {
  if (vat.vat_rate_bps <= 0) {
    return "";
  }
  return "Tax fee and transaction fee apply.";
}

// The Pricing Book bills the FIRST figure on the first paid cycle and the
// RENEWAL figure on every renewal. The cadence figures and their full
// package + Tax fee + Transaction fee totals render in BillingCyclePicker;
// the §4.6 gross-up maths lives in lib/billing-fees.ts.

// eslint-disable-next-line complexity, max-lines-per-function -- one presentational form covers activation and upgrade copy/states
export function PaymentMethodForm({
  plan,
  error,
  abandoned,
  isSubmitting,
  changePlan = false,
}: {
  plan: PublicPlan | null;
  error?: string;
  // True when the owner returned from Paystack without completing payment —
  // shows a friendly banner and the pay button simply works again.
  abandoned?: boolean;
  isSubmitting: boolean;
  // Existing paid subscribers use this form as the cadence step before an
  // upgrade. The action then calls change-plan rather than first activation.
  changePlan?: boolean;
}) {
  const isPaidPlan = plan !== null && plan.monthly_fee_minor > 0;
  // The plans list deep-links here with ?plan=code&cadence=..., so the cycle
  // the owner picked there is the cycle this form starts on.
  const [searchParams] = useSearchParams();
  const [cadence, setCadence] = useState<BillingCadence>(
    searchParams.get("cadence") === "quarterly" ? "quarterly" : "yearly",
  );

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.default",
        display: "grid",
        justifyItems: "center",
        // A centred item that is taller than the mobile viewport can overflow
        // above the scroll origin. Pin long forms to the top on phones; retain
        // the centred desktop presentation when the card fits comfortably.
        alignItems: { xs: "start", md: "center" },
        px: { xs: 1, sm: 2 },
        pt: {
          xs: "calc(8px + env(safe-area-inset-top))",
          sm: "calc(16px + env(safe-area-inset-top))",
        },
        pb: "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <Container maxWidth="sm" disableGutters>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.12),
            borderRadius: 3,
            textAlign: "center",
            bgcolor: alpha(tokens.white, 0.98),
            color: tokens.ink,
            // Force light inputs on this white card. Without these the fields fall
            // back to the theme's (dark-mode) input styling — near-black fields
            // with unreadable labels. Mirrors the register card.
            "& .MuiInputLabel-root": {
              color: alpha(tokens.ink, 0.68),
              bgcolor: alpha(tokens.white, 0.98),
              px: 0.75,
              ml: -0.75,
              borderRadius: 1,
              "&.Mui-focused": { color: tokens.burgundy },
            },
            "& .MuiOutlinedInput-root": {
              bgcolor: tokens.white,
              color: tokens.ink,
              borderRadius: 2,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(tokens.ink, 0.22),
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(tokens.burgundy, 0.5),
              },
              "&.Mui-focused": {
                boxShadow: `0 0 0 4px ${alpha(tokens.burgundy, 0.12)}`,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: tokens.burgundy,
                },
              },
            },
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
            {changePlan ? "Choose billing for" : "Set up billing"}
            {plan ? ` ${plan.name}` : ""}
          </Typography>
          <Typography sx={{ color: alpha(tokens.ink, 0.68), mb: 3 }}>
            {changePlan
              ? `Choose the cycle ${plan?.name ?? "your new plan"} will renew on. Your payment today is prorated for the rest of the current period and your plan changes only after Paystack confirms it.`
              : isPaidPlan
                ? "Choose a billing cycle and authorize it with Paystack to activate your plan. You can manage or cancel anytime."
                : "Authorize recurring billing with Paystack to activate your plan."}
          </Typography>
          {error ? (
            <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
              {error}
            </Alert>
          ) : null}
          {abandoned ? (
            <Alert severity="info" sx={{ mb: 2, textAlign: "left" }}>
              Payment wasn&apos;t completed — nothing was charged. You can try
              again whenever you&apos;re ready.
            </Alert>
          ) : null}
          {/* Paystack is an external navigation. Native document submission
              prevents browser Back from restoring React Router's stale
              "submitting" state after a failed or abandoned payment. */}
          <Form method="post" reloadDocument>
            <Stack spacing={2}>
              {changePlan ? (
                <>
                  <input type="hidden" name="intent" value="change-plan" />
                  <input
                    type="hidden"
                    name="plan_code"
                    value={plan?.code ?? ""}
                  />
                </>
              ) : null}
              {isPaidPlan && plan ? (
                <BillingCyclePicker
                  plan={plan}
                  cadence={cadence}
                  onChange={setCadence}
                  renewalOnly={changePlan}
                />
              ) : null}
              {changePlan ? (
                <Typography
                  variant="caption"
                  sx={{ color: alpha(tokens.ink, 0.62), textAlign: "left" }}
                >
                  These are the full renewal totals. Paystack will show and
                  collect only the prorated upgrade amount due today.
                </Typography>
              ) : null}
              {isPaidPlan && !changePlan ? (
                <Box sx={{ textAlign: "left" }}>
                  <TextField
                    name="discount_code"
                    label="Discount code (optional)"
                    placeholder="e.g. WELCOME20"
                    fullWidth
                    autoComplete="off"
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: alpha(tokens.ink, 0.6),
                      mt: 0.5,
                    }}
                  >
                    Have a code? Enter it to apply your discount at checkout.
                  </Typography>
                </Box>
              ) : null}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
              >
                {isSubmitting
                  ? "Redirecting to Paystack…"
                  : "Continue to payment"}
              </Button>
              {/* The owner is about to be sent to Paystack, where the merchant
                  reads "XCreativs" rather than Xtiitch. */}
              <XCreativsPaymentNotice />
              <MuiLink
                component={RouterLink}
                to={changePlan ? "/onboarding/billing" : "/dashboard"}
                sx={{ color: alpha(tokens.ink, 0.6) }}
              >
                {changePlan
                  ? "Back to packages"
                  : "Skip for now — I'll do this later"}
              </MuiLink>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </Box>
  );
}
