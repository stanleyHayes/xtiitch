import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../theme";
import type { OrderSummary } from "../../shared/types";
import { ToneChip } from "../../../components/ui/ToneChip";
import { orderInitials, shortDate } from "../../shared/utils";
import { orderRouteLabel, stageColor, statusLabel } from "../utils";

export function OrderHeader({ order }: { order: OrderSummary }) {
  const colour = stageColor(order.colour);

  return (
    <Stack
      spacing={2}
      sx={{
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "stretch",
        "@container (min-width: 720px)": {
          flexDirection: "row",
          alignItems: "flex-start",
        },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            bgcolor: alpha(colour, 0.1),
            color: colour,
            fontWeight: 800,
          }}
        >
          {orderInitials(order)}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap", mb: 0.75 }}
          >
            <ToneChip
              label={order.order_type === "custom" ? "Custom" : "Standard"}
              tone={tokens.burgundy}
            />
            <Chip
              size="small"
              variant="outlined"
              label={order.channel === "walk_in" ? "Walk-in" : "Online"}
            />
            <Chip
              size="small"
              variant="outlined"
              label={orderRouteLabel(order)}
            />
          </Stack>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            {order.design_title}
          </Typography>
          <Typography sx={{ mt: 0.65, color: "text.secondary" }}>
            {order.customer_name || "Unnamed customer"}{" "}
            {shortDate(order.created_at)
              ? `· ${shortDate(order.created_at)}`
              : ""}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          border: "1px solid",
          borderColor: alpha(colour, 0.28),
          borderRadius: 2,
          p: 1.5,
          bgcolor: alpha(colour, 0.08),
          "@container (min-width: 720px)": {
            maxWidth: 280,
          },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: colour,
              flexShrink: 0,
            }}
          />
          <Typography sx={{ fontWeight: 800 }}>
            {order.stage_name || statusLabel(order.status)}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          sx={{ mt: 0.75, color: "text.secondary" }}
        >
          {statusLabel(order.status)}
        </Typography>
      </Box>
    </Stack>
  );
}

