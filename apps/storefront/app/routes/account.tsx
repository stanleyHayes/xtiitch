import {
  Form,
  Link as RouterLink,
  redirect,
  useActionData,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import OtpCodeInput from "../components/otp-code-input";
import ButtonDots from "../components/button-dots";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PhoneIphoneRounded from "@mui/icons-material/PhoneIphoneRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import type { Route } from "./+types/account";
import TextField from "../components/form-text-field";
import {
  requestCustomerOtp,
  verifyCustomerOtp,
  fetchCustomerOrders,
  fetchCustomerProfile,
  updateCustomerProfile,
  whatsAppOtpEnabled,
  type CustomerOrder,
  type CustomerProfile,
} from "../lib/discovery";
import { commitSession, destroySession, getSession } from "../lib/session";
import { formatGHS } from "../lib/format";
import { tokens } from "../theme";

type Step = "identify" | "verify";
type OtpChannel = "whatsapp" | "email";
type ActionResult = {
  step: Step;
  channel?: OtpChannel;
  // identifier is the phone (whatsapp) or email (email) the code was sent to.
  identifier?: string;
  error?: string;
  profileSaved?: boolean;
  profileError?: string;
};

function normalizeChannel(raw: unknown): OtpChannel {
  return String(raw ?? "") === "email" ? "email" : "whatsapp";
}

// safeRedirect blocks open redirects: only same-site absolute paths are allowed.
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/discover";
}

