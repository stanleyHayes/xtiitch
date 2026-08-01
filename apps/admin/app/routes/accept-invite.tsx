import { useState } from "react";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";
import TextField from "../components/form-text-field";
import { adminApi } from "../lib/api";
import { tokens } from "../theme";

// Where an invited operator sets their own password.
//
// Public: they have no account yet, so the one-time token in the link is the
// authorisation — which is why it expires in 48 hours and works exactly once.
export const meta: MetaFunction = () => [
  { title: "Accept your invite · Xtiitch" },
  { name: "robots", content: "noindex, nofollow" },
];

const MIN_PASSWORD_LENGTH = 8;

export async function loader({ request }: LoaderFunctionArgs) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) {
    return { invite: null };
  }
  try {
    return { invite: await adminApi.lookupInvite(token) };
  } catch {
    // Expired, already used, or never existed — all the same to the page, so
    // the link cannot be used to probe for accounts.
    return { invite: null };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");

  if (password !== confirmation) {
    return { error: "Those passwords do not match." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  try {
    await adminApi.acceptInvite(token, password);
  } catch {
    return {
      error:
        "That invite link is no longer valid. It may have expired or already been used. Ask for a new one.",
    };
  }
  // Deliberately not signed in here: signing in with the password they just
  // chose proves it works while the invite is still fresh in mind, rather than
  // discovering a typo on their next visit.
  return redirect("/login?invited=1");
}

export default function AcceptInvite() {
  const { invite } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [search] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const submitting = navigation.state === "submitting";
  const token = search.get("token") ?? "";

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: { xs: 2, sm: 4 },
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 460 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(tokens.burgundy, 0.09),
            color: tokens.burgundy,
            mb: 2.5,
          }}
        >
          <ShieldRounded />
        </Box>

        {invite ? (
          <>
            <Typography
              variant="overline"
              sx={{ color: tokens.burgundy, fontWeight: 900 }}
            >
              Operator access
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
              Choose your password
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mb: 3 }}
            >
              {invite.displayName}, you have been given{" "}
              <strong>{invite.role}</strong> access to the Xtiitch operations
              console as {invite.email}. Nobody else sees this password.
            </Typography>

            <Form method="post">
              <input type="hidden" name="token" value={token} />
              <Stack spacing={2}>
                {result?.error ? (
                  <Alert severity="error">{result.error}</Alert>
                ) : null}
                <TextField
                  name="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockRounded />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            aria-pressed={showPassword}
                            onClick={() => setShowPassword((value) => !value)}
                            edge="end"
                          >
                            {showPassword ? (
                              <VisibilityOffRounded />
                            ) : (
                              <VisibilityRounded />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  name="confirmation"
                  label="Confirm password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                >
                  {submitting ? "Setting your password…" : "Set password"}
                </Button>
              </Stack>
            </Form>
          </>
        ) : (
          <>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
              This invite is no longer valid
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mb: 3 }}
            >
              Invite links work once and expire after 48 hours. Ask whoever
              invited you to send a new one.
            </Typography>
            <Button href="/login" variant="outlined">
              Go to sign in
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
