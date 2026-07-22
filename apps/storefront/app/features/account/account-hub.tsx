import { Form, Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhoneIphoneRounded from "@mui/icons-material/PhoneIphoneRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import TextField from "../../components/form-text-field";
import type { CustomerOrder, CustomerProfile } from "../../lib/discovery";
import { tokens } from "../../theme";
import { OrdersPanel } from "./orders-panel";

export function AccountHub({ // eslint-disable-line complexity, max-lines-per-function -- account composition remains intentionally colocated.
  phone,
  profile,
  orders,
  saved,
  error,
  tenantHost = false,
  orderNotice,
  orderError,
}: {
  phone: string;
  profile: CustomerProfile | null;
  orders: CustomerOrder[];
  saved?: boolean;
  error?: string;
  tenantHost?: boolean;
  orderNotice?: string;
  orderError?: string;
}) {
  const customerName = profile?.display_name.trim() || "Customer";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: (theme) => {
          const grid = alpha(
            theme.palette.primary.main,
            theme.palette.mode === "dark" ? 0.055 : 0.035,
          );
          return `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`;
        },
        backgroundSize: "40px 40px",
      }}
    >
      <Container maxWidth="xl" sx={{ py: { xs: 2.5, md: 4.5 } }}>
        <Box
          component="nav"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            pb: 2.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Button
            component={RouterLink}
            to="/"
            variant="text"
            startIcon={<StorefrontRounded />}
            sx={{ px: 0, color: "text.secondary", fontWeight: 850 }}
          >
            Back to storefront
          </Button>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                display: { xs: "none", sm: "flex" },
                alignItems: "center",
                gap: 1,
                pl: 0.75,
                pr: 1.5,
                py: 0.65,
                borderRadius: 999,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  bgcolor: alpha(tokens.burgundy, 0.1),
                  color: "primary.main",
                  fontWeight: 900,
                }}
              >
                {customerName.charAt(0).toUpperCase()}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {customerName}
              </Typography>
            </Box>
            <Form method="post">
              <input type="hidden" name="intent" value="signout" />
              <Button
                type="submit"
                variant="text"
                startIcon={<LogoutRounded />}
                sx={{ color: "text.secondary", px: { xs: 0.5, sm: 1 } }}
              >
                Sign out
              </Button>
            </Form>
          </Stack>
        </Box>

        <Box sx={{ pt: { xs: 4, md: 6 }, pb: { xs: 3, md: 4 } }}>
          <Typography
            variant="overline"
            sx={{ color: "primary.main", fontWeight: 950, letterSpacing: 1.2 }}
          >
            Customer account
          </Typography>
          <Typography
            variant="h2"
            component="h1"
            sx={{ mt: 0.75, fontSize: { xs: "2.55rem", md: "4rem" } }}
          >
            Track your orders
          </Typography>
          <Typography
            sx={{ mt: 1, maxWidth: 680, color: "text.secondary", fontSize: 17 }}
          >
            Follow every piece from payment to handover, and keep your contact
            details ready for the studios making your wardrobe.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 340px" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Box
            component="section"
            sx={{
              p: { xs: 2, sm: 2.75, md: 3.5 },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "rgba(var(--surface-rgb), 0.96)",
              boxShadow: (theme) =>
                `0 22px 70px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.28 : 0.08)}`,
            }}
          >
            <OrdersPanel orders={orders} notice={orderNotice} error={orderError} />
          </Box>

          <Box
            component="aside"
            sx={{
              position: { lg: "sticky" },
              top: { lg: 24 },
              p: { xs: 2.25, md: 2.75 },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "rgba(var(--surface-rgb), 0.96)",
            }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mb: 2.5 }}>
              <PersonRounded sx={{ color: "primary.main" }} />
              <Box>
                <Typography variant="h6" component="h2">Your details</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Used by studios for order updates
                </Typography>
              </Box>
            </Stack>
            {saved ? <Alert icon={<CheckCircleRounded fontSize="inherit" />} severity="success" sx={{ mb: 2 }}>Profile saved.</Alert> : null}
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            <Form
              method="post"
              key={`${profile?.display_name ?? ""}|${profile?.email ?? ""}|${profile?.whatsapp_phone ?? ""}`}
            >
              <input type="hidden" name="intent" value="update_profile" />
              <Stack spacing={1.75}>
                <TextField
                  name="display_name"
                  label="Your name"
                  defaultValue={profile?.display_name ?? ""}
                  fullWidth
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonRounded fontSize="small" /></InputAdornment> } }}
                />
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={profile?.email ?? ""}
                  fullWidth
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><AlternateEmailRounded fontSize="small" /></InputAdornment> } }}
                />
                <TextField
                  name="whatsapp_phone"
                  label="WhatsApp number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="024 000 0000"
                  defaultValue={profile?.whatsapp_phone ?? ""}
                  fullWidth
                  helperText="Where the studio reaches you about an order."
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><PhoneIphoneRounded fontSize="small" /></InputAdornment> } }}
                />
                <TextField
                  label="Verified login"
                  value={phone}
                  disabled
                  fullWidth
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><VerifiedUserRounded fontSize="small" /></InputAdornment> } }}
                />
                <Button type="submit" variant="contained" size="large">Save profile</Button>
              </Stack>
            </Form>
            {!tenantHost ? (
              <Button
                component={RouterLink}
                to="/discover"
                variant="outlined"
                size="large"
                startIcon={<AutoAwesomeRounded />}
                sx={{ mt: 1.5, width: "100%" }}
              >
                Search with AI
              </Button>
            ) : null}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
