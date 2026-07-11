import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import type { StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";

function storeServices(store: StoreSummary): {
  label: string;
  active: boolean;
  helper: string;
  icon: ReactNode;
}[] {
  return [
    {
      label: "Bespoke",
      active: store.settings.bespoke_enabled,
      helper: "Custom order requests",
      icon: <ContentCutRounded />,
    },
    {
      label: "Measurements",
      active: store.settings.measurements_enabled,
      helper: "Fit details supported",
      icon: <StraightenRounded />,
    },
    {
      label: "Delivery",
      active:
        store.settings.delivery_enabled || store.settings.dispatch_enabled,
      helper: "Pickup or handover options",
      icon: <LocalShippingRounded />,
    },
    {
      label: "Collections",
      active: store.settings.collections_enabled,
      helper: "Grouped store drops",
      icon: <StorefrontOutlined />,
    },
  ];
}

export function StoreServiceBand({ store }: { store: StoreSummary }) {
  const brand = store.brand_color || tokens.burgundy;
  const services = storeServices(store);

  return (
    <Box
      sx={{
        borderBlock: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: "rgba(var(--surface-rgb), 0.86)",
      }}
    >
      <Container
        sx={{
          py: { xs: 2, md: 2.5 },
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {services.map((service) => (
          <Stack
            key={service.label}
            direction="row"
            spacing={1.25}
            sx={{
              alignItems: "center",
              minWidth: 0,
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: service.active
                ? alpha(brand, 0.055)
                : alpha(tokens.ink, 0.025),
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 1.25,
                display: "grid",
                placeItems: "center",
                color: service.active ? brand : tokens.mutedText,
                bgcolor: service.active
                  ? alpha(brand, 0.1)
                  : alpha(tokens.ink, 0.04),
                flexShrink: 0,
              }}
            >
              {service.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center" }}
              >
                <Typography sx={{ fontWeight: 900 }} noWrap>
                  {service.label}
                </Typography>
                <Box
                  aria-hidden
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: service.active ? brand : alpha(tokens.ink, 0.25),
                    flexShrink: 0,
                  }}
                />
              </Stack>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                {service.active ? service.helper : "Ask the store"}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Container>
    </Box>
  );
}
