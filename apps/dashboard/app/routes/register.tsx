import { useEffect, useState } from "react";
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
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
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
    owner_phone: String(form.get("owner_phone") ?? "").trim(),
    whatsapp_number: String(form.get("whatsapp_number") ?? "").trim(),
    whatsapp_code: String(form.get("whatsapp_code") ?? "").trim(),
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

const STEP_LABELS = ["Your store", "Your account", "Choose a plan"];

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

  // The signup is one POST, but we reveal it as three steps so it never reads as
  // a wall of fields. Every input stays mounted (just hidden) so values persist
  // across steps and all submit together on the final action.
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [handle, setHandle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // WhatsApp verification for the owner number: request a one-time code, then
  // enter it. The final "Create store" submit is gated on a code being present.
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappCode, setWhatsappCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState("");
  // Plan selection is controlled so a paid-plan choice always registers and is
  // submitted (the previous uncontrolled radios could fall back to "free").
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);

  const handleOk = /^[a-z0-9-]{2,}$/.test(handle.trim().toLowerCase());
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordOk = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  // Loose client check — the API is the source of truth on number format.
  const whatsappOk = whatsappNumber.replace(/[^0-9]/g, "").length >= 9;

  // Ask the API to WhatsApp a one-time code to the owner number, then reveal the
  // code field. The request endpoint is opaque (always 202), so any reachable
  // response advances the flow; only a network fault surfaces an error.
  const sendWhatsappCode = () => {
    if (!whatsappOk || otpSending) {
      return;
    }
    setOtpSending(true);
    setOtpError("");
    fetch("/business-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "register",
        whatsapp_number: whatsappNumber.trim(),
      }),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(() => setOtpRequested(true))
      .catch(() =>
        setOtpError("We couldn't send a code. Check the number and try again."),
      )
      .finally(() => setOtpSending(false));
  };

  // Real-time store-handle availability (Instagram/TikTok-style): once the
  // format is valid we debounce a check against the API and surface the result
  // inline on the handle field, before the user ever reaches plan selection.
  const [handleStatus, setHandleStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "reserved" | "error"
  >("idle");

  useEffect(() => {
    const normalized = handle.trim().toLowerCase();
    if (!handleOk) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/handle-check?handle=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data: { available?: boolean; reason?: string }) => {
          if (data.available) {
            setHandleStatus("available");
          } else if (data.reason === "reserved") {
            setHandleStatus("reserved");
          } else {
            setHandleStatus("taken");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setHandleStatus("error");
          }
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [handle, handleOk]);

  const handleUnavailable =
    handleStatus === "taken" || handleStatus === "reserved";
  const step0Valid =
    businessName.trim().length > 1 && handleOk && !handleUnavailable;
  const step1Valid =
    ownerName.trim().length > 0 &&
    emailOk &&
    passwordOk &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    whatsappOk &&
    otpRequested &&
    whatsappCode.trim().length > 0;

  const goNext = () => setStep((s) => Math.min(s + 1, 2));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

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
                component="img"
                src="/favicon.svg"
                alt="Xtiitch"
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  flexShrink: 0,
                  display: "block",
                }}
              />
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

          <Stack spacing={0.75} sx={{ mb: 2.5 }}>
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

          {/* Step progress */}
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            {STEP_LABELS.map((label, i) => (
              <Box key={label} sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    height: 5,
                    borderRadius: 999,
                    bgcolor:
                      i <= step ? tokens.burgundy : alpha(tokens.ink, 0.12),
                    transition: "background-color 240ms ease",
                  }}
                />
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    mt: 0.75,
                    display: "block",
                    fontWeight: i === step ? 800 : 600,
                    color:
                      i <= step ? tokens.burgundy : alpha(tokens.ink, 0.55),
                  }}
                >
                  {i + 1}. {label}
                </Typography>
              </Box>
            ))}
          </Stack>

          {result.error ? (
            <Alert severity="error" sx={{ mb: 2.5 }}>
              {result.error}
            </Alert>
          ) : null}

          <Form method="post">
            {/* Step 1 — store identity */}
            <Box sx={{ display: step === 0 ? "block" : "none" }}>
              <Stack spacing={2.5}>
                <TextField
                  name="business_name"
                  label="Business name"
                  required={step === 0}
                  autoComplete="organization"
                  fullWidth
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
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
                  required={step === 0}
                  fullWidth
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  error={(handle.length > 0 && !handleOk) || handleUnavailable}
                  color={handleStatus === "available" ? "success" : undefined}
                  focused={handleStatus === "available" ? true : undefined}
                  helperText={
                    handle.length > 0 && !handleOk
                      ? "Lowercase letters, numbers and dashes only."
                      : handleStatus === "checking"
                        ? "Checking availability…"
                        : handleStatus === "available"
                          ? `✓ ${handle.trim().toLowerCase()}.xtiitch.com is available`
                          : handleStatus === "taken"
                            ? "That store handle is already taken — try another."
                            : handleStatus === "reserved"
                              ? "That handle is reserved — please choose another."
                              : "Becomes <handle>.xtiitch.com"
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">@</InputAdornment>
                      ),
                    },
                  }}
                />
              </Stack>
            </Box>

            {/* Step 2 — owner account */}
            <Box sx={{ display: step === 1 ? "block" : "none" }}>
              <Stack spacing={2.5}>
                <TextField
                  name="owner_display_name"
                  label="Your name"
                  required={step === 1}
                  autoComplete="name"
                  fullWidth
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
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
                  required={step === 1}
                  autoComplete="email"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={email.length > 0 && !emailOk}
                  helperText={
                    email.length > 0 && !emailOk
                      ? "Enter a valid email address."
                      : " "
                  }
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
                  name="owner_phone"
                  label="Phone number"
                  autoComplete="tel"
                  inputMode="tel"
                  fullWidth
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  helperText="For SMS order and account notifications."
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneRounded fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Box>
                  <TextField
                    name="whatsapp_number"
                    label="WhatsApp number"
                    required={step === 1}
                    autoComplete="tel"
                    inputMode="tel"
                    fullWidth
                    placeholder="0244 000 111 or +233…"
                    value={whatsappNumber}
                    onChange={(e) => {
                      setWhatsappNumber(e.target.value);
                      // Any edit invalidates a code already sent to the old number.
                      setOtpRequested(false);
                      setWhatsappCode("");
                    }}
                    error={whatsappNumber.length > 0 && !whatsappOk}
                    helperText={
                      whatsappNumber.length > 0 && !whatsappOk
                        ? "Enter a valid WhatsApp number."
                        : "We'll send a one-time code to confirm this number."
                    }
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <WhatsApp fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      onClick={sendWhatsappCode}
                      disabled={!whatsappOk || otpSending}
                    >
                      {otpSending
                        ? "Sending…"
                        : otpRequested
                          ? "Resend code"
                          : "Send code"}
                    </Button>
                    {otpRequested ? (
                      <Typography
                        variant="caption"
                        sx={{ color: "success.main", fontWeight: 700 }}
                      >
                        ✓ Code sent to your WhatsApp
                      </Typography>
                    ) : null}
                  </Stack>
                  {otpError ? (
                    <Typography
                      variant="caption"
                      sx={{ display: "block", mt: 0.75, color: "error.main" }}
                    >
                      {otpError}
                    </Typography>
                  ) : null}
                </Box>
                {otpRequested ? (
                  <TextField
                    name="whatsapp_code"
                    label="WhatsApp code"
                    required={step === 1}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    fullWidth
                    placeholder="123456"
                    value={whatsappCode}
                    onChange={(e) => setWhatsappCode(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <WhatsApp fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                ) : null}
                <TextField
                  name="owner_password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  required={step === 1}
                  autoComplete="new-password"
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={password.length > 0 && !passwordOk}
                  helperText={
                    password.length > 0 && !passwordOk
                      ? "At least 8 characters."
                      : "At least 8 characters"
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRounded fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword((v) => !v)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? (
                              <VisibilityOffRounded fontSize="small" />
                            ) : (
                              <VisibilityRounded fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  name="owner_password_confirm"
                  label="Confirm password"
                  type={showPassword ? "text" : "password"}
                  required={step === 1}
                  autoComplete="new-password"
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPassword.length > 0 && !passwordsMatch}
                  helperText={
                    confirmPassword.length > 0 && !passwordsMatch
                      ? "Passwords don't match."
                      : "Re-enter your password"
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRounded fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword((v) => !v)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? (
                              <VisibilityOffRounded fontSize="small" />
                            ) : (
                              <VisibilityRounded fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Stack>
            </Box>

            {/* Step 3 — plan */}
            <Box sx={{ display: step === 2 ? "block" : "none" }}>
              {plans.length > 0 ? (
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 800,
                      mb: 1,
                      color: alpha(tokens.ink, 0.8),
                    }}
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
                          transition:
                            "border-color 160ms ease, background 160ms",
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
                          checked={selectedPlan === plan.code}
                          onChange={() => setSelectedPlan(plan.code)}
                          sx={{
                            accentColor: tokens.burgundy,
                            width: 18,
                            height: 18,
                          }}
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
                    sx={{
                      display: "block",
                      mt: 1,
                      color: alpha(tokens.ink, 0.6),
                    }}
                  >
                    Paid plans: we'll help you set up billing from your
                    dashboard after signup.
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <input type="hidden" name="plan_code" value="free" />
                  <Typography
                    sx={{ fontWeight: 800, color: alpha(tokens.ink, 0.8) }}
                  >
                    You're starting on the Free plan
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: alpha(tokens.ink, 0.62) }}
                  >
                    Go live for free and upgrade anytime from your dashboard.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Navigation */}
            <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outlined"
                  size="large"
                  onClick={goBack}
                  disabled={isSubmitting}
                  startIcon={<ArrowBackRounded />}
                >
                  Back
                </Button>
              ) : null}
              {step < 2 ? (
                <Button
                  type="button"
                  variant="contained"
                  size="large"
                  onClick={goNext}
                  disabled={step === 0 ? !step0Valid : !step1Valid}
                  endIcon={<ArrowForwardRounded />}
                  sx={{
                    flex: 1,
                    // Without this the disabled state renders white-on-white and
                    // the whole button vanishes on the light card. Show a clearly
                    // muted (but visible) wine ghost until the step is valid.
                    "&.Mui-disabled": {
                      bgcolor: alpha(tokens.burgundy, 0.14),
                      color: alpha(tokens.burgundy, 0.55),
                    },
                  }}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isSubmitting}
                  endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
                  sx={{
                    flex: 1,
                    "&.Mui-disabled": {
                      bgcolor: tokens.burgundy,
                      color: tokens.white,
                      opacity: 0.72,
                    },
                  }}
                >
                  {isSubmitting ? "Creating your store…" : "Create store"}
                </Button>
              )}
            </Stack>

            <Typography
              variant="body2"
              sx={{
                textAlign: "center",
                color: alpha(tokens.ink, 0.68),
                mt: 2.5,
              }}
            >
              Already have a store?{" "}
              <Link component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>
                Sign in
              </Link>
            </Typography>
          </Form>
        </Paper>
      </Container>
    </Box>
  );
}
