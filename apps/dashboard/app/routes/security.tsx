import { Form, Link, redirect, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import type { Route } from "./+types/security";
import { fetchApi } from "../lib/api-base";
import TextField from "../components/form-text-field";
import { getSession } from "../lib/session";
import { tokens } from "../theme";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Security · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

type MFAStatus = {
  enabled: boolean;
  enrolled: boolean;
  backup_codes_left: number;
};

async function requireAccess(request: Request): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  const access = session.get("access");
  if (!access) {
    throw redirect("/login");
  }
  return access;
}

export async function loader({ request }: Route.LoaderArgs) {
  const access = await requireAccess(request);
  let status: MFAStatus = {
    enabled: false,
    enrolled: false,
    backup_codes_left: 0,
  };
  try {
    const response = await fetchApi("/auth/business/mfa", {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (response.status === 401) {
      throw redirect("/login");
    }
    if (response.ok) {
      status = (await response.json()) as MFAStatus;
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    // Network blip: fall back to the safe default (not enrolled).
  }
  return { status };
}

export async function action({ request }: Route.ActionArgs) {
  const access = await requireAccess(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const auth = { Authorization: `Bearer ${access}` };

  // An expired/revoked access token surfaces as 401 on these POSTs; send the
  // user back to sign in rather than showing a misleading "wrong code" error.
  const redirectIfUnauthorized = (response: Response) => {
    if (response.status === 401) {
      throw redirect("/login");
    }
  };

  if (intent === "setup") {
    const response = await fetchApi("/auth/business/mfa/setup", {
      method: "POST",
      headers: auth,
    });
    redirectIfUnauthorized(response);
    if (!response.ok) {
      return { error: "Could not start setup. Try again." };
    }
    const setup = (await response.json()) as {
      secret: string;
      provisioning_uri: string;
    };
    return { setup };
  }

  if (intent === "activate") {
    const code = String(form.get("code") ?? "").trim();
    const response = await fetchApi("/auth/business/mfa/activate", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    redirectIfUnauthorized(response);
    if (!response.ok) {
      return { error: "That code didn't match. Check the time on your phone and try again." };
    }
    const data = (await response.json()) as { backup_codes: string[] };
    return { backupCodes: data.backup_codes };
  }

  if (intent === "disable") {
    const code = String(form.get("code") ?? "").trim();
    const response = await fetchApi("/auth/business/mfa/disable", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    redirectIfUnauthorized(response);
    if (!response.ok) {
      return { error: "That code didn't match, so two-step is still on." };
    }
    return { disabled: true };
  }

  return { error: "Unknown action." };
}

export default function Security({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const result = (actionData ?? {}) as {
    error?: string;
    setup?: { secret: string; provisioning_uri: string };
    backupCodes?: string[];
    disabled?: boolean;
  };
  const status = loaderData.status;
  const enabled = status.enabled && !result.disabled;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", py: { xs: 4, md: 7 } }}>
      <Container maxWidth="sm">
        <Button
          component={Link}
          to="/dashboard"
          startIcon={<ArrowBackRounded />}
          sx={{ mb: 2 }}
        >
          Back to dashboard
        </Button>

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
              Google Authenticator or Authy. It protects your account even if
              your password is leaked.
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

          {result.error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {result.error}
            </Alert>
          ) : null}

          {/* Just-enabled: show the one-time backup codes. */}
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
            /* Mid-enrolment: scan/enter the key, then confirm a code. */
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
            /* Enabled steady state: show remaining backup codes + disable. */
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
                  <Button type="submit" color="error" variant="outlined" disabled={busy}>
                    {busy ? "Working…" : "Disable two-step"}
                  </Button>
                </Stack>
              </Form>
            </Stack>
          ) : (
            /* Not enabled: offer to start enrolment. */
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
      </Container>
    </Box>
  );
}
