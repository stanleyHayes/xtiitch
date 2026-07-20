import { useEffect, useState } from "react";
import { Form, Link as RouterLink, useNavigation } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { OwnProfile } from "./profile-loader";
import type { ProfileActionResult } from "./profile-action";

// §9 profile settings: the owner edits the details they signed up with. Name,
// email and WhatsApp save directly; a phone CHANGE follows the §8 flow —
// "Verify phone number" sends an SMS code to the new number and the save only
// goes through with that code. After a save the loader revalidates and the
// fields show the saved state (§1.2, matching the settings panels).
export function ProfileSection({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  profile,
  result,
}: {
  profile: OwnProfile;
  result: ProfileActionResult;
}) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [email, setEmail] = useState(profile.email);
  const [whatsappNumber, setWhatsappNumber] = useState(profile.whatsapp_number);
  const [phone, setPhone] = useState(profile.phone);
  const [code, setCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState<string | undefined>(undefined);

  // Revalidation after a save returns the live row — show the saved state and
  // clear the one-time code flow (§1.2, the settings-panel pattern).
  useEffect(() => {
    setDisplayName(profile.display_name);
    setEmail(profile.email);
    setWhatsappNumber(profile.whatsapp_number);
    setPhone(profile.phone);
    setCode("");
    setOtpRequested(false);
    setOtpError(undefined);
  }, [profile]);

  // The API flagged the save as needing a phone code (the owner saved a phone
  // change without one) — open the code step instead of leaving a dead error.
  useEffect(() => {
    if (result.phoneCodeNeeded) {
      setOtpRequested(true);
    }
  }, [result.phoneCodeNeeded]);

  const phoneChanged = phone.trim() !== profile.phone.trim();
  const codeComplete = /^\d{6}$/.test(code.trim());

  async function requestPhoneCode() {
    setOtpSending(true);
    setOtpError(undefined);
    try {
      const response = await fetch("/profile-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (response.ok) {
        setOtpRequested(true);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (body.error === "resend_too_soon") {
        // A code is already out and still valid, so move to the code field
        // rather than stranding the owner on a button that looks broken.
        setOtpRequested(true);
        setOtpError("A code was just sent. Check your phone before resending.");
        return;
      }
      setOtpError(
        body.error === "invalid_phone"
          ? "That doesn't look like a Ghana phone number."
          : "Could not send a code to that number. Check it and retry.",
      );
    } catch {
      setOtpError("Could not send a code right now. Try again in a moment.");
    } finally {
      setOtpSending(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        py: { xs: 4, md: 7 },
      }}
    >
      <Container maxWidth="sm">
        <Button
          component={RouterLink}
          to="/dashboard"
          startIcon={<ArrowBackRounded />}
          sx={{ mb: 2 }}
        >
          Back to dashboard
        </Button>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <PersonRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Profile settings</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                The details you signed up with — name, email, and your numbers.
              </Typography>
            </Box>
          </Stack>

          {result.saved ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Profile updated. Your details are reflected across Xtiitch.
            </Alert>
          ) : null}
          {result.error ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {result.error}
            </Alert>
          ) : null}

          <Form method="post">
            <input type="hidden" name="intent" value="save_profile" />
            {/* The code field unmounts until a phone change is being proven,
                so its value rides along in a hidden mirror on submit. */}
            <input type="hidden" name="otp_code" value={code} />
            <Stack spacing={1.75} sx={{ mt: 2.5 }}>
              <TextField
                name="display_name"
                label="Your name"
                required
                fullWidth
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <TextField
                name="email"
                label="Email address"
                type="email"
                required
                fullWidth
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {/* §8 order: the phone number field comes before the WhatsApp
                  number field, and the verify button sits with the phone
                  field. The phone is the OTP-verified number. */}
              <Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <TextField
                    name="phone"
                    label="Phone number"
                    required
                    fullWidth
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      // The code proves one specific number, so editing the
                      // number invalidates a code already sent to another.
                      setOtpRequested(false);
                      setCode("");
                    }}
                    helperText={
                      profile.phone_verified && !phoneChanged
                        ? "Verified — used for order and payout SMS."
                        : "A new number must be verified with an SMS code."
                    }
                  />
                  {phoneChanged ? (
                    <Button
                      variant="outlined"
                      onClick={requestPhoneCode}
                      disabled={!phone.trim() || otpSending}
                      sx={{
                        flexShrink: 0,
                        alignSelf: { xs: "stretch", sm: "auto" },
                        "&.Mui-disabled": { opacity: 0.6 },
                      }}
                    >
                      {otpSending
                        ? "Sending…"
                        : otpRequested
                          ? "Resend code"
                          : "Verify phone number"}
                    </Button>
                  ) : null}
                </Stack>
                {phoneChanged && otpRequested ? (
                  <>
                    <TextField
                      label="Verification code"
                      placeholder="123456"
                      required
                      fullWidth
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      slotProps={{ htmlInput: { inputMode: "numeric" } }}
                      sx={{ mt: 1.5 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ mt: 1, color: "text.secondary" }}
                    >
                      We sent a 6-digit code to {phone.trim()}. Enter it to
                      confirm the number is yours.
                    </Typography>
                  </>
                ) : null}
                {otpError ? (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    {otpError}
                  </Alert>
                ) : null}
              </Box>
              <TextField
                name="whatsapp_number"
                label="WhatsApp number"
                fullWidth
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(event.target.value)}
                helperText="Chat-only — customers reach you here. Not SMS-verified."
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveRounded />}
                disabled={busy || (phoneChanged && !codeComplete)}
                sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
              >
                Save profile
              </Button>
            </Stack>
          </Form>
        </Paper>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 2,
            textAlign: "center",
            color: alpha(tokens.ink, 0.55),
          }}
        >
          Two-step verification and your password live under Security in the
          account menu.
        </Typography>
      </Container>
    </Box>
  );
}
