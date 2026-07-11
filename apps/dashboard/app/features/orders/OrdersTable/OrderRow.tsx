import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import { formatGHS } from "../../../lib/format";
import type { OrderSummary } from "../../shared/types";
import { orderInitials } from "../../shared/utils";
import { orderBalanceDueMinor, orderTargetMinor, stageColor } from "../utils";
import { OrderStatusChip } from "./OrderStatusChip";

export function OrderRow({
  order,
  showMoneyDetails,
  onOpenMenu,
  onOpenDetail,
}: {
  order: OrderSummary;
  showMoneyDetails: boolean;
  onOpenMenu: (event: React.MouseEvent<HTMLElement>, orderId: string) => void;
  onOpenDetail: (orderId: string) => void;
}) {
  const rowColour = stageColor(order.colour);
  const target = orderTargetMinor(order);
  const balance = orderBalanceDueMinor(order);

  return (
    <TableRow
      hover
      sx={{ cursor: "pointer" }}
      onClick={() => onOpenDetail(order.order_id)}
    >
      <TableCell>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 1.25,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              bgcolor: alpha(rowColour, 0.12),
              color: rowColour,
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {orderInitials(order)}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }} noWrap>
              {order.design_title}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary" }}
            >
              Ref {order.order_id.slice(0, 8)}
            </Typography>
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography sx={{ fontWeight: 700 }} noWrap>
          {order.customer_name || "Unnamed customer"}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary" }}
        >
          {order.customer_phone || order.customer_email || "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ flexWrap: "wrap", gap: 0.5 }}
        >
          <Chip
            size="small"
            label={
              order.order_type === "custom" ? "Custom" : "Standard"
            }
          />
          <Chip
            size="small"
            variant="outlined"
            label={
              order.channel === "walk_in" ? "Walk-in" : "Online"
            }
          />
        </Stack>
      </TableCell>
      <TableCell>
        <OrderStatusChip order={order} />
      </TableCell>
      {showMoneyDetails ? (
        <TableCell align="right">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {target !== null && target !== undefined
              ? formatGHS(target)
              : "—"}
          </Typography>
        </TableCell>
      ) : null}
      {showMoneyDetails ? (
        <TableCell align="right">
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: balance > 0 ? "warning.main" : "success.main",
            }}
          >
            {balance > 0 ? formatGHS(balance) : "Settled"}
          </Typography>
        </TableCell>
      ) : null}
      <TableCell
        align="right"
        onClick={(event) => event.stopPropagation()}
      >
        <IconButton
          size="small"
          aria-label="Order actions"
          onClick={(event) => onOpenMenu(event, order.order_id)}
          sx={{
            width: 34,
            height: 34,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: (theme) =>
              alpha(theme.palette.primary.main, 0.06),
            color: "text.secondary",
            "&:hover": {
              color: "primary.main",
              bgcolor: (theme) =>
                alpha(theme.palette.primary.main, 0.12),
            },
          }}
        >
          <MoreVertRounded fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
