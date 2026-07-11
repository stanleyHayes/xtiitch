import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { formatGHS } from "../../../../lib/format";
import { tokens } from "../../../../theme";
import type { MeasurementField, OrderSummary } from "../../../shared/types";
import {
  measurementSourceFor,
  orderBalanceDueMinor,
  orderTargetMinor,
  statusLabel,
} from "../../utils";
import { MeasurementsDialog } from "./MeasurementsDialog";
import { PaymentDialog } from "./PaymentDialog";

export function OrderActions({
  order,
  returnTo,
  measurementFields,
  showMoneyDetails,
  paymentOpen,
  measurementsOpen,
  onPaymentOpen,
  onPaymentClose,
  onMeasurementsOpen,
  onMeasurementsClose,
}: {
  order: OrderSummary;
  returnTo: string;
  measurementFields: MeasurementField[];
  showMoneyDetails: boolean;
  paymentOpen: boolean;
  measurementsOpen: boolean;
  onPaymentOpen: () => void;
  onPaymentClose: () => void;
  onMeasurementsOpen: () => void;
  onMeasurementsClose: () => void;
}) {
  const canAdvance = order.status === "confirmed";
  const measurementSource = measurementSourceFor(order);
  const showMeasurementCapture = Boolean(measurementSource);
  const targetMinor = orderTargetMinor(order);
  const balanceDueMinor = orderBalanceDueMinor(order);
  const canCollectBalance =
    showMoneyDetails &&
    balanceDueMinor > 0 &&
    ["confirmed", "fulfilled"].includes(order.status);

  return (
    <>
      {showMoneyDetails ? (
        <Box
          sx={{
            border: "1px solid",
            borderColor: alpha(tokens.burgundy, 0.14),
            borderRadius: 2,
            p: 1.25,
            bgcolor: "rgba(var(--surface-rgb), 0.72)",
            backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.055)}, transparent 48%)`,
          }}
        >
          <Stack
            spacing={1}
            sx={{
              flexDirection: "column",
              alignItems: "stretch",
              justifyContent: "space-between",
              "@container (min-width: 720px)": {
                flexDirection: "row",
                alignItems: "center",
              },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900 }}>
                Payment controls
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Agreed total{" "}
                {targetMinor === null ? "Not set" : formatGHS(targetMinor)} ·
                Balance {formatGHS(balanceDueMinor)}
              </Typography>
            </Box>
            <Button
              type="button"
              variant="outlined"
              startIcon={<PaymentsRounded />}
              onClick={onPaymentOpen}
              fullWidth
              sx={{
                "@container (min-width: 720px)": {
                  width: "auto",
                  minWidth: 190,
                },
              }}
            >
              Manage payment
            </Button>
          </Stack>
          <PaymentDialog
            order={order}
            returnTo={returnTo}
            open={paymentOpen}
            onClose={onPaymentClose}
            targetMinor={targetMinor}
            balanceDueMinor={balanceDueMinor}
            canCollectBalance={canCollectBalance}
          />
        </Box>
      ) : null}

      <Stack
        spacing={1.25}
        sx={{
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "stretch",
          "@container (min-width: 720px)": {
            flexDirection: "row",
            alignItems: "center",
          },
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Ref {order.order_id.slice(0, 8)}
        </Typography>
        <Form method="post" style={{ width: "100%" }}>
          <input type="hidden" name="intent" value="advance" />
          <input type="hidden" name="order_id" value={order.order_id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <Button
            type="submit"
            variant={canAdvance ? "contained" : "outlined"}
            disabled={!canAdvance}
            endIcon={<ArrowForwardRounded />}
            fullWidth
          >
            {canAdvance ? "Advance stage" : statusLabel(order.status)}
          </Button>
        </Form>
      </Stack>

      {showMeasurementCapture && measurementSource ? (
        <MeasurementsDialog
          order={order}
          measurementFields={measurementFields}
          measurementSource={measurementSource}
          open={measurementsOpen}
          onOpen={onMeasurementsOpen}
          onClose={onMeasurementsClose}
        />
      ) : null}
    </>
  );
}
