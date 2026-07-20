import { Form, Link as RouterLink, useSearchParams } from "react-router";
import MuiLink from "@mui/material/Link";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import TextField from "../../components/form-text-field";
import { CardDropzone } from "../../components/ui/CardDropzone";
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

// One-line VAT disclosure for the billing screen, or "" when VAT is disabled.
export function vatNote(vat: VATPolicy): string {
  if (vat.vat_rate_bps <= 0) {
    return "";
  }
  const pct = (vat.vat_rate_bps / 100).toLocaleString("en-GH", {
    maximumFractionDigits: 2,
  });
  return vat.vat_inclusive
    ? `Prices include ${pct}% VAT.`
    : `${pct}% VAT is added to each charge at checkout.`;
}

// The Pricing Book bills the FIRST figure on the first paid cycle and the
// RENEWAL figure on every renewal. The cadence figures and their full
// package + Tax (VAT) + Transaction fee totals render in BillingCyclePicker;
// the §4.6 gross-up maths lives in lib/billing-fees.ts.

export function PaymentMethodForm({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  plan,
  identityOnFile,
  verified,
  error,
  isSubmitting,
}: {
  plan: PublicPlan | null;
  identityOnFile: boolean;
  verified: boolean;
  error?: string;
  isSubmitting: boolean;
}) {
  const [photoName, setPhotoName] = useState("");
  const [photoBackName, setPhotoBackName] = useState("");
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
            // Force light inputs on this white card. Without these the fields fall
            // back to the theme's (dark-mode) input styling — a near-black Ghana
            // Card field with an unreadable label. Mirrors the register card.
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
            Set up billing{plan ? ` for ${plan.name}` : ""}
          </Typography>
          <Typography sx={{ color: alpha(tokens.ink, 0.68), mb: 3 }}>
            {isPaidPlan
              ? "Choose a billing cycle and authorize it with Paystack to activate your plan. You can manage or cancel anytime."
              : "Authorize recurring billing with Paystack to activate your plan."}
          </Typography>
          {error ? (
            <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
              {error}
            </Alert>
          ) : null}
          <Form method="post" encType="multipart/form-data">
            <Stack spacing={2}>
              {isPaidPlan && plan ? (
                <BillingCyclePicker
                  plan={plan}
                  cadence={cadence}
                  onChange={setCadence}
                />
              ) : null}
              {isPaidPlan ? (
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
              {identityOnFile ? (
                <Alert
                  severity={verified ? "success" : "info"}
                  icon={<VerifiedUserRounded fontSize="inherit" />}
                  sx={{ textAlign: "left" }}
                >
                  {verified
                    ? "Your Ghana Card is verified and on file. No need to upload it again."
                    : "Your Ghana Card is on file and under review. You can continue to payment now."}
                </Alert>
              ) : (
                <Box sx={{ textAlign: "left" }}>
                  <Divider sx={{ mb: 2 }} />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mb: 0.5 }}
                  >
                    <VerifiedUserRounded
                      fontSize="small"
                      sx={{ color: tokens.burgundy }}
                    />
                    <Typography sx={{ fontWeight: 800 }}>
                      Verify your business
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: alpha(tokens.ink, 0.68), mb: 2 }}
                  >
                    We collect your Ghana Card to verify the business owner
                    before taking payments. This is required to activate a paid
                    plan.
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      name="card_number"
                      label="Ghana Card number"
                      placeholder="GHA-123456789-0"
                      required
                      fullWidth
                    />
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                    >
                      <CardDropzone
                        name="id_photo_file"
                        side="Front"
                        fileName={photoName}
                        onFile={setPhotoName}
                      />
                      <CardDropzone
                        name="id_photo_back_file"
                        side="Back"
                        fileName={photoBackName}
                        onFile={setPhotoBackName}
                      />
                    </Stack>
                    <Typography
                      variant="caption"
                      sx={{ display: "block", color: alpha(tokens.ink, 0.6) }}
                    >
                      Clear photos of the front and back of your Ghana Card
                      (both required).
                    </Typography>
                  </Stack>
                </Box>
              )}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
              >
                {isSubmitting
                  ? "Redirecting to Paystack…"
                  : identityOnFile
                    ? "Continue to payment"
                    : "Save & continue to payment"}
              </Button>
              {/* The owner is about to be sent to Paystack, where the merchant
                  reads "XCreativs" rather than Xtiitch. */}
              <XCreativsPaymentNotice />
              <MuiLink
                component={RouterLink}
                to="/dashboard"
                sx={{ color: alpha(tokens.ink, 0.6) }}
              >
                Skip for now — I'll do this later
              </MuiLink>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </Box>
  );
}
