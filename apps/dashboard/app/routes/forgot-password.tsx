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
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import VpnKeyRounded from "@mui/icons-material/VpnKeyRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import type { Route } from "./+types/forgot-password";
import { fetchApi } from "../lib/api-base";
import TextField from "../components/form-text-field";
import { tokens } from "../theme";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Reset your password · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

type ActionResult = {
  stage: "request" | "confirm";
  email?: string;
  error?: string;
  sent?: boolean;
};

export async function action({ request }: Route.ActionArgs): Promise<ActionResult | Response> {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "request");
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (intent === "confirm") {
    const code = String(form.get("code") ?? "").trim();
    const newPassword = String(form.get("new_password") ?? "");
    if (newPassword.length < 8) {
      return {
        stage: "confirm",
        email,
        error: "Choose a password with at least 8 characters.",
      };
    }
    let response: Response;
    try {
      response = await fetchApi("/auth/business/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });
    } catch {
      return {
        stage: "confirm",
        email,
        error: "Dashboard API is unavailable. Try again in a moment.",
      };
    }
    if (!response.ok) {
      return {
        stage: "confirm",
        email,
        error: "That code is invalid or has expired. Request a new one below.",
      };
    }
    return redirect("/login?reset=1");
  }

  // intent === "request"
  if (!email) {
    return { stage: "request", error: "Enter the email for your account." };
  }
  try {
    // Fire-and-forget: the API always answers 204, so we never reveal whether
    // the email is registered. Even a transport error advances the UI.
    await fetchApi("/auth/business/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    /* fall through — don't leak existence on transport errors */
  }
  return { stage: "confirm", email, sent: true };
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) { // eslint-disable-line complexity, max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const data = (actionData ?? {}) as ActionResult;
  const stage = data.stage ?? "request";
  const email = data.email ?? "";
  const [showPassword, setShowPassword] = useState(false);

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
              label="Reset access"
              color="primary"
              sx={{ alignSelf: "flex-start" }}
            />
            <Typography variant="h4" component="h1">
              Forgot your password?
            </Typography>
            <Typography sx={{ color: alpha(tokens.ink, 0.68) }}>
              {stage === "request"
                ? "Enter your account email and we'll send a 6-digit reset code."
                : "Enter the code we emailed you and choose a new password."}
            </Typography>
          </Stack>

          {stage === "request" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="request" />
              <Stack spacing={2.5}>
                {data.error ? (
                  <Alert severity="error">{data.error}</Alert>
                ) : null}
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  required
                  autoComplete="email"
                  fullWidth
                  defaultValue={email}
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
                  {isSubmitting ? "Sending code…" : "Send reset code"}
                </Button>
              </Stack>
            </Form>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="confirm" />
              <input type="hidden" name="email" value={email} />
              <Stack spacing={2.5}>
                {data.sent ? (
                  <Alert severity="success">
                    If an account exists for <strong>{email}</strong>, a 6-digit
                    code is on its way. It expires in 15 minutes.
                  </Alert>
                ) : null}
                {data.error ? (
                  <Alert severity="error">{data.error}</Alert>
                ) : null}
                <TextField
                  name="code"
                  label="6-digit code"
                  required
                  fullWidth
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <VpnKeyRounded fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  name="new_password"
                  label="New password"
                  type={showPassword ? "text" : "password"}
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
                  {isSubmitting ? "Updating…" : "Set new password"}
                </Button>
                <Typography
                  variant="body2"
                  sx={{ textAlign: "center", color: alpha(tokens.ink, 0.68) }}
                >
                  Didn't get a code?{" "}
                  <Link
                    component={RouterLink}
                    to="/forgot-password"
                    sx={{ fontWeight: 700 }}
                  >
                    Start over
                  </Link>
                </Typography>
              </Stack>
            </Form>
          )}

          <Typography
            variant="body2"
            sx={{ textAlign: "center", color: alpha(tokens.ink, 0.68), mt: 2.5 }}
          >
            Remembered it?{" "}
            <Link component={RouterLink} to="/login" sx={{ fontWeight: 700 }}>
              Back to sign in
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
