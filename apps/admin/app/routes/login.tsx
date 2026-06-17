import { Form, redirect, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import type { Route } from "./+types/login";
import {
  commitSession,
  destroySession,
  getSession,
  setAdminSession,
} from "../lib/session";
import { AdminApiError, adminApi } from "../lib/api";
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
        return { error: "Admin API is unavailable. Try again after a moment." };
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

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
            display: "flex",
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
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: tokens.burgundy,
                  boxShadow: `0 18px 46px ${alpha(tokens.burgundy, 0.36)}`,
                }}
              >
                <AdminPanelSettingsRounded />
              </Box>
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
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(tokens.burgundy, 0.1),
                    color: tokens.burgundy,
                  }}
                >
                  <StorefrontRounded />
                </Box>
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
                    type="password"
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
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting}
                    endIcon={<ArrowForwardRounded />}
                    sx={{ minHeight: 48 }}
                  >
                    {isSubmitting ? "Checking access..." : "Open console"}
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
