import { useState } from "react";
import {
  Form,
  Link as RouterLink,
  redirect,
  useNavigation,
} from "react-router";
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
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import FormControlLabel from "@mui/material/FormControlLabel";
import { alpha } from "@mui/material/styles";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import type { Route } from "./+types/billing-onboarding";
import { apiFetch } from "../lib/auth";
import { fetchApi } from "../lib/api-base";
import { uploadImage } from "../lib/media";
import TextField from "../components/form-text-field";
import { tokens } from "../theme";

type PublicPlan = {
  code: string;
  name: string;
  monthly_fee_minor: number;
  // Pricing Book cadence figures (minor units): first cycle vs renewal.
  quarterly_first_minor: number;
  quarterly_renewal_minor: number;
  yearly_first_minor: number;
  yearly_renewal_minor: number;
};

type BillingCadence = "quarterly" | "yearly";

type BusinessProfile = {
  verification_status?: string;
};

// The Ghana Card is considered "on file" once it has been submitted (pending
// review) or approved (verified) — in either case we skip re-collection here.
function isIdentityOnFile(status: string): boolean {
  return status === "verified" || status === "pending";
}

// Read the owner's current verification status. Used by both the loader (to
// decide whether to render the Ghana Card section) and the action (to re-check
// server-side so a stale form cannot bypass identity capture).
async function fetchVerificationStatus(request: Request): Promise<string> {
  try {
    const response = await apiFetch(request, "/businesses/me", {
      method: "GET",
    });
    if (!response.ok) {
      return "";
    }
    const body = (await response.json()) as BusinessProfile;
    return typeof body.verification_status === "string"
      ? body.verification_status
      : "";
  } catch {
    return "";
  }
}

// Friendly copy for the discount-code rejection codes the API returns, so a bad
// code is surfaced clearly (never silently ignored) rather than shown as a generic
// billing failure.
const DISCOUNT_ERROR_MESSAGES: Record<string, string> = {
  invalid_discount_code:
    "That discount code isn't valid. Check it and try again, or continue without one.",
  discount_code_expired: "That discount code has expired or isn't active yet.",
  discount_code_ineligible:
    "That discount code doesn't apply to this plan or billing cycle.",
  discount_code_exhausted:
    "That discount code has already been fully redeemed.",
};

async function startPaystackBilling(
  request: Request,
  origin: string,
  cadence: BillingCadence,
  code: string,
): Promise<Response | { error: string }> {
  const response = await apiFetch(
    request,
    "/auth/business/subscription/authorization-link",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_url: `${origin}/onboarding/billing/callback`,
        billing_cadence: cadence,
        // Only send a code when the owner entered one; the API treats it as
        // optional and applies the discount at checkout when valid.
        ...(code ? { code } : {}),
      }),
    },
  );
  if (!response.ok) {
    // Surface a precise discount-code message when the owner supplied a code and
    // the API rejected it; otherwise a generic retry-later message.
    if (code) {
      try {
        const body = (await response.json()) as { error?: string };
        const message = body.error
          ? DISCOUNT_ERROR_MESSAGES[body.error]
          : undefined;
        if (message) {
          return { error: message };
        }
      } catch {
        // fall through to the generic message below
      }
    }
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
  // Owner is authenticated by the time they reach /onboarding/billing (register
  // sets the session; upgrades come from inside the dashboard), so we can read
  // the verification status to decide whether the Ghana Card is still needed.
  const verificationStatus = await fetchVerificationStatus(request);
  return {
    plan,
    verificationStatus,
    identityOnFile: isIdentityOnFile(verificationStatus),
  };
}

// Collect the owner's Ghana Card (unless already on file), then ask the API for
// a Paystack recurring-authorization link (owner-scoped) and redirect the owner
// out to Paystack; they return to the callback route.
export async function action({ request }: Route.ActionArgs) {
  const origin = new URL(request.url).origin;

  // Read the multipart form once (request.formData can only be consumed once):
  // it carries the chosen billing cadence and, when identity is not yet on file,
  // the Ghana Card fields.
  const form = await request.formData();
  const cadence: BillingCadence =
    String(form.get("billing_cadence") ?? "") === "quarterly"
      ? "quarterly"
      : "yearly";
  // Optional discount code entered by the owner; validated + applied by the API.
  const discountCode = String(form.get("discount_code") ?? "").trim();

  // Re-check server-side rather than trusting the rendered form: if the Ghana
  // Card is not yet on file we must capture it before starting billing.
  const status = await fetchVerificationStatus(request);
  if (!isIdentityOnFile(status)) {
    const cardNumber = String(form.get("card_number") ?? "").trim();
    if (!cardNumber) {
      return {
        error: "Enter your Ghana Card number (e.g. GHA-123456789-0).",
      };
    }

    let photoURL = "";
    const photoFile = form.get("id_photo_file");
    if (photoFile instanceof File && photoFile.size > 0) {
      photoURL = (await uploadImage(request, photoFile)) ?? "";
    }
    if (!photoURL) {
      return {
        error: "Upload a clear photo of the front of your Ghana Card.",
      };
    }

    const identityResponse = await apiFetch(
      request,
      "/auth/business/identity-verification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cardNumber,
          id_photo_url: photoURL,
        }),
      },
    );
    if (!identityResponse.ok) {
      // Stay on the page (do NOT proceed to payment) so the owner can fix it.
      return {
        error:
          "We couldn't verify that Ghana Card. Check the number (format GHA-123456789-0) and photo, then try again.",
      };
    }
  }

  // Identity is on file (already or just submitted) — start Paystack billing,
  // carrying any discount code so the API can apply it at checkout.
  const result = await startPaystackBilling(
    request,
    origin,
    cadence,
    discountCode,
  );
  return result;
}

