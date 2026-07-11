import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import { tokens } from "../../theme";
import type { TrackingHandover } from "./types";
import { formatHandoverMethod, formatHandoverStatus } from "./utils";

export function HandoverPanel({
  handover,
  storeName,
}: {
  handover?: TrackingHandover | null;
  storeName: string;
}) {
  const method = handover?.method ?? "pickup";
  const isDelivery = method === "delivery";
  const status = handover ? formatHandoverStatus(handover.status) : "Being arranged";
  const icon = isDelivery ? <LocalShippingRounded /> : <ShoppingBagRounded />;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "8px",
        bgcolor: alpha(tokens.charcoal, 0.04),
        border: "1px solid",
        borderColor: alpha(tokens.charcoal, 0.1),
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { sm: "center" } }}
      >
        <Box
          aria-hidden
          sx={{
            width: 42,
            height: 42,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(tokens.burgundy, 0.1),
            color: tokens.burgundy,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography sx={{ fontWeight: 950 }}>
              {handover ? formatHandoverMethod(method) : "Handover"}
            </Typography>
            <Chip
              size="small"
              label={status}
              sx={{
                bgcolor: alpha(tokens.burgundy, 0.08),
                color: tokens.burgundy,
                fontWeight: 900,
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {handover
              ? isDelivery
                ? handover.address || "Delivery details are being finalised."
                : "Pickup is handled directly with the store."
              : `${storeName} will add pickup or delivery details when the piece is ready.`}
          </Typography>
        </Box>
      </Stack>

      {handover ? (
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          {handover.recipient_name || handover.recipient_phone ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {handover.recipient_name}
              {handover.recipient_name && handover.recipient_phone ? " · " : ""}
              {handover.recipient_phone}
            </Typography>
          ) : null}
          {handover.courier ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Courier: {handover.courier}
            </Typography>
          ) : null}
          {handover.note ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {handover.note}
            </Typography>
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}
