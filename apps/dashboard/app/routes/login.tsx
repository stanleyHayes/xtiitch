import { Form, redirect, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LoginRounded from "@mui/icons-material/LoginRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
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

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
  };
  const session = await getSession(request.headers.get("Cookie"));
  session.set("access", data.access_token);
  session.set("refresh", data.refresh_token);

  return redirect("/dashboard", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
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
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(tokens.burgundy, 0.34),
                    border: "1px solid",
                    borderColor: alpha(tokens.white, 0.16),
                  }}
                >
                  <StorefrontRounded />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, lineHeight: 1 }}>
                    Xtiitch
                  </Typography>
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
              <Box>
                <Typography sx={{ fontWeight: 800, lineHeight: 1 }}>
                  Xtiitch
                </Typography>
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
                label="Owner access"
                color="primary"
                sx={{ alignSelf: "flex-start" }}
              />
              <Typography variant="h4" component="h2">
                Sign in
              </Typography>
              <Typography sx={{ color: alpha(tokens.ink, 0.68) }}>
                Use your store handle and owner account.
              </Typography>
            </Stack>
            <Form method="post">
              <Stack spacing={2.5}>
                {actionData?.error ? (
                  <Alert severity="error">{actionData.error}</Alert>
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
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isSubmitting}
                  startIcon={
                    isSubmitting ? (
                      <Skeleton
                        variant="rounded"
                        width={18}
                        height={18}
                        sx={{
                          bgcolor: "rgba(255,255,255,0.54)",
                          borderRadius: 1,
                        }}
                      />
                    ) : undefined
                  }
                  endIcon={isSubmitting ? undefined : <LoginRounded />}
                >
                  {isSubmitting ? (
                    <Skeleton
                      variant="text"
                      width={72}
                      sx={{
                        bgcolor: "rgba(255,255,255,0.54)",
                        fontSize: "1rem",
                      }}
                    />
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </Stack>
            </Form>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
