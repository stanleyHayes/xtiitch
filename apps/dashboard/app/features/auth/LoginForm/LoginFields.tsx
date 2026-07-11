import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LoginRounded from "@mui/icons-material/LoginRounded";
import SmsRounded from "@mui/icons-material/SmsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../../components/form-text-field";
import { tokens } from "../../../theme";
import { LoadingButtonLabel } from "./index";

export function MfaForm({
  result,
  isSubmitting,
}: {
  result: { error?: string };
  isSubmitting: boolean;
}) {
  return (
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
  );
}

export function PasswordForm({
  result,
  isSubmitting,
}: {
  result: { error?: string };
  isSubmitting: boolean;
}) {
  return (
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
          <Link href="/forgot-password" sx={{ fontWeight: 700, fontSize: 14 }}>
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
          {isSubmitting ? <LoadingButtonLabel label="Signing in" /> : "Sign in"}
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
  );
}

export function WhatsappForm({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  result,
  isSubmitting,
  waHandle,
  onWaHandleChange,
  waNumber,
  onWaNumberChange,
  otpSent,
}: {
  result: { error?: string };
  isSubmitting: boolean;
  waHandle: string;
  onWaHandleChange: (value: string) => void;
  waNumber: string;
  onWaNumberChange: (value: string) => void;
  otpSent: boolean;
}) {
  return (
    <Form method="post" key="whatsapp">
      <Stack spacing={2.5}>
        {result.error ? (
          <Alert severity="error">{result.error}</Alert>
        ) : null}
        {otpSent ? (
          <Alert severity="success">
            If that store and number match, a one-time code is on its way to you
            by SMS. Enter it below.
          </Alert>
        ) : null}
        <TextField
          name="business_handle"
          label="Store handle"
          required
          autoComplete="username"
          fullWidth
          value={waHandle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onWaHandleChange(e.target.value)}
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
          label="Phone / WhatsApp number"
          required
          autoComplete="tel"
          inputMode="tel"
          fullWidth
          placeholder="0244 000 111 or +233…"
          value={waNumber}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onWaNumberChange(e.target.value)}
          slotProps={{
            input: {
              readOnly: otpSent,
              startAdornment: (
                <InputAdornment position="start">
                  <SmsRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {otpSent ? (
          <TextField
            name="code"
            label="SMS code"
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
              <SmsRounded />
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
  );
}
