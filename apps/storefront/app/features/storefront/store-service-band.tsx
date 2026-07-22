import type { ReactNode } from "react";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import WhereToVoteRounded from "@mui/icons-material/WhereToVoteRounded";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";
import { resolveStoreBrand } from "./store-brand";

function storeServices(store: StoreSummary): {
  label: string;
  active: boolean;
  helper: string;
  inactiveHelper: string;
  icon: ReactNode;
}[] {
  return [
    {
      label: "Bespoke",
      active: store.settings.bespoke_enabled,
      helper: "Custom order requests tailored to your needs.",
      inactiveHelper: "This store has not opened custom requests.",
      icon: <ContentCutRounded />,
    },
    {
      label: "Measurements",
      active: store.settings.measurements_enabled,
      helper: "Fit details are supported during ordering.",
      inactiveHelper: "Order from the published size options.",
      icon: <StraightenRounded />,
    },
    {
      label: "Delivery",
      active:
        store.settings.delivery_enabled || store.settings.dispatch_enabled,
      helper: "Pickup or delivery options appear at checkout.",
      inactiveHelper: "Confirm handover options with the store.",
      icon: <LocalShippingRounded />,
    },
    {
      label: "Track your order",
      active: true,
      helper: "Follow progress from production to handover.",
      inactiveHelper: "",
      icon: <WhereToVoteRounded />,
    },
    {
      label: "Collections",
      active: store.settings.collections_enabled,
      helper: "Browse grouped drops curated by the store.",
      inactiveHelper: "Pieces appear together in the main catalogue.",
      icon: <StorefrontOutlined />,
    },
  ];
}

export function StoreServiceBand({ store }: { store: StoreSummary }) {
  const brand = resolveStoreBrand(store.brand_color);

  return (
    <Box
      component="aside"
      aria-labelledby="store-confidence-title"
      sx={{
        px: { xs: 0, md: 3 },
        pt: { xs: 3, md: 0 },
        borderTop: { xs: "1px solid", md: "none" },
        borderLeft: { xs: "none", md: "1px solid" },
        borderColor: alpha(tokens.ink, 0.1),
      }}
    >
      <Typography
        id="store-confidence-title"
        variant="h6"
        component="h2"
        sx={{ mb: 1.5 }}
      >
        Shop with confidence
      </Typography>
      <Stack
        divider={
          <Box
            sx={{
              borderTop: "1px solid",
              borderColor: alpha(tokens.ink, 0.08),
            }}
          />
        }
      >
        {storeServices(store).map((service) => (
          <Stack
            key={service.label}
            direction="row"
            spacing={1.4}
            sx={{ py: 1.35, alignItems: "flex-start" }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.25,
                display: "grid",
                placeItems: "center",
                color: service.active ? brand : "text.secondary",
                bgcolor: service.active
                  ? alpha(brand, 0.08)
                  : alpha(tokens.ink, 0.035),
                flexShrink: 0,
                "& svg": { fontSize: 21 },
              }}
            >
              {service.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, lineHeight: 1.25 }}>
                {service.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.35, color: "text.secondary", lineHeight: 1.45 }}
              >
                {service.active ? service.helper : service.inactiveHelper}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
