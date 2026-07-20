import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import TextField from "../../components/form-text-field";
import {
  codeFieldVisible,
  fieldsFrozen,
  phoneLocked,
  whatsappVisible,
  type PhoneVerificationState,
} from "../../lib/phone-verification";
import { tokens } from "../../theme";

export function RegisterStepAccount({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  ownerName,
  onOwnerNameChange,
  email,
  onEmailChange,
  ownerPhone,
  onOwnerPhoneChange,
  whatsappNumber,
  onWhatsappNumberChange,
  verification,
  onCodeChange,
  onRequestOtp,
  onChangePhone,
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  showPassword,
  onToggleShowPassword,
  emailOk,
  passwordOk,
  passwordsMatch,
  whatsappOk,
  phoneOk,
}: {
  ownerName: string;
  onOwnerNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  ownerPhone: string;
  onOwnerPhoneChange: (value: string) => void;
  whatsappNumber: string;
  onWhatsappNumberChange: (value: string) => void;
  // §8 verification state machine (app/lib/phone-verification.ts) — owned by
  // the parent reducer; this component only renders it.
  verification: PhoneVerificationState;
  onCodeChange: (value: string) => void;
  onRequestOtp: () => void;
  // Explicit "Change number" affordance — the only way to edit the phone once
  // it is verified (§8: no editing without re-verifying).
  onChangePhone: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  emailOk: boolean;
  passwordOk: boolean;
  passwordsMatch: boolean;
  whatsappOk: boolean;
  phoneOk: boolean;
}) {
  // §8.2/§8.3: once the code is sent, every field but phone + code stays frozen
  // until it verifies; MUI's disabled state supplies the "dimmed" treatment.
  const frozen = fieldsFrozen(verification);
  const locked = phoneLocked(verification);
  const showCodeField = codeFieldVisible(verification);
  const showWhatsapp = whatsappVisible(verification);
  const checking = verification.status === "checking";
  // "Code sent" only once a code is genuinely in the wild — reverify_needed
  // (post-verification phone change) has nothing sent for the new number yet.
  const codeSent = verification.status === "awaiting_code" || checking;

  return (
    <Stack spacing={2.5}>
      <TextField
        name="owner_display_name"
        label="Your name"
        required
        autoComplete="name"
        fullWidth
        disabled={frozen}
        value={ownerName}
        onChange={(e) => onOwnerNameChange(e.target.value)}
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
        required
        autoComplete="email"
        fullWidth
        disabled={frozen}
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
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
      {/* §8.1: the phone field (with its verify button) comes before WhatsApp. */}
      <Box>
        <TextField
          name="owner_phone"
          label="Phone number"
          autoComplete="tel"
          inputMode="tel"
          fullWidth
          value={ownerPhone}
          onChange={(e) => onOwnerPhoneChange(e.target.value)}
          error={ownerPhone.length > 0 && !phoneOk}
          helperText={
            ownerPhone.length > 0 && !phoneOk
              ? "Enter a valid phone number."
              : locked
                ? "Verified — use “Change number” to use a different one."
                : "For SMS order and account notifications — verify it with a one-time code."
          }
          slotProps={{
            input: {
              // §8: once verified the phone is read-only — re-verifying (via
              // "Change number") is the only way back in.
              readOnly: locked,
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneRounded fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: locked ? (
                <InputAdornment position="end">
                  <CheckCircleRounded fontSize="small" color="success" />
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}
        >
          {locked ? (
            <>
              {/* §8.4: verified indicator replaces the button. */}
              <Chip
                icon={<CheckCircleRounded />}
                label="Phone verified"
                color="success"
                size="small"
                variant="outlined"
              />
              <Button type="button" size="small" onClick={onChangePhone}>
                Change number
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={onRequestOtp}
                disabled={!phoneOk || verification.sending || checking}
                // Keep the disabled state clearly visible: it used to fade into
                // the white card, so on mobile the button read as absent until a
                // number enabled it. It is always rendered; only its enablement
                // changes.
                sx={{
                  "&.Mui-disabled": {
                    color: alpha(tokens.ink, 0.42),
                    borderColor: alpha(tokens.ink, 0.24),
                  },
                }}
              >
                {verification.sending
                  ? "Sending…"
                  : codeSent
                    ? "Resend code"
                    : "Verify phone number"}
              </Button>
              {codeSent ? (
                <Typography
                  variant="caption"
                  sx={{ color: "success.main", fontWeight: 700 }}
                >
                  ✓ Code sent by SMS
                </Typography>
              ) : null}
            </>
          )}
        </Stack>
        {verification.error ? (
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 0.75, color: "error.main" }}
          >
            {verification.error}
          </Typography>
        ) : null}
        {/* §8.2: the code field pops up DIRECTLY UNDER the button — not under
            WhatsApp as before — and stays (disabled) after verification so the
            WhatsApp field revealed below keeps the flow moving downward (§8.4).
            The 6th digit auto-submits the check (see use-phone-verification). */}
        {showCodeField ? (
          <TextField
            name="owner_phone_code"
            label="SMS code"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            fullWidth
            placeholder="123456"
            disabled={checking || locked}
            value={verification.code}
            onChange={(e) => onCodeChange(e.target.value)}
            helperText={
              checking
                ? "Checking the code…"
                : locked
                  ? "Code verified."
                  : "The 6-digit code we sent to your phone — it checks itself once complete."
            }
            sx={{ mt: 1.5 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneRounded fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: checking ? (
                  <InputAdornment position="end">
                    <CircularProgress size={18} />
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        ) : null}
      </Box>
      {/* §8.4: no WhatsApp field at all until the phone is verified — then it
          appears beneath the code field. */}
      {showWhatsapp ? (
        <TextField
          name="whatsapp_number"
          label="WhatsApp number (optional)"
          autoComplete="tel"
          inputMode="tel"
          fullWidth
          placeholder="0244 000 111 or +233…"
          value={whatsappNumber}
          onChange={(e) => onWhatsappNumberChange(e.target.value)}
          error={whatsappNumber.length > 0 && !whatsappOk}
          helperText={
            whatsappNumber.length > 0 && !whatsappOk
              ? "Enter a valid WhatsApp number."
              : "Optional — used to chat with customers about their orders."
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
      ) : null}
      <TextField
        name="owner_password"
        label="Password"
        type={showPassword ? "text" : "password"}
        required
        autoComplete="new-password"
        fullWidth
        disabled={frozen}
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
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
                  onClick={onToggleShowPassword}
                  edge="end"
                  size="small"
                  disabled={frozen}
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
        required
        autoComplete="new-password"
        fullWidth
        disabled={frozen}
        value={confirmPassword}
        onChange={(e) => onConfirmPasswordChange(e.target.value)}
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
                  onClick={onToggleShowPassword}
                  edge="end"
                  size="small"
                  disabled={frozen}
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
  );
}
