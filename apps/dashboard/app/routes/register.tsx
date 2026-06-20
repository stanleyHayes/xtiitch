import {
  Form,
  Link as RouterLink,
  redirect,
  useNavigation,
  useRouteLoaderData,
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
import InputAdornment from "@mui/material/InputAdornment";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { Route } from "./+types/register";
import { fetchApi } from "../lib/api-base";
import TextField from "../components/form-text-field";
import { commitSession, getSession } from "../lib/session";
import { tokens } from "../theme";

type PublicPlan = {
  code: string;
  name: string;
  monthly_fee_minor: number;
  yearly_fee_minor: number;
  commission_bps: number;
  design_limit?: number | null;
};

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Create your store · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// Active plan catalogue for the picker; failures degrade to a free-only signup.
export async function loader() {
  let plans: PublicPlan[] = [];
  try {
    const response = await fetchApi("/plans", { method: "GET" });
    if (response.ok) {
      plans = (await response.json()) as PublicPlan[];
    }
  } catch {
    plans = [];
  }
  return { plans };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const session = await getSession(request.headers.get("Cookie"));

  const payload = {
    business_name: String(form.get("business_name") ?? "").trim(),
    business_handle: String(form.get("business_handle") ?? "")
      .trim()
      .toLowerCase(),
    owner_display_name: String(form.get("owner_display_name") ?? "").trim(),
    owner_email: String(form.get("owner_email") ?? "").trim(),
    owner_password: String(form.get("owner_password") ?? ""),
    plan_code: String(form.get("plan_code") ?? "free"),
  };

  if (payload.owner_password.length < 8) {
    return { error: "Choose a password with at least 8 characters." };
  }

  let response: Response;
  try {
    response = await fetchApi("/auth/business/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { error: "Dashboard API is unavailable. Try again after a moment." };
  }

  if (!response.ok) {
    let code: string;
    try {
      code = ((await response.json()) as { error?: string }).error ?? "";
    } catch {
      code = "";
    }
    if (code === "handle_taken") {
      return { error: "That store handle is already taken — try another." };
    }
    if (code === "email_taken") {
      return {
        error: "An account with that email already exists. Try signing in.",
      };
    }
    return {
      error:
        "We couldn't create your store. Handles must be lowercase letters, numbers and dashes — check your details and try again.",
    };
  }

  // Registration auto-issues a session; store it and drop straight into the
  // dashboard. Paid plans land with ?welcome=plan so onboarding can prompt for
  // billing setup.
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  session.set("access", body.access_token ?? "");
  session.set("refresh", body.refresh_token ?? "");
  const destination =
    payload.plan_code && payload.plan_code !== "free"
      ? `/onboarding/billing?plan=${encodeURIComponent(payload.plan_code)}`
      : "/dashboard?welcome=1";
  return redirect(destination, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

function formatPlanPrice(minor: number): string {
  if (minor <= 0) {
    return "Free";
  }
  const amount = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
  return `${amount}/mo`;
}

export default function Register({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const plans = loaderData?.plans ?? [];
  const result = (actionData ?? {}) as { error?: string };
  const branding = useRouteLoaderData("root") as
    | { brandLogoUrl?: string }
    | undefined;
  const brandLogoUrl = branding?.brandLogoUrl ?? "";
  const defaultPlan = plans.some((plan) => plan.code === "free")
    ? "free"
    : (plans[0]?.code ?? "free");

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.055)} 1px, transparent 1px)`,
        backgroundSize: "34px 34px",
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          minHeight: "100vh",
          display: "grid",
          alignItems: "center",
          py: { xs: 4, md: 7 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.12),
            borderRadius: 3,
            bgcolor: alpha(tokens.white, 0.98),
            color: tokens.ink,
            boxShadow: `0 28px 72px ${alpha(tokens.ink, 0.16)}`,
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
            "& .MuiInputAdornment-root, & .MuiSvgIcon-root": {
              color: alpha(tokens.ink, 0.62),
            },
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", mb: 2.5 }}
          >
            {brandLogoUrl ? (
              <Box
                component="img"
                src={brandLogoUrl}
                alt="Xtiitch"
                sx={{
                  height: 32,
                  width: "auto",
                  maxWidth: 150,
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: tokens.burgundy,
                  color: tokens.white,
                }}
              >
                <StorefrontRounded />
              </Box>
            )}
            <Box>
              {brandLogoUrl ? null : (
                <Typography sx={{ fontWeight: 800, lineHeight: 1 }}>
                  Xtiitch
                </Typography>
              )}
              <Typography
                variant="caption"
                sx={{ color: alpha(tokens.ink, 0.68) }}
              >
                Business dashboard
              </Typography>
            </Box>
          </Stack>

          <Stack spacing={0.75} sx={{ mb: 3 }}>
            <Chip
              label="Create your store"
              color="primary"
              sx={{ alignSelf: "flex-start" }}
            />
            <Typography variant="h4" component="h1">
              Start selling on Xtiitch
            </Typography>
            <Typography sx={{ color: alpha(tokens.ink, 0.68) }}>
              Free to start — your storefront goes live at{" "}
              <strong>your-handle.xtiitch.com</strong>.
            </Typography>
          </Stack>

          <Form method="post">
            <Stack spacing={2.5}>
              {result.error ? (
                <Alert severity="error">{result.error}</Alert>
              ) : null}

              <TextField
                name="business_name"
                label="Business name"
                required
                autoComplete="organization"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <StorefrontRounded fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                name="business_handle"
                label="Store handle"
                required
                fullWidth
                helperText="Lowercase letters, numbers and dashes. Becomes <handle>.xtiitch.com"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">@</InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                name="owner_display_name"
                label="Your name"
                required
                autoComplete="name"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonRounded fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                name="owner_email"
                label="Email"
                type="email"
                required
                autoComplete="email"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <AlternateEmailRounded fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                name="owner_password"
                label="Password"
                type="password"
                required
                autoComplete="new-password"
                fullWidth
                helperText="At least 8 characters"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockRounded fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {plans.length > 0 ? (
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 800, mb: 1, color: alpha(tokens.ink, 0.8) }}
                  >
                    Choose a plan
                  </Typography>
                  <Stack spacing={1}>
                    {plans.map((plan) => (
                      <Box
                        key={plan.code}
                        component="label"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: alpha(tokens.ink, 0.16),
                          cursor: "pointer",
                          transition: "border-color 160ms ease, background 160ms",
                          "&:has(input:checked)": {
                            borderColor: tokens.burgundy,
                            bgcolor: alpha(tokens.burgundy, 0.05),
                            boxShadow: `0 0 0 3px ${alpha(tokens.burgundy, 0.1)}`,
                          },
                        }}
                      >
                        <Box
                          component="input"
                          type="radio"
                          name="plan_code"
                          value={plan.code}
                          defaultChecked={plan.code === defaultPlan}
                          sx={{ accentColor: tokens.burgundy, width: 18, height: 18 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800 }}>
                            {plan.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: alpha(tokens.ink, 0.6) }}
                          >
                            {(plan.commission_bps / 100).toFixed(
                              plan.commission_bps % 100 === 0 ? 0 : 1,
                            )}
                            % commission on sales
                          </Typography>
                        </Box>
                        <Typography
                          sx={{ fontWeight: 900, color: tokens.burgundy }}
                        >
                          {formatPlanPrice(plan.monthly_fee_minor)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 1, color: alpha(tokens.ink, 0.6) }}
                  >
                    Paid plans: we'll help you set up billing from your dashboard
                    after signup.
                  </Typography>
                </Box>
              ) : (
                <input type="hidden" name="plan_code" value="free" />
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
                sx={{
                  "&.Mui-disabled": {
                    bgcolor: tokens.burgundy,
                    color: tokens.white,
                    opacity: 0.72,
                  },
                }}
              >
                {isSubmitting ? "Creating your store…" : "Create store"}
              </Button>

              <Typography
                variant="body2"
                sx={{ textAlign: "center", color: alpha(tokens.ink, 0.68) }}
              >
                Already have a store?{" "}
                <Link component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>
                  Sign in
                </Link>
              </Typography>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </Box>
  );
}
