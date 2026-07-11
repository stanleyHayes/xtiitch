import { Form, Link } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { MFAStatus } from "./security-loader";

export type SecurityActionResult = {
  error?: string;
  context?: "password";
  setup?: { secret: string; provisioning_uri: string };
  backupCodes?: string[];
  disabled?: boolean;
  passwordChanged?: boolean;
};

export function SecurityForm({
  status,
  result,
  busy,
}: {
  status: MFAStatus;
  result: SecurityActionResult;
  busy: boolean;
}) {
  const enabled = status.enabled && !result.disabled;

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.12),
          borderRadius: 3,
        }}
      >
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <ShieldRounded sx={{ color: tokens.burgundy }} />
            <Typography variant="h5" component="h1">
              Two-step verification
            </Typography>
          </Stack>
          <Typography sx={{ color: "text.secondary" }}>
            Add a second step at sign-in using an authenticator app such as
            Google Authenticator or Authy. It protects your account even if your
            password is leaked.
          </Typography>
          <Box>
            <Chip
              icon={enabled ? <CheckCircleRounded /> : undefined}
              color={enabled ? "success" : "default"}
              label={enabled ? "Enabled" : "Not enabled"}
              size="small"
            />
          </Box>
        </Stack>

        {result.error && result.context !== "password" ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {result.error}
          </Alert>
        ) : null}

        {result.backupCodes ? (
          <Stack spacing={2}>
            <Alert severity="success">
              Two-step verification is on. Save these backup codes somewhere
              safe — each works once if you lose your phone. They will not be
              shown again.
            </Alert>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 1,
                fontFamily: "monospace",
                fontSize: 16,
                letterSpacing: 1,
              }}
            >
              {result.backupCodes.map((code) => (
                <Box key={code}>{code}</Box>
              ))}
            </Paper>
            <Button component={Link} to="/dashboard" variant="contained">
              Done
            </Button>
          </Stack>
        ) : result.setup ? (
          <Stack spacing={2.5}>
            <Typography variant="subtitle2">
              1. Add this account to your authenticator app
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Scan the setup link, or enter this key manually:
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                fontFamily: "monospace",
                fontSize: 18,
                letterSpacing: 2,
                textAlign: "center",
                wordBreak: "break-all",
              }}
            >
              {result.setup.secret}
            </Paper>
            <TextField
              label="Setup link (otpauth)"
              value={result.setup.provisioning_uri}
              fullWidth
              size="small"
              slotProps={{ input: { readOnly: true } }}
            />
            <Divider />
            <Typography variant="subtitle2">
              2. Enter the 6-digit code it shows
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="activate" />
              <Stack spacing={2}>
                <TextField
                  name="code"
                  label="6-digit code"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  fullWidth
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={busy}
                  startIcon={<KeyRounded />}
                >
                  {busy ? "Verifying…" : "Turn on two-step"}
                </Button>
              </Stack>
            </Form>
          </Stack>
        ) : enabled ? (
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              You have {status.backup_codes_left} backup code
              {status.backup_codes_left === 1 ? "" : "s"} left.
            </Typography>
            <Divider />
            <Typography variant="subtitle2">Turn off two-step</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Enter a current authenticator code or a backup code to confirm.
            </Typography>
            <Form method="post">
              <input type="hidden" name="intent" value="disable" />
              <Stack spacing={2}>
                <TextField
                  name="code"
                  label="Authentication or backup code"
                  required
                  fullWidth
                />
                <Button
                  type="submit"
                  color="error"
                  variant="outlined"
                  disabled={busy}
                >
                  {busy ? "Working…" : "Disable two-step"}
                </Button>
              </Stack>
            </Form>
          </Stack>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="setup" />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
              startIcon={<ShieldRounded />}
            >
              {busy ? "Starting…" : "Set up two-step verification"}
            </Button>
          </Form>
        )}
      </Paper>

      <Paper
        elevation={0}
        sx={{
          mt: 3,
          p: { xs: 3, md: 4 },
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.12),
          borderRadius: 3,
        }}
      >
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <KeyRounded sx={{ color: tokens.burgundy }} />
            <Typography variant="h5" component="h2">
              Change password
            </Typography>
          </Stack>
          <Typography sx={{ color: "text.secondary" }}>
            Update the password you use to sign in. Enter your current password
            to confirm it's you.
          </Typography>
        </Stack>

        {result.error && result.context === "password" ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {result.error}
          </Alert>
        ) : null}

        {result.passwordChanged ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Your password has been changed. Use it next time you sign in.
          </Alert>
        ) : null}

        <Form method="post">
          <input type="hidden" name="intent" value="change_password" />
          <Stack spacing={2}>
            <TextField
              name="current_password"
              label="Current password"
              type="password"
              required
              fullWidth
              autoComplete="current-password"
            />
            <TextField
              name="new_password"
              label="New password"
              type="password"
              required
              fullWidth
              autoComplete="new-password"
              helperText="At least 8 characters."
            />
            <TextField
              name="confirm_password"
              label="Confirm new password"
              type="password"
              required
              fullWidth
              autoComplete="new-password"
            />
            <Button
              type="submit"
              variant="contained"
              disabled={busy}
              startIcon={<KeyRounded />}
            >
              {busy ? "Saving…" : "Change password"}
            </Button>
          </Stack>
        </Form>
      </Paper>
    </>
  );
}
