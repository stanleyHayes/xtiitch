import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import PhoneIphoneRounded from "@mui/icons-material/PhoneIphoneRounded";
import ButtonDots from "../../components/button-dots";
import OtpCodeInput from "../../components/otp-code-input";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { ActionResult, OtpChannel, Step } from "./types";

export function SignInFlow({
  redirectTo,
  action,
  step,
  channel,
  phoneEnabled,
  pendingIntent,
}: {
  redirectTo: string;
  action?: ActionResult;
  step: Step;
  channel: OtpChannel;
  phoneEnabled: boolean;
  pendingIntent: string | null;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        p: { xs: 2.5, sm: 3, md: 3.5 },
        borderRadius: "18px",
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.18),
        bgcolor: "rgba(var(--surface-rgb), 0.96)",
        boxShadow: `0 30px 80px ${alpha(tokens.ink, 0.18)}`,
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${tokens.burgundy}, ${tokens.gold})`,
        },
      }}
    >
      {step === "verify" ? (
        <Stack spacing={1.5}>
          <Typography variant="h5" component="h2">
            Enter your code
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            We sent a 6-digit code to{" "}
            <strong>{action?.identifier}</strong>{" "}
            {channel === "email" ? "by email" : "by SMS"}. Enter it below.
          </Typography>
          <Form method="post">
            <input type="hidden" name="intent" value="verify" />
            <input type="hidden" name="channel" value={channel} />
            <input
              type="hidden"
              name="identifier"
              value={action?.identifier ?? ""}
            />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Stack spacing={1.75} sx={{ mt: 1 }}>
              <OtpCodeInput error={Boolean(action?.error)} />
              {action?.error ? (
                <Typography variant="body2" sx={{ color: "error.main" }}>
                  {action.error}
                </Typography>
              ) : null}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={pendingIntent === "verify"}
                endIcon={
                  pendingIntent === "verify" ? undefined : (
                    <ArrowForwardRounded />
                  )
                }
              >
                {pendingIntent === "verify" ? (
                  <ButtonDots label="Verifying" />
                ) : (
                  "Verify & sign in"
                )}
              </Button>
            </Stack>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="request" />
            <input type="hidden" name="channel" value={channel} />
            <input
              type="hidden"
              name="identifier"
              value={action?.identifier ?? ""}
            />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button
              type="submit"
              variant="text"
              size="small"
              sx={{ color: "text.secondary", px: 0 }}
            >
              {channel === "email"
                ? "Resend code / change email"
                : "Resend code / change number"}
            </Button>
          </Form>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <Typography variant="h5" component="h2">
            {channel === "email"
              ? "Sign in with your email"
              : "Sign in with your phone"}
          </Typography>

          {/* Channel switch: SMS | Email. Each tab re-renders this
              form pre-selected on that channel (no client JS). */}
          <Stack
            direction="row"
            spacing={0}
            sx={{
              p: 0.5,
              borderRadius: 999,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.12),
              bgcolor: alpha(tokens.ink, 0.03),
              width: "fit-content",
            }}
          >
            {(
              [
                {
                  value: "whatsapp",
                  label: "SMS",
                  Icon: PhoneIphoneRounded,
                },
                { value: "email", label: "Email", Icon: EmailRounded },
              ] as const
            ).map((tab) => {
              const selected = channel === tab.value;
              // No phone-OTP channel configured (neither SMS nor WhatsApp) →
              // the code would never deliver. Disable the tab + annotate
              // "Soon"; it re-enables automatically when the flag flips true.
              const disabled = tab.value === "whatsapp" && !phoneEnabled;
              return (
                <Form method="post" key={tab.value}>
                  <input type="hidden" name="intent" value="switch" />
                  <input type="hidden" name="channel" value={tab.value} />
                  <Button
                    type="submit"
                    disabled={disabled}
                    startIcon={<tab.Icon fontSize="small" />}
                    aria-pressed={selected}
                    endIcon={
                      disabled ? (
                        <Box
                          component="span"
                          sx={{
                            px: 0.75,
                            py: 0.125,
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            lineHeight: 1.4,
                            color: tokens.burgundy,
                            bgcolor: alpha(tokens.burgundy, 0.12),
                          }}
                        >
                          Soon
                        </Box>
                      ) : undefined
                    }
                    sx={{
                      px: 2,
                      borderRadius: 999,
                      fontWeight: 800,
                      color: selected ? "#fff" : "text.secondary",
                      bgcolor: selected ? tokens.burgundy : "transparent",
                      "&:hover": {
                        bgcolor: selected
                          ? tokens.burgundy
                          : alpha(tokens.burgundy, 0.08),
                      },
                      "&.Mui-disabled": {
                        color: "text.disabled",
                      },
                    }}
                  >
                    {tab.label}
                  </Button>
                </Form>
              );
            })}
          </Stack>

          <Typography sx={{ color: "text.secondary" }}>
            {channel === "email"
              ? "We'll email you a one-time code. No password needed."
              : "We'll text you a one-time code by SMS. No password needed."}
          </Typography>
          <Form method="post">
            <input type="hidden" name="intent" value="request" />
            <input type="hidden" name="channel" value={channel} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {channel === "email" ? (
                <TextField
                  name="identifier"
                  label="Email address"
                  placeholder="you@example.com"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  fullWidth
                  error={Boolean(action?.error)}
                  helperText={action?.error}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailRounded fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              ) : (
                <TextField
                  name="identifier"
                  label="Phone number"
                  placeholder="024 000 0000"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  fullWidth
                  error={Boolean(action?.error)}
                  helperText={action?.error}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIphoneRounded fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              )}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={pendingIntent === "request"}
                endIcon={
                  pendingIntent === "request" ? undefined : (
                    <ArrowForwardRounded />
                  )
                }
              >
                {pendingIntent === "request" ? (
                  <ButtonDots label="Sending" />
                ) : (
                  "Send my code"
                )}
              </Button>
            </Stack>
          </Form>
        </Stack>
      )}
    </Box>
  );
}
