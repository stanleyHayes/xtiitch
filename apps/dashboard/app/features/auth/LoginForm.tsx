import { Form, useNavigation } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";

// methodChipSx styles the Password/WhatsApp sign-in toggle. The card dims generic
// icons and the default outlined chip renders its label too faint to read, so we
// force explicit high-contrast colors: burgundy fill + white text when active,
// dark ink text + a visible border when inactive. `&&` bumps specificity so the
// icon colour beats the card's blanket `.MuiSvgIcon-root` dim.
export function methodChipSx(active: boolean) {
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

export function LoadingButtonLabel({ label }: { label: string }) {
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

export function LoginForm({
  result,
}: {
  result: { error?: string; mfaRequired?: boolean; otpSent?: boolean };
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const mfaRequired = Boolean(result.mfaRequired);
  const otpSent = Boolean(result.otpSent);
  const [method, setMethod] = useState<"password" | "whatsapp">(
    otpSent ? "whatsapp" : "password",
  );
  const [waHandle, setWaHandle] = useState("");
  const [waNumber, setWaNumber] = useState("");

  return (
    <>
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
              ? "We'll text a one-time code by SMS to your registered number."
              : "Use your store handle and owner account."}
        </Typography>
      </Stack>
      {mfaRequired ? (
        <MfaForm result={result} isSubmitting={isSubmitting} />
      ) : (
        <>
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
              label="SMS"
              icon={<SmsRounded />}
              clickable
              color={method === "whatsapp" ? "primary" : "default"}
              variant={method === "whatsapp" ? "filled" : "outlined"}
              onClick={() => setMethod("whatsapp")}
              aria-pressed={method === "whatsapp"}
              sx={methodChipSx(method === "whatsapp")}
            />
          </Stack>
          {method === "password" ? (
            <PasswordForm result={result} isSubmitting={isSubmitting} />
          ) : (
            <WhatsappForm
              result={result}
              isSubmitting={isSubmitting}
              waHandle={waHandle}
              onWaHandleChange={setWaHandle}
              waNumber={waNumber}
              onWaNumberChange={setWaNumber}
              otpSent={otpSent}
            />
          )}
        </>
      )}
    </>
  );
}

function MfaForm({
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

function PasswordForm({
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

function WhatsappForm({
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
          onChange={(e) => onWaHandleChange(e.target.value)}
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
          onChange={(e) => onWaNumberChange(e.target.value)}
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
