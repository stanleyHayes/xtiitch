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
};

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

async function startPaystackBilling(
  request: Request,
  origin: string,
): Promise<Response | { error: string }> {
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

  // Re-check server-side rather than trusting the rendered form: if the Ghana
  // Card is not yet on file we must capture it before starting billing.
  const status = await fetchVerificationStatus(request);
  if (!isIdentityOnFile(status)) {
    const form = await request.formData();
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

  // Identity is on file (already or just submitted) — start Paystack billing.
  const result = await startPaystackBilling(request, origin);
  return result;
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
  const identityOnFile = loaderData?.identityOnFile ?? false;
  const verified = loaderData?.verificationStatus === "verified";
  const result = (actionData ?? {}) as { error?: string };
  const [photoName, setPhotoName] = useState("");
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
          <Form method="post" encType="multipart/form-data">
            <Stack spacing={2}>
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
