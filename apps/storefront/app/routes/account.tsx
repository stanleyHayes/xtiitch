import { Form, Link as RouterLink, redirect, useActionData } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PhoneIphoneRounded from "@mui/icons-material/PhoneIphoneRounded";
import PinRounded from "@mui/icons-material/PinRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { Route } from "./+types/account";
import TextField from "../components/form-text-field";
import { requestCustomerOtp, verifyCustomerOtp } from "../lib/discovery";
import { commitSession, destroySession, getSession } from "../lib/session";
import { tokens } from "../theme";

type Step = "phone" | "verify";
type ActionResult = { step: Step; phone?: string; error?: string };

// safeRedirect blocks open redirects: only same-site absolute paths are allowed.
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/discover";
}

export function meta() {
  return [
    { title: "Sign in · Xtiitch" },
    {
      name: "description",
      content:
        "Sign in with your phone number to unlock more AI searches across Xtiitch shops.",
    },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const url = new URL(request.url);
  return {
    signedInPhone: session.get("customerPhone") ?? null,
    redirectTo: safeRedirect(url.searchParams.get("redirectTo")),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "signout") {
    const session = await getSession(request.headers.get("Cookie"));
    return redirect("/account", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }

  if (intent === "request") {
    const phone = String(form.get("phone") ?? "").trim();
    if (!phone) {
      return { step: "phone", error: "Enter your phone number." } as ActionResult;
    }
    await requestCustomerOtp(phone);
    return { step: "verify", phone } as ActionResult;
  }

  if (intent === "verify") {
    const phone = String(form.get("phone") ?? "").trim();
    const code = String(form.get("code") ?? "").trim();
    const result = await verifyCustomerOtp(phone, code);
    if (!result.ok) {
      const error =
        result.status === 401
          ? "That code is incorrect or has expired."
          : result.status === 429
            ? "Too many attempts — request a fresh code."
            : "We couldn't verify that code. Please try again.";
      return { step: "verify", phone, error } as ActionResult;
    }
    const session = await getSession(request.headers.get("Cookie"));
    session.set("customerToken", result.token);
    session.set("customerPhone", result.phone);
    return redirect(safeRedirect(String(form.get("redirectTo") ?? "/discover")), {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  return { step: "phone" } as ActionResult;
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const action = useActionData<ActionResult>();
  const step: Step = action?.step ?? "phone";
  const { signedInPhone, redirectTo } = loaderData;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px)`,
        backgroundSize: "36px 36px",
      }}
    >
      <Container
        sx={{
          minHeight: "100vh",
          py: { xs: 4, md: 7 },
          display: "grid",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, lg: 4 },
            gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" },
            alignItems: "center",
          }}
        >
          <Box component="header">
            <Stack spacing={1.5} sx={{ mb: { xs: 2, md: 2.5 }, alignItems: "flex-start" }}>
              <Button
                component={RouterLink}
                to="/"
                variant="text"
                startIcon={<StorefrontRounded />}
                sx={{
                  px: 0,
                  minHeight: 36,
                  color: "text.secondary",
                  fontWeight: 800,
                  "& .MuiButton-startIcon": { mr: 1, color: "inherit" },
                  "&:hover": { bgcolor: "transparent", color: tokens.burgundy },
                }}
              >
                Back to storefronts
              </Button>
              <Typography
                variant="caption"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  width: "fit-content",
                  px: 1.25,
                  py: 0.55,
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: alpha(tokens.burgundy, 0.16),
                  bgcolor: alpha(tokens.burgundy, 0.07),
                  color: tokens.burgundy,
                  fontWeight: 950,
                  letterSpacing: 0.3,
                  lineHeight: 1,
                  textTransform: "uppercase",
                }}
              >
                Customer account
              </Typography>
            </Stack>
            <Typography
              variant="h2"
              component="h1"
              sx={{ mt: 1, maxWidth: 620, fontSize: { xs: "2.6rem", md: "4rem" } }}
            >
              {signedInPhone ? "You're signed in" : "Sign in to search smarter"}
            </Typography>
            <Typography sx={{ mt: 2, color: "text.secondary", maxWidth: 560, fontSize: { xs: 16, md: 18 } }}>
              One phone number, no password. Signing in unlocks more
              natural-language AI searches across every Xtiitch shop and keeps
              your order history in one place.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2.5, alignItems: "center", color: tokens.burgundy }}>
              <AutoAwesomeRounded fontSize="small" />
              <Typography sx={{ fontWeight: 800 }}>
                25 free AI searches a month, signed in.
              </Typography>
            </Stack>
          </Box>

          <Box
            sx={{
              p: { xs: 2, sm: 2.5, md: 3 },
              borderRadius: "8px",
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.1),
              bgcolor: "rgba(var(--surface-rgb), 0.92)",
              boxShadow: `0 24px 70px ${alpha(tokens.ink, 0.12)}`,
            }}
          >
            {signedInPhone ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                  <CheckCircleRounded sx={{ color: tokens.success }} />
                  <Typography variant="h5" component="h2">
                    Signed in
                  </Typography>
                </Stack>
                <Typography sx={{ color: "text.secondary" }}>
                  You're signed in as <strong>{signedInPhone}</strong>.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button
                    component={RouterLink}
                    to="/discover"
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardRounded />}
                  >
                    Start searching
                  </Button>
                  <Form method="post">
                    <input type="hidden" name="intent" value="signout" />
                    <Button type="submit" variant="text" size="large" startIcon={<LogoutRounded />} sx={{ color: "text.secondary" }}>
                      Sign out
                    </Button>
                  </Form>
                </Stack>
              </Stack>
            ) : step === "verify" ? (
              <Stack spacing={1.5}>
                <Typography variant="h5" component="h2">
                  Enter your code
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  We sent a 6-digit code to <strong>{action?.phone}</strong> on
                  WhatsApp. Enter it below.
                </Typography>
                <Form method="post">
                  <input type="hidden" name="intent" value="verify" />
                  <input type="hidden" name="phone" value={action?.phone ?? ""} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    <TextField
                      name="code"
                      label="6-digit code"
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      fullWidth
                      error={Boolean(action?.error)}
                      helperText={action?.error}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <PinRounded fontSize="small" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
                      Verify & sign in
                    </Button>
                  </Stack>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="request" />
                  <input type="hidden" name="phone" value={action?.phone ?? ""} />
                  <Button type="submit" variant="text" size="small" sx={{ color: "text.secondary", px: 0 }}>
                    Resend code / change number
                  </Button>
                </Form>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="h5" component="h2">
                  Sign in with your phone
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  We'll send a one-time code to your WhatsApp. No password needed.
                </Typography>
                <Form method="post">
                  <input type="hidden" name="intent" value="request" />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    <TextField
                      name="phone"
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
                    <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
                      Send my code
                    </Button>
                  </Stack>
                </Form>
              </Stack>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
