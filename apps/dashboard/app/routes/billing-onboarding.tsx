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
  // VAT applied to subscription charges (Pricing Book tax decision flag). Same
  // policy for every plan/cadence: 0 = no VAT; vat_inclusive=false means VAT is
  // added on top of the figures above at checkout, true means they include it.
  vat_rate_bps: number;
  vat_inclusive: boolean;
};

type BillingCadence = "quarterly" | "yearly";

type BusinessProfile = {
  verification_status?: string;
  plan?: string;
};

type Profile = {
  verificationStatus: string;
  planCode: string;
};

// The Ghana Card is considered "on file" once it has been submitted (pending
// review) or approved (verified) — in either case we skip re-collection here.
function isIdentityOnFile(status: string): boolean {
  return status === "verified" || status === "pending";
}

// Read the owner's business profile: verification status (to decide whether the
// Ghana Card section is still needed) and the plan they are currently on (to render
// the plan-change control for an already-subscribed business). Used by the loader
// and re-checked in the action so a stale form cannot bypass identity capture.
async function fetchProfile(request: Request): Promise<Profile> {
  try {
    const response = await apiFetch(request, "/businesses/me", {
      method: "GET",
    });
    if (!response.ok) {
      return { verificationStatus: "", planCode: "" };
    }
    const body = (await response.json()) as BusinessProfile;
    return {
      verificationStatus:
        typeof body.verification_status === "string"
          ? body.verification_status
          : "",
      planCode: typeof body.plan === "string" ? body.plan : "",
    };
  } catch {
    return { verificationStatus: "", planCode: "" };
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
  planCode: string,
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
        // The target plan being activated/upgraded to. Sending it lets a store on
        // the free plan switch to the chosen paid plan as billing starts (otherwise
        // the free-fee subscription fails the API's fee gate and can never upgrade).
        ...(planCode ? { plan_code: planCode } : {}),
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
  const body = (await response.json()) as {
    redirect_url?: string;
    activated?: boolean;
  };
  // A free-period / full (100%) discount collects nothing and a period already paid
  // needs nothing, so the API activates immediately with no Paystack checkout. Land
  // the owner on the same success page the paid-checkout callback redirects to.
  if (body.activated) {
    return redirect("/dashboard?billing=active");
  }
  if (!body.redirect_url) {
    return {
      error: "Billing setup is not available yet. You can finish this later.",
    };
  }
  return redirect(body.redirect_url);
}

// Friendly copy for the plan-change rejection codes the API returns, so a refused
// change is explained precisely rather than as a generic failure.
const PLAN_CHANGE_ERROR_MESSAGES: Record<string, string> = {
  plan_change_same_plan: "You're already on that plan.",
  billing_not_active:
    "Set up billing first — activate your subscription, then you can upgrade.",
  upgrade_charge_failed:
    "We couldn't take the prorated upgrade payment. Check your payment method and try again.",
  not_found: "That plan is no longer available.",
  invalid_input: "That plan change isn't available for your subscription.",
  forbidden: "Only the business owner or an admin can change the plan.",
};

type PlanChangeResult = {
  plan_code: string;
  // true = upgrade applied now; false = downgrade scheduled at the next renewal.
  immediate: boolean;
  // amount charged now for the remainder of the current period (upgrade), pesewas.
  prorated_charge_minor: number;
  // RFC3339 timestamp the new plan takes effect.
  effective_at: string;
};

// Ask the API to change the plan. The API classifies upgrade vs downgrade and
// prorates server-side; we surface whether it applied immediately (upgrade) or was
// scheduled for the next renewal (downgrade).
async function submitPlanChange(
  request: Request,
  planCode: string,
): Promise<{ error: string } | { changeResult: PlanChangeResult }> {
  if (!planCode) {
    return { error: "Choose a plan to switch to." };
  }
  const response = await apiFetch(
    request,
    "/auth/business/subscription/change-plan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_code: planCode }),
    },
  );
  if (!response.ok) {
    let code: string;
    try {
      const body = (await response.json()) as { error?: string };
      code = body.error ?? "";
    } catch {
      code = "";
    }
    return {
      error:
        PLAN_CHANGE_ERROR_MESSAGES[code] ??
        "We couldn't change your plan right now. Please try again later.",
    };
  }
  return { changeResult: (await response.json()) as PlanChangeResult };
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Set up billing · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const planCode = new URL(request.url).searchParams.get("plan") ?? "";
  // Fetch the catalogue once: it drives both the activation target (?plan=) and the
  // plan-change control (comparing each plan to the one the business is on).
  let plans: PublicPlan[] = [];
  try {
    const response = await fetchApi("/plans", { method: "GET" });
    if (response.ok) {
      plans = (await response.json()) as PublicPlan[];
    }
  } catch {
    plans = [];
  }
  const plan = planCode
    ? (plans.find((item) => item.code === planCode) ?? null)
    : null;
  // Owner is authenticated by the time they reach /onboarding/billing (register
  // sets the session; plan changes come from inside the dashboard), so we can read
  // the profile to decide whether the Ghana Card is still needed and which plan
  // they are currently on.
  const profile = await fetchProfile(request);
  const currentPlan =
    plans.find((item) => item.code === profile.planCode) ?? null;
  return {
    plan,
    plans,
    currentPlan,
    verificationStatus: profile.verificationStatus,
    identityOnFile: isIdentityOnFile(profile.verificationStatus),
  };
}

