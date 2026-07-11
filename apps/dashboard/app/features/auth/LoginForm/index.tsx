import { useNavigation } from "react-router";
import { useState } from "react";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import SmsRounded from "@mui/icons-material/SmsRounded";
import Box from "@mui/material/Box";
import { tokens } from "../../../theme";
import { MfaForm, PasswordForm, WhatsappForm } from "./LoginFields";

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