export function meta() {
  return [
    { title: "Your account · Xtiitch" },
    {
      name: "description",
      content:
        "Sign in with your phone or email to track your orders and unlock more AI searches across Xtiitch shops.",
    },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const url = new URL(request.url);
  const token = (session.get("customerToken") as string | undefined) ?? null;
  const signedInPhone = (session.get("customerPhone") as string | null) ?? null;

  let orders: CustomerOrder[] = [];
  let profile: CustomerProfile | null = null;
  if (token) {
    [orders, profile] = await Promise.all([
      fetchCustomerOrders(token),
      fetchCustomerProfile(token),
    ]);
  }

  return {
    signedInPhone,
    redirectTo: safeRedirect(url.searchParams.get("redirectTo")),
    orders,
    profile,
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

  if (intent === "update_profile") {
    const session = await getSession(request.headers.get("Cookie"));
    const token = session.get("customerToken") as string | undefined;
    if (!token) {
      return redirect("/account");
    }
    const updated = await updateCustomerProfile(token, {
      display_name: String(form.get("display_name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
    });
    return {
      step: "identify",
      profileSaved: Boolean(updated),
      profileError: updated
        ? undefined
        : "We couldn't save your profile. Please try again.",
    } as ActionResult;
  }

  // The channel tabs (WhatsApp | Email) re-render the sign-in form pre-selected
  // on the chosen channel, with no client JS.
  if (intent === "switch") {
    return {
      step: "identify",
      channel: normalizeChannel(form.get("channel")),
    } as ActionResult;
  }

  if (intent === "request") {
    let channel = normalizeChannel(form.get("channel"));
    // Server-side backstop: the WhatsApp tab is disabled in the UI when the flag
    // is false, but a stale render or a bfcache/back-forward-restored document
    // can still POST channel=whatsapp. Re-check the live flag and fall back to
    // email so we never mint a WhatsApp code that would never be delivered. This
    // matches the API's buildCustomerOTPDelivery condition.
    if (channel === "whatsapp" && !(await whatsAppOtpEnabled())) {
      channel = "email";
    }
    const identifier = String(form.get("identifier") ?? "").trim();
    if (!identifier) {
      return {
        step: "identify",
        channel,
        error:
          channel === "email"
            ? "Enter your email address."
            : "Enter your phone number.",
      } as ActionResult;
    }
    await requestCustomerOtp(identifier, channel);
    return { step: "verify", channel, identifier } as ActionResult;
  }

  if (intent === "verify") {
    const channel = normalizeChannel(form.get("channel"));
    const identifier = String(form.get("identifier") ?? "").trim();
    const code = String(form.get("code") ?? "").trim();
    const result = await verifyCustomerOtp(identifier, code, channel);
    if (!result.ok) {
      const error =
        result.status === 401
          ? "That code is incorrect or has expired."
          : result.status === 429
            ? "Too many attempts — request a fresh code."
            : "We couldn't verify that code. Please try again.";
      return { step: "verify", channel, identifier, error } as ActionResult;
    }
    const session = await getSession(request.headers.get("Cookie"));
    session.set("customerToken", result.token);
    // The account header shows whichever identity the customer signed in with.
    // Email-only customers have no phone, so fall back to the email/identifier.
    session.set("customerPhone", result.phone || result.email || identifier);
    return redirect(safeRedirect(String(form.get("redirectTo") ?? "/discover")), {
      headers: { "Set-Cookie": await commitSession(session) },
    });
  }

  return { step: "identify" } as ActionResult;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Deterministic UTC date format — avoids locale-driven SSR/client hydration drift.
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function orderStatus(status: string): { label: string; color: string } {
  const s = status.toLowerCase();
  if (["completed", "delivered", "fulfilled", "handed_over"].includes(s)) {
    return { label: "Completed", color: tokens.success };
  }
  if (["cancelled", "canceled", "discarded", "refunded"].includes(s)) {
    return { label: "Cancelled", color: alpha(tokens.ink, 0.55) };
  }
  if (s === "draft") {
    return { label: "Awaiting payment", color: tokens.gold };
  }
  return {
    label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    color: tokens.burgundy,
  };
}

function AccountHub({
  phone,
  profile,
  orders,
  saved,
  error,
}: {
  phone: string;
  profile: CustomerProfile | null;
  orders: CustomerOrder[];
  saved?: boolean;
  error?: string;
}) {
  const cardSx = {
    p: { xs: 2.25, md: 3 },
    borderRadius: "14px",
    border: "1px solid",
    borderColor: alpha(tokens.ink, 0.1),
    bgcolor: "rgba(var(--surface-rgb), 0.94)",
    boxShadow: `0 18px 50px ${alpha(tokens.ink, 0.1)}`,
  } as const;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px)`,
        backgroundSize: "36px 36px",
      }}
    >
      <Container sx={{ py: { xs: 4, md: 6 }, maxWidth: "lg" }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
        >
          <Button
            component={RouterLink}
            to="/"
            variant="text"
            startIcon={<StorefrontRounded />}
            sx={{ px: 0, color: "text.secondary", fontWeight: 800 }}
          >
            Back to storefronts
          </Button>
          <Form method="post">
            <input type="hidden" name="intent" value="signout" />
            <Button
              type="submit"
              variant="text"
              startIcon={<LogoutRounded />}
              sx={{ color: "text.secondary" }}
            >
              Sign out
            </Button>
          </Form>
        </Stack>

        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: "2.2rem", md: "3rem" } }}>
          Your account
        </Typography>
        <Typography sx={{ mt: 1, color: "text.secondary" }}>
          Signed in as <strong>{phone}</strong>
        </Typography>

        <Box
          sx={{
            mt: 4,
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "0.85fr 1.15fr" },
            alignItems: "start",
          }}
        >
          {/* Profile */}
          <Box sx={cardSx}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 2 }}>
              <PersonRounded sx={{ color: tokens.burgundy }} />
              <Typography variant="h6" component="h2">
                Profile
              </Typography>
            </Stack>
            {saved ? (
              <Alert
                icon={<CheckCircleRounded fontSize="inherit" />}
                severity="success"
                sx={{ mb: 2 }}
              >
                Profile saved.
              </Alert>
            ) : null}
            {error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : null}
            <Form method="post">
              <input type="hidden" name="intent" value="update_profile" />
              <Stack spacing={2}>
                <TextField
                  name="display_name"
                  label="Your name"
                  defaultValue={profile?.display_name ?? ""}
                  fullWidth
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
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={profile?.email ?? ""}
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
                  label="Login"
                  value={phone}
                  disabled
                  fullWidth
                  helperText="This is your verified login and can't be changed here."
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <VerifiedUserRounded fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button type="submit" variant="contained" size="large">
                  Save changes
                </Button>
              </Stack>
            </Form>

            <Button
              component={RouterLink}
              to="/discover"
              variant="outlined"
              size="large"
              startIcon={<AutoAwesomeRounded />}
              sx={{ mt: 2, width: "100%" }}
            >
              Search with AI
            </Button>
          </Box>

          {/* Orders */}
          <Box sx={cardSx}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 2 }}>
              <ReceiptLongRounded sx={{ color: tokens.burgundy }} />
              <Typography variant="h6" component="h2">
                Your orders
              </Typography>
            </Stack>

            {orders.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <StorefrontRounded
                  sx={{ fontSize: 40, color: alpha(tokens.ink, 0.25) }}
                />
                <Typography sx={{ mt: 1, fontWeight: 800 }}>
                  No orders yet
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                  When you order from a studio, it shows up here.
                </Typography>
                <Button
                  component={RouterLink}
                  to="/"
                  variant="contained"
                  sx={{ mt: 2.5 }}
                  endIcon={<ArrowForwardRounded />}
                >
                  Browse studios
                </Button>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {orders.map((o) => {
                  const status = orderStatus(o.status);
                  return (
                    <Box
                      key={o.order_id}
                      sx={{
                        p: 1.75,
                        borderRadius: "10px",
                        border: "1px solid",
                        borderColor: alpha(tokens.ink, 0.1),
                        bgcolor: "rgba(var(--surface-rgb), 0.6)",
                      }}
                    >
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between", gap: 1.5, alignItems: "flex-start" }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800 }} noWrap>
                            {o.design_title || "Custom order"}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
                            {o.business_name} · {formatDate(o.created_at)}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            flexShrink: 0,
                            px: 1,
                            py: 0.35,
                            borderRadius: 999,
                            bgcolor: alpha(status.color, 0.12),
                            color: status.color,
                            border: `1px solid ${alpha(status.color, 0.4)}`,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {status.label}
                        </Box>
                      </Stack>
                      <Stack
                        direction="row"
                        sx={{ mt: 1.25, justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Typography sx={{ fontWeight: 900, color: tokens.burgundy }}>
                          {o.agreed_total_minor > 0
                            ? formatGHS(o.agreed_total_minor)
                            : "Price on confirmation"}
                        </Typography>
                        <Button
                          component={RouterLink}
                          to={`/track/${o.order_id}`}
                          size="small"
                          variant="text"
                          startIcon={<LocalShippingRounded />}
                        >
                          Track
                        </Button>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const action = useActionData<ActionResult>();
  const navigation = useNavigation();
  // Which form is mid-submit, so the matching button can show a spinner.
  const pendingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : null;
  const { signedInPhone, redirectTo, orders, profile } = loaderData;
  // WhatsApp Cloud creds may not be configured (then the OTP is logged, never
  // delivered). The root loader surfaces this from GET /v1/branding so SSR and
  // client agree; default false on fetch failure.
  const rootData = useRouteLoaderData("root") as
    | { whatsappEnabled?: boolean }
    | undefined;
  const whatsappEnabled = rootData?.whatsappEnabled ?? false;
  const step: Step = action?.step ?? "identify";
  const channel: OtpChannel =
    action?.channel ?? (whatsappEnabled ? "whatsapp" : "email");

  if (signedInPhone) {
    return (
      <AccountHub
        phone={signedInPhone}
        profile={profile}
        orders={orders}
        saved={action?.profileSaved}
        error={action?.profileError}
      />
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      {/* Ambient brand glow — theme-safe (reads on both cream and ink). */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 12% 8%, ${alpha(tokens.burgundy, 0.18)}, transparent 46%), radial-gradient(circle at 92% 0%, ${alpha(tokens.gold, 0.12)}, transparent 42%)`,
        }}
      />
      {/* Grid texture, faded out toward the edges. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.05)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.05)} 1px, transparent 1px)`,
          backgroundSize: "38px 38px",
          maskImage: "radial-gradient(circle at 28% 45%, #000, transparent 78%)",
          WebkitMaskImage: "radial-gradient(circle at 28% 45%, #000, transparent 78%)",
        }}
      />
      <Container
        sx={{
          position: "relative",
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
              Sign in to track orders
            </Typography>
            <Typography sx={{ mt: 2, color: "text.secondary", maxWidth: 560, fontSize: { xs: 16, md: 18 } }}>
              Your phone or email, no password. Signing in keeps your order
              history in one place and unlocks more natural-language AI searches
              across every Xtiitch shop.
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
              position: "relative",
              p: { xs: 2.5, sm: 3, md: 3.5 },
              borderRadius: "18px",
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.18),
              bgcolor: "rgba(var(--surface-rgb), 0.96)",
              boxShadow: `0 30px 80px ${alpha(tokens.ink, 0.18)}`,
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(90deg, ${tokens.burgundy}, ${tokens.gold})`,
              },
            }}
          >
            {step === "verify" ? (
              <Stack spacing={1.5}>
                <Typography variant="h5" component="h2">
                  Enter your code
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  We sent a 6-digit code to <strong>{action?.identifier}</strong>{" "}
                  {channel === "email" ? "by email" : "on WhatsApp"}. Enter it
                  below.
                </Typography>
                <Form method="post">
                  <input type="hidden" name="intent" value="verify" />
                  <input type="hidden" name="channel" value={channel} />
                  <input
                    type="hidden"
                    name="identifier"
                    value={action?.identifier ?? ""}
                  />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <Stack spacing={1.75} sx={{ mt: 1 }}>
                    <OtpCodeInput error={Boolean(action?.error)} />
                    {action?.error ? (
                      <Typography variant="body2" sx={{ color: "error.main" }}>
                        {action.error}
                      </Typography>
                    ) : null}
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={pendingIntent === "verify"}
                      endIcon={
                        pendingIntent === "verify" ? undefined : (
                          <ArrowForwardRounded />
                        )
                      }
                    >
                      {pendingIntent === "verify" ? (
                        <ButtonDots label="Verifying" />
                      ) : (
                        "Verify & sign in"
                      )}
                    </Button>
                  </Stack>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="request" />
                  <input type="hidden" name="channel" value={channel} />
                  <input
                    type="hidden"
                    name="identifier"
                    value={action?.identifier ?? ""}
                  />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <Button type="submit" variant="text" size="small" sx={{ color: "text.secondary", px: 0 }}>
                    {channel === "email"
                      ? "Resend code / change email"
                      : "Resend code / change number"}
                  </Button>
                </Form>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="h5" component="h2">
                  {channel === "email"
                    ? "Sign in with your email"
                    : "Sign in with your phone"}
                </Typography>

                {/* Channel switch: WhatsApp | Email. Each tab re-renders this
                    form pre-selected on that channel (no client JS). */}
                <Stack
                  direction="row"
                  spacing={0}
                  sx={{
                    p: 0.5,
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: alpha(tokens.ink, 0.12),
                    bgcolor: alpha(tokens.ink, 0.03),
                    width: "fit-content",
                  }}
                >
                  {(
                    [
                      { value: "whatsapp", label: "WhatsApp", Icon: PhoneIphoneRounded },
                      { value: "email", label: "Email", Icon: EmailRounded },
                    ] as const
                  ).map((tab) => {
                    const selected = channel === tab.value;
                    // WhatsApp creds aren't configured in prod, so the OTP only
                    // logs (never delivers). Disable the tab + annotate "Soon" so
                    // it re-enables automatically when the flag flips true.
                    const disabled = tab.value === "whatsapp" && !whatsappEnabled;
                    return (
                      <Form method="post" key={tab.value}>
                        <input type="hidden" name="intent" value="switch" />
                        <input type="hidden" name="channel" value={tab.value} />
                        <Button
                          type="submit"
                          disabled={disabled}
                          startIcon={<tab.Icon fontSize="small" />}
                          aria-pressed={selected}
                          endIcon={
                            disabled ? (
                              <Box
                                component="span"
                                sx={{
                                  px: 0.75,
                                  py: 0.125,
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  lineHeight: 1.4,
                                  color: tokens.burgundy,
                                  bgcolor: alpha(tokens.burgundy, 0.12),
                                }}
                              >
                                Soon
                              </Box>
                            ) : undefined
                          }
                          sx={{
                            px: 2,
                            borderRadius: 999,
                            fontWeight: 800,
                            color: selected ? "#fff" : "text.secondary",
                            bgcolor: selected ? tokens.burgundy : "transparent",
                            "&:hover": {
                              bgcolor: selected
                                ? tokens.burgundy
                                : alpha(tokens.burgundy, 0.08),
                            },
                            "&.Mui-disabled": {
                              color: "text.disabled",
                            },
                          }}
                        >
                          {tab.label}
                        </Button>
                      </Form>
                    );
                  })}
                </Stack>

                <Typography sx={{ color: "text.secondary" }}>
                  {channel === "email"
                    ? "We'll email you a one-time code. No password needed."
                    : "We'll send a one-time code to your WhatsApp. No password needed."}
                </Typography>
                <Form method="post">
                  <input type="hidden" name="intent" value="request" />
                  <input type="hidden" name="channel" value={channel} />
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    {channel === "email" ? (
                      <TextField
                        name="identifier"
                        label="Email address"
                        placeholder="you@example.com"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        fullWidth
                        error={Boolean(action?.error)}
                        helperText={action?.error}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <EmailRounded fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    ) : (
                      <TextField
                        name="identifier"
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
                    )}
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={pendingIntent === "request"}
                      endIcon={
                        pendingIntent === "request" ? undefined : (
                          <ArrowForwardRounded />
                        )
                      }
                    >
                      {pendingIntent === "request" ? (
                        <ButtonDots label="Sending" />
                      ) : (
                        "Send my code"
                      )}
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