// Collect the owner's Ghana Card (unless already on file), then ask the API for
// a Paystack recurring-authorization link (owner-scoped) and redirect the owner
// out to Paystack; they return to the callback route.
export async function action({ request }: Route.ActionArgs) {
  const origin = new URL(request.url).origin;

  // Read the multipart form once (request.formData can only be consumed once):
  // it carries the chosen billing cadence and, when identity is not yet on file,
  // the Ghana Card fields — or, for an already-subscribed business, a plan change.
  const form = await request.formData();

  // Plan change (upgrade now / downgrade at renewal) for an already-subscribed
  // business. Distinct from the activation flow below; no Ghana Card or cadence
  // step — the API classifies and prorates server-side.
  if (String(form.get("intent") ?? "") === "change-plan") {
    return submitPlanChange(
      request,
      String(form.get("plan_code") ?? "").trim(),
    );
  }

  const cadence: BillingCadence =
    String(form.get("billing_cadence") ?? "") === "quarterly"
      ? "quarterly"
      : "yearly";
  // Optional discount code entered by the owner; validated + applied by the API.
  const discountCode = String(form.get("discount_code") ?? "").trim();

  // Re-check server-side rather than trusting the rendered form: if the Ghana
  // Card is not yet on file we must capture it before starting billing.
  const status = (await fetchProfile(request)).verificationStatus;
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
  // carrying the target plan (?plan=) so a free store activates the chosen paid
  // plan, plus any discount code for the API to apply at checkout.
  const targetPlan = new URL(request.url).searchParams.get("plan") ?? "";
  const result = await startPaystackBilling(
    request,
    origin,
    cadence,
    discountCode,
    targetPlan.trim(),
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

type VATPolicy = { vat_rate_bps: number; vat_inclusive: boolean };

// Mirror of the API's money.ApplyVAT so displayed charges match what the API
// bills. rate 0 (default) or inclusive pricing returns the figure unchanged;
// added-at-checkout grosses it up by the VAT rate, rounded to the nearest pesewa.
function vatGross(minor: number, vat: VATPolicy): number {
  if (vat.vat_rate_bps <= 0 || minor <= 0 || vat.vat_inclusive) {
    return minor;
  }
  return minor + Math.round((minor * vat.vat_rate_bps) / 10000);
}

// One-line VAT disclosure for the billing screen, or "" when VAT is disabled.
function vatNote(vat: VATPolicy): string {
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
  const currentPlan = loaderData?.currentPlan ?? null;
  const plans = loaderData?.plans ?? [];
  const identityOnFile = loaderData?.identityOnFile ?? false;
  const verified = loaderData?.verificationStatus === "verified";
  const result = (actionData ?? {}) as {
    error?: string;
    changeResult?: PlanChangeResult;
  };
  const [photoName, setPhotoName] = useState("");
  const isPaidPlan = plan !== null && plan.monthly_fee_minor > 0;
  const [cadence, setCadence] = useState<BillingCadence>("yearly");

  // Management mode: no activation target in the URL and the business is already on
  // a paid plan → show the self-serve plan-change control instead of the activation
  // flow. Activation (with the ?plan= target, Ghana Card, cadence and discount UI)
  // is left untouched below.
  const managementMode =
    !plan && currentPlan !== null && currentPlan.monthly_fee_minor > 0;
  if (managementMode) {
    return (
      <ChangePlanView
        currentPlan={currentPlan}
        plans={plans}
        result={result}
        isSubmitting={isSubmitting}
      />
    );
  }

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
                                      {copy.label} —{" "}
                                      {formatPrice(vatGross(copy.first, plan))}{" "}
                                      {copy.firstLabel}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{ color: alpha(tokens.ink, 0.68) }}
                                    >
                                      then{" "}
                                      {formatPrice(
                                        vatGross(copy.renewal, plan),
                                      )}
                                      /{copy.per}
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
                  {vatNote(plan) ? (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        mt: 1,
                        color: alpha(tokens.ink, 0.6),
                      }}
                    >
                      {vatNote(plan)}
                    </Typography>
                  ) : null}
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

// ChangePlanView is the self-serve plan-change control shown to an already-subscribed
// business: an upgrade takes effect now with a prorated charge, a downgrade is parked
// until the next renewal. It reuses the API's classification (upgrade vs downgrade),
// labelling each plan by its monthly fee relative to the current one.
function ChangePlanView({
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
          <Link
            component={RouterLink}
            to="/dashboard"
            sx={{ color: alpha(tokens.ink, 0.6) }}
          >
            Back to dashboard
          </Link>
        </Paper>
      </Container>
    </Box>
  );
}