function formatPrice(minor: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

// The Pricing Book bills the FIRST figure on the first paid cycle and the
// RENEWAL figure on every renewal — surfaced verbatim so the owner sees exactly
// what they will be charged now vs later.
function cadenceCopy(
  plan: PublicPlan,
  cadence: BillingCadence,
): {
  label: string;
  per: string;
  firstLabel: string;
  first: number;
  renewal: number;
} {
  if (cadence === "quarterly") {
    return {
      label: "Quarterly",
      per: "quarter",
      firstLabel: "first 3 months",
      first: plan.quarterly_first_minor,
      renewal: plan.quarterly_renewal_minor,
    };
  }
  return {
    label: "Yearly",
    per: "year",
    firstLabel: "first year",
    first: plan.yearly_first_minor,
    renewal: plan.yearly_renewal_minor,
  };
}

export default function BillingOnboarding({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const plan = loaderData?.plan ?? null;
  const identityOnFile = loaderData?.identityOnFile ?? false;
  const verified = loaderData?.verificationStatus === "verified";
  const result = (actionData ?? {}) as { error?: string };
  const [photoName, setPhotoName] = useState("");
  const isPaidPlan = !!plan && plan.monthly_fee_minor > 0;
  const [cadence, setCadence] = useState<BillingCadence>("yearly");
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
            {isPaidPlan
              ? "Choose a billing cycle and authorize it with Paystack to activate your plan. You can manage or cancel anytime."
              : "Authorize recurring billing with Paystack to activate your plan."}
          </Typography>
          {result.error ? (
            <Alert severity="warning" sx={{ mb: 2, textAlign: "left" }}>
              {result.error}
            </Alert>
          ) : null}
          <Form method="post" encType="multipart/form-data">
            <Stack spacing={2}>
              {isPaidPlan && plan ? (
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontWeight: 800, mb: 1 }}>
                    Choose your billing cycle
                  </Typography>
                  <RadioGroup
                    name="billing_cadence"
                    value={cadence}
                    onChange={(event) =>
                      setCadence(event.target.value as BillingCadence)
                    }
                  >
                    <Stack spacing={1.5}>
                      {(["yearly", "quarterly"] as BillingCadence[]).map(
                        (option) => {
                          const copy = cadenceCopy(plan, option);
                          const selected = cadence === option;
                          return (
                            <Paper
                              key={option}
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                borderColor: selected
                                  ? tokens.burgundy
                                  : alpha(tokens.ink, 0.16),
                                borderWidth: selected ? 2 : 1,
                                bgcolor: selected
                                  ? alpha(tokens.burgundy, 0.04)
                                  : "transparent",
                              }}
                            >
                              <FormControlLabel
                                value={option}
                                control={<Radio />}
                                sx={{
                                  m: 0,
                                  width: "100%",
                                  alignItems: "flex-start",
                                }}
                                label={
                                  <Box>
                                    <Typography sx={{ fontWeight: 700 }}>
                                      {copy.label} — {formatPrice(copy.first)}{" "}
                                      {copy.firstLabel}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{ color: alpha(tokens.ink, 0.68) }}
                                    >
                                      then {formatPrice(copy.renewal)}/
                                      {copy.per}
                                    </Typography>
                                  </Box>
                                }
                              />
                            </Paper>
                          );
                        },
                      )}
                    </Stack>
                  </RadioGroup>
                  <Divider sx={{ mt: 2 }} />
                </Box>
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
                    <Box>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<CloudUploadRounded />}
                        fullWidth
                      >
                        {photoName || "Upload Ghana Card photo"}
                        <input
                          type="file"
                          name="id_photo_file"
                          accept="image/*"
                          hidden
                          onChange={(event) =>
                            setPhotoName(event.target.files?.[0]?.name ?? "")
                          }
                        />
                      </Button>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: alpha(tokens.ink, 0.6),
                          mt: 0.5,
                        }}
                      >
                        A clear photo of the front of your Ghana Card
                        (required).
                      </Typography>
                    </Box>
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
