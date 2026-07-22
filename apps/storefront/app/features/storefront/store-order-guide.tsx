import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";
import { resolveStoreBrand } from "./store-brand";

export function StoreOrderGuide({ store }: { store: StoreSummary }) {
  const brand = resolveStoreBrand(store.brand_color);
  const steps = [
    {
      title: "Choose the piece",
      helper: "Browse the catalogue or start with a custom route.",
      icon: <ContentCutRounded />,
    },
    {
      title: "Select a fit route",
      helper: store.settings.bespoke_enabled
        ? "Share measurements, choose a size, or book a visit."
        : "Choose from the sizes the store has published.",
      icon: <StraightenRounded />,
    },
    {
      title: "Confirm and pay",
      helper: "Review the order and complete secure checkout.",
      icon: <CreditCardRounded />,
    },
    {
      title: "Track your order",
      helper: "Follow production through pickup or delivery.",
      icon: <Inventory2Outlined />,
    },
  ];

  return (
    <Box
      sx={{
        borderBlock: "1px solid",
        borderColor: alpha(tokens.ink, 0.09),
        bgcolor: "rgba(var(--surface-rgb), 0.78)",
      }}
    >
      <Container sx={{ py: { xs: 3, md: 3.5 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2.5, md: 2 },
            gridTemplateColumns: {
              xs: "1fr",
              md: "220px repeat(4, minmax(0, 1fr))",
            },
            alignItems: "start",
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{ color: brand, fontWeight: 900, textTransform: "uppercase" }}
            >
              From browse to handover
            </Typography>
            <Typography variant="h6" component="h2" sx={{ mt: 0.4 }}>
              How ordering works
            </Typography>
          </Box>
          {steps.map((step, index) => (
            <Stack
              key={step.title}
              direction="row"
              spacing={1.25}
              sx={{ minWidth: 0, position: "relative" }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 1.25,
                  display: "grid",
                  placeItems: "center",
                  color: brand,
                  bgcolor: alpha(brand, 0.075),
                  flexShrink: 0,
                  "& svg": { fontSize: 22 },
                }}
              >
                {step.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{ color: brand, fontWeight: 900 }}
                >
                  {String(index + 1).padStart(2, "0")}
                </Typography>
                <Typography sx={{ fontWeight: 900, lineHeight: 1.25 }}>
                  {step.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.4, color: "text.secondary", lineHeight: 1.45 }}
                >
                  {step.helper}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
