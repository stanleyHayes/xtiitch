import { useState } from "react";
import {
  Form,
  data,
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
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import InputAdornment from "@mui/material/InputAdornment";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LoginRounded from "@mui/icons-material/LoginRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import type { Route } from "./+types/login";
import { fetchApi } from "../lib/api-base";
import TextField from "../components/form-text-field";
import { commitSession, getSession } from "../lib/session";
import { tokens } from "../theme";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Sign in · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "login");
  const session = await getSession(request.headers.get("Cookie"));

  // Second factor: the password stage already issued a challenge; redeem it
  // together with the authenticator/backup code for a full session.
  if (intent === "mfa") {
    const code = String(form.get("code") ?? "").trim();
    const challenge = session.get("mfaChallenge");
    if (!challenge) {
      // Drop any stale challenge reference and fall back to the password form.
      session.unset("mfaChallenge");
      return data(
        { error: "Your verification step expired. Please sign in again." },
        { headers: { "Set-Cookie": await commitSession(session) } },
      );
    }
    let response: Response;
    try {
      response = await fetchApi("/auth/business/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_challenge_token: challenge, code }),
      });
    } catch {
      return {
        error: "Dashboard API is unavailable. Try again after a moment.",
        mfaRequired: true,
      };
    }
    if (!response.ok) {
      return {
        error: "That code didn't match. Try again, or use a backup code.",
        mfaRequired: true,
      };
    }
    const verified = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };
    session.set("access", verified.access_token);
    session.set("refresh", verified.refresh_token);
    session.unset("mfaChallenge");
    return redirect("/dashboard", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  // WhatsApp sign-in, step one: ask the API to send a one-time code. The request
  // endpoint is opaque (always 202) so we never reveal whether the account/number
  // exists — we always advance to the code step, even on a network fault.
  if (intent === "otp-request") {
    const businessHandle = String(form.get("business_handle") ?? "").trim();
    const whatsappNumber = String(form.get("whatsapp_number") ?? "").trim();
    try {
      await fetchApi("/auth/business/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_handle: businessHandle,
          whatsapp_number: whatsappNumber,
        }),
      });
    } catch {
      // Swallow: the opaque contract means we advance regardless; the user can
      // retry the code step (which resends) if nothing arrives.
    }
    return { otpSent: true };
  }

  // WhatsApp sign-in, step two: redeem the code for a session. Mirrors the
  // password path — on an MFA-enabled account we stash the challenge and hand
  // off to the shared second-factor form; otherwise we set the session tokens.
  if (intent === "otp-verify") {
    const businessHandle = String(form.get("business_handle") ?? "").trim();
    const whatsappNumber = String(form.get("whatsapp_number") ?? "").trim();
    const code = String(form.get("code") ?? "").trim();
    let response: Response;
    try {
      response = await fetchApi("/auth/business/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_handle: businessHandle,
          whatsapp_number: whatsappNumber,
          code,
        }),
      });
    } catch {
      return {
        error: "Dashboard API is unavailable. Try again after a moment.",
        otpSent: true,
      };
    }
    if (!response.ok) {
      return {
        error: "That code didn't match. Request a new code and try again.",
        otpSent: true,
      };
    }
    const body = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      mfa_required?: boolean;
      mfa_challenge_token?: string;
    };
    // MFA-enabled account: stash the challenge and prompt for the second factor,
    // identical to the password path above.
    if (body.mfa_required && body.mfa_challenge_token) {
      session.set("mfaChallenge", body.mfa_challenge_token);
      return data(
        { mfaRequired: true },
        { headers: { "Set-Cookie": await commitSession(session) } },
      );
    }
    session.set("access", body.access_token ?? "");
    session.set("refresh", body.refresh_token ?? "");
    return redirect("/dashboard", {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  const handle = String(form.get("handle") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  let response: Response;
  try {
    response = await fetchApi("/auth/business/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_handle: handle,
        owner_email: email,
        owner_password: password,
      }),
    });
  } catch {
    return {
      error: "Dashboard API is unavailable. Try again after a moment.",
    };
  }
  if (!response.ok) {
    return {
      error:
        "Those details didn't match. Check your store handle, email and password.",
    };
  }

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    mfa_required?: boolean;
    mfa_challenge_token?: string;
  };

  // MFA-enabled account: stash the challenge and prompt for the second factor.
  if (body.mfa_required && body.mfa_challenge_token) {
    session.set("mfaChallenge", body.mfa_challenge_token);
    return data(
      { mfaRequired: true },
      { headers: { "Set-Cookie": await commitSession(session) } },
    );
  }

  session.set("access", body.access_token ?? "");
  session.set("refresh", body.refresh_token ?? "");

  return redirect("/dashboard", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

// methodChipSx styles the Password/WhatsApp sign-in toggle. The card dims generic
// icons and the default outlined chip renders its label too faint to read, so we
// force explicit high-contrast colors: burgundy fill + white text when active,
// dark ink text + a visible border when inactive. `&&` bumps specificity so the
// icon colour beats the card's blanket `.MuiSvgIcon-root` dim.
function methodChipSx(active: boolean) {
  if (active) {
    return {
      fontWeight: 600,
      bgcolor: tokens.burgundy,
      color: tokens.white,
      borderColor: tokens.burgundy,
      "&& .MuiChip-icon": { color: tokens.white },
      "&:hover": { bgcolor: tokens.burgundy },
    };
  }
  return {
    fontWeight: 600,
    color: tokens.ink,
    borderColor: alpha(tokens.ink, 0.32),
    "&& .MuiChip-icon": { color: alpha(tokens.ink, 0.75) },
    "&:hover": {
      borderColor: alpha(tokens.ink, 0.5),
      bgcolor: alpha(tokens.ink, 0.04),
    },
  };
}

function LoadingButtonLabel({ label }: { label: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.85,
        "@keyframes xtiitchButtonDot": {
          "0%, 80%, 100%": { opacity: 0.42, transform: "translateY(0)" },
          "40%": { opacity: 1, transform: "translateY(-4px)" },
        },
      }}
    >
      <Box component="span">{label}</Box>
      <Box
        component="span"
        aria-hidden
        sx={{ display: "inline-flex", gap: 0.45, pt: "2px" }}
      >
        {["0ms", "120ms", "240ms"].map((delay) => (
          <Box
            key={delay}
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              bgcolor: "currentColor",
              animation: `xtiitchButtonDot 900ms ease-in-out ${delay} infinite`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const result = (actionData ?? {}) as {
    error?: string;
    mfaRequired?: boolean;
    otpSent?: boolean;
  };
  const mfaRequired = Boolean(result.mfaRequired);
  const otpSent = Boolean(result.otpSent);
  // Sign-in method toggle. WhatsApp is a two-step flow (request a code, then
  // verify it); the handle + number are controlled so they persist across the
  // opaque otp-request round-trip and submit again with the verify step.
  const [method, setMethod] = useState<"password" | "whatsapp">(
    otpSent ? "whatsapp" : "password",
  );
  const [waHandle, setWaHandle] = useState("");
  const [waNumber, setWaNumber] = useState("");
  // Owner-managed platform logo from the public branding endpoint (loaded by the
  // root loader). Falls back to the built-in Xtiitch mark + wordmark when unset.
  const branding = useRouteLoaderData("root") as
    | { brandLogoUrl?: string }
    | undefined;
  const brandLogoUrl = branding?.brandLogoUrl ?? "";
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
        sx={{
          minHeight: "100vh",
          display: "grid",
          alignItems: "center",
          py: { xs: 4, md: 7 },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, lg: 5 },
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 430px" },
            alignItems: "stretch",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.1),
              borderRadius: 2,
              bgcolor: tokens.charcoal,
              color: "common.white",
              overflow: "hidden",
              position: "relative",
              minHeight: { xs: "auto", lg: 620 },
              // Desktop-only; mobile shows just the form (+ its brand header).
              display: { xs: "none", lg: "flex" },
              flexDirection: "column",
              justifyContent: "space-between",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: "auto -12% -22% auto",
                width: 340,
                height: 340,
                borderRadius: "50%",
                border: `1px solid ${alpha(tokens.gold, 0.34)}`,
              },
            }}
          >
            <Box sx={{ position: "relative", zIndex: 1 }}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                {brandLogoUrl ? (
                  <Box
                    component="img"
                    src={brandLogoUrl}
                    alt="Xtiitch"
                    sx={{
                      height: 36,
                      width: "auto",
                      maxWidth: 160,
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
                      width: 44,
                      height: 44,
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
                    sx={{ color: alpha(tokens.white, 0.66) }}
                  >
                    Business dashboard
                  </Typography>
                </Box>
              </Stack>

              <Typography
                variant="h3"
                component="h1"
                sx={{ mt: { xs: 4, md: 7 }, maxWidth: 620 }}
              >
                Run orders, fittings, payments, and catalogue work from one calm
                desk.
              </Typography>
              <Typography
                sx={{
                  mt: 2,
                  color: alpha(tokens.white, 0.72),
                  maxWidth: 560,
                  fontSize: 17,
                }}
              >
                Built for fashion studios that need quick answers: what is paid,
                what is being made, and who needs a call next.
              </Typography>
            </Box>

            <Box sx={{ position: "relative", zIndex: 1, mt: { xs: 4, md: 6 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                {[
                  { icon: <TimelineRounded />, label: "Stage tracking" },
                  { icon: <PaymentsRounded />, label: "Paystack rails" },
                  { icon: <ShieldRounded />, label: "Tenant scoped" },
                ].map((item) => (
                  <Chip
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    sx={{
                      justifyContent: "flex-start",
                      color: "common.white",
                      bgcolor: alpha(tokens.white, 0.1),
                      border: "1px solid",
                      borderColor: alpha(tokens.white, 0.14),
                      "& .MuiChip-icon": { color: alpha(tokens.white, 0.82) },
                    }}
                  />
                ))}
              </Stack>
              <Divider sx={{ my: 3, borderColor: alpha(tokens.white, 0.12) }} />
              <Typography
                variant="body2"
                sx={{ color: alpha(tokens.white, 0.62) }}
              >
                Access is protected with an httpOnly session cookie. Re-login
                when the API rejects an expired token.
              </Typography>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.12),
              borderRadius: 3,
              alignSelf: "center",
              bgcolor: alpha(tokens.white, 0.98),
              color: tokens.ink,
              boxShadow: `0 28px 72px ${alpha(tokens.ink, 0.16)}`,
              "& .MuiTypography-root": {
                color: "inherit",
              },
              "& .MuiTypography-colorTextSecondary": {
                color: alpha(tokens.ink, 0.68),
              },
              "& .MuiInputLabel-root": {
                color: alpha(tokens.ink, 0.68),
                bgcolor: alpha(tokens.white, 0.98),
                px: 0.75,
                ml: -0.75,
                borderRadius: 1,
                "&.Mui-focused": {
                  color: tokens.burgundy,
                },
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
              "& input::placeholder": {
                color: alpha(tokens.ink, 0.48),
                opacity: 1,
              },
            }}
          >
            {/* Compact brand, mobile only (the side panel is hidden < lg). */}
            <Stack
              direction="row"
              spacing={1.25}
              sx={{
                display: { xs: "flex", lg: "none" },
                alignItems: "center",
                mb: 2.5,
              }}
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
                label={mfaRequired ? "Two-step verification" : "Owner access"}
                color="primary"
                sx={{ alignSelf: "flex-start" }}
              />
              <Typography variant="h4" component="h2">
                {mfaRequired ? "Enter your code" : "Sign in"}
              </Typography>
              <Typography sx={{ color: alpha(tokens.ink, 0.68) }}>
                {mfaRequired
                  ? "Open your authenticator app and enter the 6-digit code, or use a backup code."
                  : method === "whatsapp"
                    ? "We'll send a one-time code to your store's WhatsApp number."
                    : "Use your store handle and owner account."}
              </Typography>
            </Stack>
            {mfaRequired ? (
              <Form method="post" key="mfa">
                <input type="hidden" name="intent" value="mfa" />
                <Stack spacing={2.5}>
                  {result.error ? (
                    <Alert severity="error">{result.error}</Alert>
                  ) : null}
                  <TextField
                    name="code"
                    label="Authentication code"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="text"
                    fullWidth
                    placeholder="123456 or a backup code"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <ShieldRounded fontSize="small" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting}
                    endIcon={isSubmitting ? undefined : <LoginRounded />}
                    sx={{
                      "&.Mui-disabled": {
                        bgcolor: tokens.burgundy,
                        color: tokens.white,
                        opacity: 0.72,
                      },
                    }}
                  >
                    {isSubmitting ? (
                      <LoadingButtonLabel label="Verifying" />
                    ) : (
                      "Verify and continue"
                    )}
                  </Button>
                </Stack>
              </Form>
            ) : (
              <>
                {/* Sign-in method toggle: keep the password form untouched and
                    add a WhatsApp one-time-code path alongside it. */}
                <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
                  <Chip
                    label="Password"
                    icon={<LockRounded />}
                    clickable
                    color={method === "password" ? "primary" : "default"}
                    variant={method === "password" ? "filled" : "outlined"}
                    onClick={() => setMethod("password")}
                    aria-pressed={method === "password"}
                    sx={methodChipSx(method === "password")}
                  />
                  <Chip
                    label="WhatsApp"
                    icon={<WhatsApp />}
                    clickable
                    color={method === "whatsapp" ? "primary" : "default"}
                    variant={method === "whatsapp" ? "filled" : "outlined"}
                    onClick={() => setMethod("whatsapp")}
                    aria-pressed={method === "whatsapp"}
                    sx={methodChipSx(method === "whatsapp")}
                  />
                </Stack>
                {method === "password" ? (
                  <Form method="post" key="login">
                    <input type="hidden" name="intent" value="login" />
                    <Stack spacing={2.5}>
                      {result.error ? (
                        <Alert severity="error">{result.error}</Alert>
                      ) : null}
                      <TextField
                        name="handle"
                        label="Store handle"
                        required
                        autoComplete="username"
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
                        name="email"
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
                        name="password"
                        label="Password"
                        type="password"
                        required
                        autoComplete="current-password"
                        fullWidth
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
                      <Typography sx={{ textAlign: "right", mt: -1 }}>
                        <Link
                          href="/forgot-password"
                          sx={{ fontWeight: 700, fontSize: 14 }}
                        >
                          Forgot password?
                        </Link>
                      </Typography>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={isSubmitting}
                        endIcon={isSubmitting ? undefined : <LoginRounded />}
                        sx={{
                          "&.Mui-disabled": {
                            bgcolor: tokens.burgundy,
                            color: tokens.white,
                            opacity: 0.72,
                          },
                        }}
                      >
                        {isSubmitting ? (
                          <LoadingButtonLabel label="Signing in" />
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                      <Typography
                        variant="body2"
                        sx={{
                          textAlign: "center",
                          color: alpha(tokens.ink, 0.68),
                        }}
                      >
                        New to Xtiitch?{" "}
                        <Link href="/register" sx={{ fontWeight: 700 }}>
                          Create your store
                        </Link>
                      </Typography>
                    </Stack>
                  </Form>
                ) : (
                  <Form method="post" key="whatsapp">
                    <Stack spacing={2.5}>
                      {result.error ? (
                        <Alert severity="error">{result.error}</Alert>
                      ) : null}
                      {otpSent ? (
                        <Alert severity="success">
                          If that store and number match, a one-time code is on
                          its way to your WhatsApp. Enter it below.
                        </Alert>
                      ) : null}
                      <TextField
                        name="business_handle"
                        label="Store handle"
                        required
                        autoComplete="username"
                        fullWidth
                        value={waHandle}
                        onChange={(e) => setWaHandle(e.target.value)}
                        slotProps={{
                          input: {
                            readOnly: otpSent,
                            startAdornment: (
                              <InputAdornment position="start">
                                <StorefrontRounded fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      <TextField
                        name="whatsapp_number"
                        label="WhatsApp number"
                        required
                        autoComplete="tel"
                        inputMode="tel"
                        fullWidth
                        placeholder="0244 000 111 or +233…"
                        value={waNumber}
                        onChange={(e) => setWaNumber(e.target.value)}
                        slotProps={{
                          input: {
                            readOnly: otpSent,
                            startAdornment: (
                              <InputAdornment position="start">
                                <WhatsApp fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      {otpSent ? (
                        <TextField
                          name="code"
                          label="WhatsApp code"
                          required
                          autoFocus
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          fullWidth
                          placeholder="123456"
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <ShieldRounded fontSize="small" />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      ) : null}
                      <Button
                        type="submit"
                        name="intent"
                        value={otpSent ? "otp-verify" : "otp-request"}
                        variant="contained"
                        size="large"
                        disabled={isSubmitting}
                        endIcon={
                          isSubmitting ? undefined : otpSent ? (
                            <LoginRounded />
                          ) : (
                            <WhatsApp />
                          )
                        }
                        sx={{
                          "&.Mui-disabled": {
                            bgcolor: tokens.burgundy,
                            color: tokens.white,
                            opacity: 0.72,
                          },
                        }}
                      >
                        {isSubmitting ? (
                          <LoadingButtonLabel
                            label={otpSent ? "Verifying" : "Sending code"}
                          />
                        ) : otpSent ? (
                          "Verify and continue"
                        ) : (
                          "Send code"
                        )}
                      </Button>
                      {otpSent ? (
                        <Button
                          type="submit"
                          name="intent"
                          value="otp-request"
                          variant="text"
                          size="small"
                          disabled={isSubmitting}
                          sx={{ alignSelf: "center" }}
                        >
                          Resend code
                        </Button>
                      ) : null}
                      <Typography
                        variant="body2"
                        sx={{
                          textAlign: "center",
                          color: alpha(tokens.ink, 0.68),
                        }}
                      >
                        New to Xtiitch?{" "}
                        <Link href="/register" sx={{ fontWeight: 700 }}>
                          Create your store
                        </Link>
                      </Typography>
                    </Stack>
                  </Form>
                )}
              </>
            )}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
