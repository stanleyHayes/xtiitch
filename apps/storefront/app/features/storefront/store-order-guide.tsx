import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import type { StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";

export function StoreOrderGuide({ store }: { store: StoreSummary }) {
  const brand = store.brand_color || tokens.burgundy;
  const steps = [
    {
      title: "Choose the piece",
      helper:
        "Open a design to compare prices, available sizes, and custom fit routes.",
      icon: <ContentCutRounded />,
    },
    {
      title: "Select a fit route",
      helper: store.settings.bespoke_enabled
        ? "Order a listed size, send measurements, book a visit, or reserve shop measurement."
        : "Use the listed-size checkout this store has published.",
      icon: <StraightenRounded />,
    },
    {
      title: "Pay or reserve",
      helper:
        "Online payments open in the secure checkout; shop-measurement requests can start without payment.",
      icon: <CreditCardRounded />,
    },
    {
      title: "Track production",
      helper:
        "Keep the tracking link to follow stage updates, pickup, or delivery handover.",
      icon: <LocalShippingRounded />,
    },
  ];

  return (
    <Box
      sx={{
        bgcolor: "rgba(var(--surface-rgb), 0.68)",
        borderBottom: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
      }}
    >
      <Container sx={{ py: { xs: 3.5, md: 4.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2.5}
          sx={{
            alignItems: { xs: "flex-start", md: "flex-end" },
            justifyContent: "space-between",
            mb: 2.5,
          }}
        >
          <Box sx={{ maxWidth: 620 }}>
            <Typography
              variant="caption"
              sx={{
                color: brand,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              How ordering works
            </Typography>
            <Typography variant="h5" component="h2">
              From browse to handover
            </Typography>
            <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
              Each store controls its catalogue and fulfilment; Xtiitch keeps
              the order route, checkout, and tracking link in one place.
            </Typography>
          </Box>
          <Chip
            icon={<VerifiedRounded />}
            label="No account needed to browse"
            sx={{
              bgcolor: alpha(brand, 0.08),
              color: brand,
              fontWeight: 900,
              "& .MuiChip-icon": { color: brand },
            }}
          />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          {steps.map((step, index) => (
            <Box
              key={step.title}
              sx={{
                p: 1.75,
                minHeight: 176,
                borderRadius: "8px",
                border: "1px solid",
                borderColor: alpha(brand, 0.13),
                bgcolor: "rgba(var(--surface-rgb), 0.78)",
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", minWidth: 0 }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(brand, 0.08),
                    color: brand,
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 900 }}
                >
                  Step {index + 1}
                </Typography>
              </Stack>
              <Box>
                <Typography sx={{ fontWeight: 950 }}>{step.title}</Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.6, color: "text.secondary" }}
                >
                  {step.helper}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
