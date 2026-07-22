import type { ReactNode } from "react";
import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CallRounded from "@mui/icons-material/CallRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import PaymentRounded from "@mui/icons-material/PaymentRounded";
import type { CustomerOrder } from "../../lib/discovery";

const actionButtonSx = {
  width: { xs: "100%", sm: "auto" },
  minWidth: 0,
  px: { xs: 1.25, sm: 1.5 },
  whiteSpace: "nowrap",
  "& .MuiButton-startIcon": { mr: 0.75 },
} as const;

function ActionForm({
  children,
  reloadDocument,
}: Readonly<{
  children: ReactNode;
  reloadDocument?: boolean;
}>) {
  return (
    <Box
      component={Form}
      method="post"
      reloadDocument={reloadDocument}
      sx={{ minWidth: 0 }}
    >
      {children}
    </Box>
  );
}

export function OrderActions({
  order,
  archived,
}: Readonly<{
  order: CustomerOrder;
  archived: boolean;
}>) {
  const awaitingPayment = order.status.toLowerCase() === "draft";

  return (
    <Box
      sx={{
        display: { xs: "grid", sm: "flex" },
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))" },
        flexWrap: { sm: "wrap" },
        justifyContent: { sm: "flex-end" },
        gap: { xs: 1, sm: 0.75 },
        width: "100%",
      }}
    >
      {awaitingPayment ? (
        <>
          <ActionForm reloadDocument>
            <input type="hidden" name="intent" value="pay_order" />
            <input type="hidden" name="order_id" value={order.order_id} />
            <input
              type="hidden"
              name="store_handle"
              value={order.business_handle}
            />
            <Button
              type="submit"
              size="small"
              variant="contained"
              startIcon={<PaymentRounded />}
              sx={actionButtonSx}
            >
              Pay now
            </Button>
          </ActionForm>
          <ActionForm>
            <input
              type="hidden"
              name="intent"
              value="close_awaiting_payment"
            />
            <input type="hidden" name="order_id" value={order.order_id} />
            <Button
              type="submit"
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<CloseRounded />}
              sx={actionButtonSx}
            >
              Close
            </Button>
          </ActionForm>
        </>
      ) : null}

      {order.store_phone ? (
        <Button
          href={`tel:${order.store_phone}`}
          size="small"
          variant="text"
          startIcon={<CallRounded />}
          aria-label={`Call the store about this order (${order.store_phone})`}
          sx={actionButtonSx}
        >
          Call store
        </Button>
      ) : null}
      <Button
        component={RouterLink}
        to={`/track/${order.order_id}`}
        size="small"
        variant="text"
        startIcon={<LocalShippingRounded />}
        sx={actionButtonSx}
      >
        Track order
      </Button>

      {archived ? (
        <ActionForm>
          <input type="hidden" name="intent" value="mark_received" />
          <input type="hidden" name="order_id" value={order.order_id} />
          <Button
            type="submit"
            size="small"
            variant="contained"
            startIcon={<CheckCircleRounded />}
            sx={actionButtonSx}
          >
            Received
          </Button>
        </ActionForm>
      ) : null}
    </Box>
  );
}
