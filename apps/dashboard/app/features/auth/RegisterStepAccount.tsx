import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import TextField from "../../components/form-text-field";

export function RegisterStepAccount({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  ownerName,
  onOwnerNameChange,
  email,
  onEmailChange,
  ownerPhone,
  onOwnerPhoneChange,
  whatsappNumber,
  onWhatsappNumberChange,
  whatsappCode,
  onWhatsappCodeChange,
  otpRequested,
  otpSending,
  otpError,
  onRequestOtp,
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
}: {
  ownerName: string;
  onOwnerNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  ownerPhone: string;
  onOwnerPhoneChange: (value: string) => void;
  whatsappNumber: string;
  onWhatsappNumberChange: (value: string) => void;
  whatsappCode: string;
  onWhatsappCodeChange: (value: string) => void;
  otpRequested: boolean;
  otpSending: boolean;
  otpError: string;
  onRequestOtp: () => void;
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
}) {
  return (
    <Stack spacing={2.5}>
      <TextField
        name="owner_display_name"
        label="Your name"
        required
        autoComplete="name"
        fullWidth
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
      <TextField
        name="owner_phone"
        label="Phone number"
        autoComplete="tel"
        inputMode="tel"
        fullWidth
        value={ownerPhone}
        onChange={(e) => onOwnerPhoneChange(e.target.value)}
        helperText="For SMS order and account notifications."
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <PhoneRounded fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Box>
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
              : "Optional — add it to confirm your number with a one-time code, or leave it blank."
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
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}
        >
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={onRequestOtp}
            disabled={!whatsappOk || otpSending}
          >
            {otpSending
              ? "Sending…"
              : otpRequested
                ? "Resend code"
                : "Send code"}
          </Button>
          {otpRequested ? (
            <Typography
              variant="caption"
              sx={{ color: "success.main", fontWeight: 700 }}
            >
              ✓ Code sent by SMS
            </Typography>
          ) : null}
        </Stack>
        {otpError ? (
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 0.75, color: "error.main" }}
          >
            {otpError}
          </Typography>
        ) : null}
      </Box>
      {otpRequested ? (
        <TextField
          name="whatsapp_code"
          label="SMS code"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          fullWidth
          placeholder="123456"
          value={whatsappCode}
          onChange={(e) => onWhatsappCodeChange(e.target.value)}
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
