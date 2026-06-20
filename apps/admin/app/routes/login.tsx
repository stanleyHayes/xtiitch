import { useState } from "react";
import { Form, redirect, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import type { Route } from "./+types/login";
import {
  commitSession,
  destroySession,
  getSession,
  setAdminSession,
} from "../lib/session";
import { AdminApiError, adminApi, adminApiBase } from "../lib/api";
import TextField from "../components/form-text-field";
import { tokens } from "../theme";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Admin sign in · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return null;
  }

  const currentAdmin = await adminApi.me(accessToken).catch(() => null);
  if (currentAdmin) {
    return redirect("/admin");
  }

  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your operator email and password." };
  }

  let auth;
  try {
    auth = await adminApi.login(email, password);
  } catch (error) {
    if (error instanceof AdminApiError) {
      if (error.code === "invalid_credentials") {
        return { error: "Those operator credentials are not valid." };
      }
      if (error.code === "admin_api_unavailable") {
        const message =
          process.env.NODE_ENV === "production"
            ? "Admin API is unavailable. Try again after a moment."
            : `Admin API is unavailable. Start the API at ${adminApiBase} and try again.`;
        return { error: message };
      }
    }
    return { error: "Admin sign in failed. Try again after a moment." };
  }

  const session = await getSession(request.headers.get("Cookie"));
  setAdminSession(session, auth);

  return redirect("/admin", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
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
  const [showPassword, setShowPassword] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);

  const commandSignals = [
    {
      icon: <VerifiedUserRounded />,
      label: "Verification",
      helper: "Approve businesses only after identity and settlement checks.",
      tone: tokens.warning,
    },
    {
      icon: <PaymentsRounded />,
      label: "Money rails",
      helper: "Watch Paystack events without holding customer funds.",
      tone: tokens.success,
    },
    {
      icon: <WarningAmberRounded />,
      label: "Risk desk",
      helper: "Review tenant flags, holds, and sensitive operator actions.",
      tone: tokens.danger,
    },
  ];

  const securityRows = [
    ["Session", "HttpOnly admin cookie"],
    ["Scope", "Dedicated admin JWT"],
    ["Trace", "Audit trail enabled"],
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: tokens.cream,
        color: tokens.ink,
        display: "flex",
        alignItems: "stretch",
        p: { xs: 1.5, md: 2.5 },
      }}
    >
      <Box
        sx={{
          width: "100%",
          minHeight: { xs: "calc(100vh - 24px)", md: "calc(100vh - 40px)" },
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 1.05fr) minmax(420px, 0.95fr)",
          },
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.1),
          borderRadius: 2,
          position: "relative",
          overflow: "hidden",
          bgcolor: tokens.white,
          boxShadow: `0 30px 90px ${alpha(tokens.ink, 0.12)}`,
        }}
      >
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            bgcolor: tokens.charcoal,
            color: tokens.white,
            px: { xs: 3, md: 5, xl: 6 },
            py: { xs: 3, md: 5 },
            // Mobile shows only the form (+ a compact brand header in it); the
            // decorative panel is desktop-only.
            display: { xs: "none", lg: "flex" },
            flexDirection: "column",
            justifyContent: "space-between",
            gap: { xs: 5, md: 7 },
            minHeight: { xs: 560, lg: "auto" },
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px),
              linear-gradient(135deg, ${alpha(tokens.burgundy, 0.9)} 0%, ${tokens.charcoal} 46%, #17121a 100%)
            `,
            backgroundSize: "40px 40px, 40px 40px, 100% 100%",
          }}
        >
          <AdminPanelSettingsRounded
            aria-hidden
            sx={{
              position: "absolute",
              right: { xs: -54, md: -36 },
              top: { xs: 94, md: 86 },
              fontSize: { xs: 220, md: 300 },
              color: alpha(tokens.white, 0.06),
              transform: "rotate(-8deg)",
            }}
          />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              position: "relative",
              zIndex: 1,
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box
                component="img"
                src="/favicon.svg"
                alt="Xtiitch"
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  boxShadow: `0 18px 46px ${alpha(tokens.burgundy, 0.36)}`,
                  display: "block",
                }}
              />
              <Box>
                <Typography variant="h6" sx={{ lineHeight: 1 }}>
                  Xtiitch Admin
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: alpha(tokens.white, 0.64), fontWeight: 800 }}
                >
                  admin.xtiitch.com
                </Typography>
              </Box>
            </Stack>
            <Chip
              icon={<ShieldRounded />}
              label="Restricted operator entry"
              sx={{
                width: "fit-content",
                borderRadius: 2,
                bgcolor: alpha(tokens.white, 0.1),
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.18),
                "& .MuiChip-icon": { color: tokens.white },
              }}
            />
          </Stack>

          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
            <Typography
              variant="overline"
              sx={{
                color: alpha(tokens.white, 0.68),
                fontWeight: 900,
                letterSpacing: 0,
              }}
            >
              Platform operations
            </Typography>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                mt: 1.5,
                fontSize: { xs: 42, sm: 56, xl: 68 },
                lineHeight: 0.94,
                maxWidth: 620,
              }}
            >
              One secure door into the control room.
            </Typography>
            <Typography
              sx={{
                mt: 3,
                color: alpha(tokens.white, 0.74),
                fontSize: { xs: 17, md: 19 },
                maxWidth: 560,
              }}
            >
              Review businesses, payments, risk, support, settings, and audit
              trails from the dedicated operator console.
            </Typography>
          </Box>

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              {commandSignals.map((item) => (
                <Paper
                  key={item.label}
                  sx={{
                    p: 2,
                    minHeight: 156,
                    borderRadius: 2,
                    bgcolor: alpha(tokens.white, 0.085),
                    border: "1px solid",
                    borderColor: alpha(tokens.white, 0.13),
                    color: tokens.white,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 1.5,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(item.tone, 0.16),
                      color: item.tone,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>
                      {item.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.75, color: alpha(tokens.white, 0.66) }}
                    >
                      {item.helper}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 0 }}
              sx={{
                mt: 2,
                p: 1,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.14),
                borderRadius: 2,
                bgcolor: alpha(tokens.ink, 0.2),
                justifyContent: "space-between",
              }}
            >
              {securityRows.map(([label, value]) => (
                <Box key={label} sx={{ px: 1.25, py: 0.75, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: alpha(tokens.white, 0.56), fontWeight: 800 }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: tokens.white, fontWeight: 900 }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>

        <Box
          sx={{
            position: "relative",
            bgcolor: tokens.panel,
            display: "grid",
            placeItems: "center",
            px: { xs: 2.5, sm: 4, md: 6 },
            py: { xs: 4, md: 7 },
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(21,17,26,0.035) 1px, transparent 1px),
                linear-gradient(90deg, rgba(21,17,26,0.03) 1px, transparent 1px)
              `,
              backgroundSize: "34px 34px",
              pointerEvents: "none",
            }}
          />

          <Paper
            elevation={0}
            sx={{
              position: "relative",
              width: "100%",
              maxWidth: 500,
              p: { xs: 3, md: 4 },
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.1),
              borderRadius: 2,
              boxShadow: `0 28px 70px ${alpha(tokens.ink, 0.1)}`,
            }}
          >
            <Stack spacing={2.5}>
              {/* Compact brand, mobile only (the side panel is hidden < lg). */}
              <Stack
                direction="row"
                spacing={1.25}
                sx={{
                  display: { xs: "flex", lg: "none" },
                  alignItems: "center",
                }}
              >
                <Box
                  component="img"
                  src="/favicon.svg"
                  alt="Xtiitch"
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    display: "block",
                  }}
                />
                <Typography variant="h6" sx={{ lineHeight: 1 }}>
                  Xtiitch Admin
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Box
                  component="img"
                  src="/favicon.svg"
                  alt="Xtiitch"
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 2,
                    display: "block",
                  }}
                />
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 900,
                      letterSpacing: 0,
                    }}
                  >
                    Operator access
                  </Typography>
                  <Typography
                    variant="h4"
                    component="h2"
                    sx={{ lineHeight: 1.04 }}
                  >
                    Sign in to Admin
                  </Typography>
                </Box>
              </Stack>

              <Divider />

              <Form method="post">
                <Stack spacing={2.25}>
                  {actionData?.error ? (
                    <Alert severity="error">{actionData.error}</Alert>
                  ) : null}
                  <TextField
                    name="email"
                    label="Operator email"
                    type="email"
                    required
                    autoComplete="email"
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailRounded />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    name="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockRounded />
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
                              tabIndex={-1}
                              sx={{ color: "text.secondary" }}
                            >
                              {showPassword ? (
                                <VisibilityOffRounded />
                              ) : (
                                <VisibilityRounded />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      type="button"
                      variant="text"
                      size="small"
                      onClick={() => setShowResetHelp((v) => !v)}
                      sx={{
                        color: "primary.main",
                        fontWeight: 700,
                        textTransform: "none",
                        px: 0.5,
                        minWidth: 0,
                      }}
                    >
                      Forgot password?
                    </Button>
                  </Box>
                  {showResetHelp ? (
                    <Alert severity="info">
                      Operator accounts are managed. Ask the platform owner to
                      reset your password (or re-issue it via ADMIN_BOOTSTRAP).
                    </Alert>
                  ) : null}
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting}
                    endIcon={isSubmitting ? undefined : <ArrowForwardRounded />}
                    sx={{
                      minHeight: 48,
                      "&.Mui-disabled": {
                        bgcolor: tokens.burgundy,
                        color: tokens.white,
                        opacity: 0.72,
                      },
                    }}
                  >
                    {isSubmitting ? (
                      <LoadingButtonLabel label="Opening console" />
                    ) : (
                      "Open console"
                    )}
                  </Button>
                </Stack>
              </Form>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(tokens.burgundy, 0.045),
                  border: "1px solid",
                  borderColor: alpha(tokens.burgundy, 0.12),
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ alignItems: "flex-start" }}
                >
                  <ShieldRounded sx={{ color: tokens.burgundy, mt: 0.25 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>
                      Protected operator session
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ mt: 0.5, color: "text.secondary" }}
                    >
                      Access tokens stay server-side in the signed admin
                      session.
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Chip
                  icon={<ShieldRounded />}
                  label="HttpOnly"
                  variant="outlined"
                />
                <Chip
                  icon={<VerifiedUserRounded />}
                  label="RBAC"
                  variant="outlined"
                />
                <Chip
                  icon={<AdminPanelSettingsRounded />}
                  label="Audit trail"
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
