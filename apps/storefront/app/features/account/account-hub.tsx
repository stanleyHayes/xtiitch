import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhoneIphoneRounded from "@mui/icons-material/PhoneIphoneRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import TextField from "../../components/form-text-field";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import type { CustomerOrder, CustomerProfile } from "../../lib/discovery";
import { formatDate, orderStatus } from "./utils";

export function AccountHub({
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

            {orders.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <StorefrontRounded
                  sx={{ fontSize: 40, color: alpha(tokens.ink, 0.25) }}
                />
                <Typography sx={{ mt: 1, fontWeight: 800 }}>
                  No orders yet
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mt: 0.5 }}
                >
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
                        sx={{
                          justifyContent: "space-between",
                          gap: 1.5,
                          alignItems: "flex-start",
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 800 }} noWrap>
                            {o.design_title || "Custom order"}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                            noWrap
                          >
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
                        sx={{
                          mt: 1.25,
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography
                          sx={{ fontWeight: 900, color: tokens.burgundy }}
                        >
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
