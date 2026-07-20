import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhoneIphoneRounded from "@mui/icons-material/PhoneIphoneRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { CustomerOrder, CustomerProfile } from "../../lib/discovery";
import { OrdersPanel } from "./orders-panel";

export function AccountHub({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
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
  // §6: on a tenant host cross-store entries (AI Search) are hidden — the
  // customer's orders stay shared, they are their own data (§5.3.4).
  tenantHost?: boolean;
  orderNotice?: string;
  orderError?: string;
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
            Back to storefront
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

        <Typography
          variant="h3"
          component="h1"
          sx={{ fontSize: { xs: "2.2rem", md: "3rem" } }}
        >
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
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", mb: 2 }}
            >
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
            {/* §1.2 auto-reset: the form is keyed by the saved profile values,
                so a successful save (loader revalidates with the new profile)
                remounts the fields showing the saved state cleanly instead of
                keeping stale uncontrolled input. */}
            <Form
              method="post"
              key={`${profile?.display_name ?? ""}|${profile?.email ?? ""}|${profile?.whatsapp_phone ?? ""}`}
            >
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
                  name="whatsapp_phone"
                  label="WhatsApp number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="024 000 0000"
                  defaultValue={profile?.whatsapp_phone ?? ""}
                  fullWidth
                  helperText="Where the studio reaches you about an order. Separate from your login number."
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

            {!tenantHost ? (
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
            ) : null}
          </Box>

          {/* Orders — §5.3: grouped by store basket, Current/Archived tabs. */}
          <Box sx={cardSx}>
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", mb: 2 }}
            >
              <ReceiptLongRounded sx={{ color: tokens.burgundy }} />
              <Typography variant="h6" component="h2">
                Your orders
              </Typography>
            </Stack>
            <OrdersPanel
              orders={orders}
              notice={orderNotice}
              error={orderError}
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
