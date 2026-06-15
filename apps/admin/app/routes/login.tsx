import { Form, redirect } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import { alpha } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import type { Route } from "./+types/login";
import { commitSession, getSession } from "../lib/session";
import { tokens } from "../theme";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Admin sign in · Xtiitch" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.get("adminEmail")) {
    return redirect("/admin");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email.endsWith("@xtiitch.com") || password.length < 8) {
    return { error: "Use an Xtiitch operator email and a valid password." };
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("adminEmail", email);
  session.set("adminRole", email.startsWith("support") ? "support" : "owner");

  return redirect("/admin", { headers: { "Set-Cookie": await commitSession(session) } });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const signalCards = [
    { icon: <VerifiedUserRounded />, label: "KYC queue", value: "3 pending", tone: tokens.warning },
    { icon: <PaymentsRounded />, label: "Money rails", value: "99.1% healthy", tone: tokens.success },
    { icon: <WarningAmberRounded />, label: "Risk review", value: "1 urgent", tone: tokens.danger },
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: tokens.charcoal,
        color: tokens.white,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1.08fr 0.92fr" },
      }}
    >
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          px: { xs: 3, md: 6, xl: 8 },
          py: { xs: 4, md: 6 },
          minHeight: { xs: 520, lg: "100vh" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)
          `,
          backgroundSize: "42px 42px",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.84)}, transparent 56%)`,
            opacity: 0.66,
          },
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ position: "relative", zIndex: 1, alignItems: "center" }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: tokens.burgundy,
              boxShadow: `0 18px 50px ${alpha(tokens.burgundy, 0.42)}`,
            }}
          >
            <AdminPanelSettingsRounded />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1 }}>
              Xtiitch Admin
            </Typography>
            <Typography variant="caption" sx={{ color: alpha(tokens.white, 0.64), fontWeight: 800 }}>
              admin.xtiitch.com
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 620, py: { xs: 6, md: 8 } }}>
          <Chip
            icon={<ShieldRounded />}
            label="Operator access"
            sx={{
              bgcolor: alpha(tokens.white, 0.1),
              color: tokens.white,
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.18),
            }}
          />
          <Typography variant="h2" component="h1" sx={{ mt: 3, fontSize: { xs: 38, md: 56 }, lineHeight: 0.98 }}>
            Platform control room.
          </Typography>
          <Typography sx={{ mt: 2.5, color: alpha(tokens.white, 0.72), fontSize: 18, maxWidth: 520 }}>
            Verify businesses, monitor Paystack rails, and keep every tenant boundary accountable.
          </Typography>
        </Box>

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          }}
        >
          {signalCards.map((item) => (
            <Paper
              key={item.label}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(tokens.white, 0.08),
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.12),
                color: tokens.white,
                backdropFilter: "blur(10px)",
              }}
            >
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                <Box sx={{ color: item.tone, display: "grid", placeItems: "center" }}>{item.icon}</Box>
                <Box>
                  <Typography variant="caption" sx={{ color: alpha(tokens.white, 0.62), fontWeight: 800 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 900 }}>{item.value}</Typography>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          bgcolor: "background.default",
          color: "text.primary",
          display: "grid",
          placeItems: "center",
          px: { xs: 2, sm: 4, md: 6 },
          py: { xs: 5, md: 8 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 500,
            p: { xs: 3, md: 4 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            boxShadow: `0 28px 80px ${alpha(tokens.ink, 0.08)}`,
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 3 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(tokens.burgundy, 0.1),
                color: tokens.burgundy,
              }}
            >
              <StorefrontRounded />
            </Box>
            <Box>
              <Typography variant="h5" component="h2">
                Sign in
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Xtiitch operators only
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ mb: 3 }} />

          <Form method="post">
            <Stack spacing={2.25}>
              {actionData?.error ? <Alert severity="error">{actionData.error}</Alert> : null}
              <TextField
                name="email"
                label="Operator email"
                type="email"
                required
                autoComplete="email"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailRounded />
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
                        <LockRounded />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
                Open console
              </Button>
            </Stack>
          </Form>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ mt: 3, pt: 3, borderTop: "1px solid", borderColor: "divider" }}
          >
            <Chip icon={<ShieldRounded />} label="HttpOnly session" variant="outlined" />
            <Chip icon={<VerifiedUserRounded />} label="Audit-ready" variant="outlined" />
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
