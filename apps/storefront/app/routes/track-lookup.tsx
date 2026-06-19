import type { ReactNode } from "react";
import { Form, Link as RouterLink, redirect } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SecurityRounded from "@mui/icons-material/SecurityRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { Route } from "./+types/track-lookup";
import TextField from "../components/form-text-field";
import { tokens } from "../theme";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const target = trackingTarget(url.searchParams.get("order"));
  if (target) {
    return redirect(`/track/${encodeURIComponent(target)}`);
  }
  return null;
}

export function meta() {
  return [
    { title: "Track an order · Xtiitch" },
    {
      name: "description",
      content:
        "Paste an Xtiitch order ID or tracking link to see the latest status.",
    },
    { name: "robots", content: "noindex" },
  ];
}

function trackingTarget(raw: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) {
    return "";
  }

  try {
    const pasted = new URL(value);
    const [, route, orderID] = pasted.pathname.split("/");
    if (route === "track" && orderID) {
      return decodeURIComponent(orderID).trim();
    }
  } catch {
    // Plain order IDs are expected; URL parsing is only for pasted links.
  }

  return value.replace(/^#/, "").trim();
}

function LookupSignal({
  icon,
  title,
  helper,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "8px",
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(tokens.burgundy, 0.08),
            color: tokens.burgundy,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
      </Stack>
      <Typography variant="body2" sx={{ mt: 0.85, color: "text.secondary" }}>
        {helper}
      </Typography>
    </Box>
  );
}

export default function TrackLookup() {
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
            <Stack
              spacing={1.5}
              sx={{ mb: { xs: 2, md: 2.5 }, alignItems: "flex-start" }}
            >
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
                  "& .MuiButton-startIcon": {
                    mr: 1,
                    color: "inherit",
                  },
                  "&:hover": {
                    bgcolor: "transparent",
                    color: tokens.burgundy,
                  },
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
                Customer tracking
              </Typography>
            </Stack>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                mt: 1,
                maxWidth: 620,
                fontSize: { xs: "2.6rem", md: "4rem" },
              }}
            >
              Track an Xtiitch order
            </Typography>
            <Typography
              sx={{
                mt: 2,
                color: "text.secondary",
                maxWidth: 560,
                fontSize: { xs: 16, md: 18 },
              }}
            >
              Paste the order ID or the tracking link the store sent you. The
              status page shows production stage, readiness, and handover
              details when the store updates them.
            </Typography>
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
            <Typography variant="h5" component="h2">
              Open order status
            </Typography>
            <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
              The lookup only opens a tracking page; it does not expose account
              or payment details.
            </Typography>

            <Form method="get">
              <Stack spacing={1.5} sx={{ mt: 2.5 }}>
                <TextField
                  name="order"
                  label="Order ID or tracking link"
                  placeholder="Paste from your Xtiitch message"
                  required
                  fullWidth
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRounded fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRounded />}
                >
                  Track order
                </Button>
              </Stack>
            </Form>

            <Box
              sx={{
                mt: 2.5,
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              <LookupSignal
                icon={<LinkRounded />}
                title="Paste link"
                helper="Full tracking URLs work too."
              />
              <LookupSignal
                icon={<LocalShippingRounded />}
                title="See progress"
                helper="Follow production and handover."
              />
              <LookupSignal
                icon={<SecurityRounded />}
                title="Private"
                helper="No customer account is required."
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
