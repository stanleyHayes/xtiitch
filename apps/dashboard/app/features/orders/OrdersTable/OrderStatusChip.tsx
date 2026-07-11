import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { OrderSummary } from "../../shared/types";
import { stageColor, statusLabel } from "../utils";

export function OrderStatusChip({ order }: { order: OrderSummary }) {
  const colour = stageColor(order.colour);
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", minWidth: 0 }}
    >
      <Box
        sx={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          bgcolor: colour,
          flexShrink: 0,
        }}
      />
      <Typography
        variant="body2"
        sx={{ fontWeight: 700 }}
        noWrap
      >
        {order.stage_name || statusLabel(order.status)}
      </Typography>
    </Stack>
  );
}
