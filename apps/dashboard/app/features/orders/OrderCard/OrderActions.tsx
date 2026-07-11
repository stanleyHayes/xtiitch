import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TextField from "../../../components/form-text-field";
import { formatGHS } from "../../../lib/format";
import { tokens } from "../../../theme";
import type { MeasurementField, OrderSummary } from "../../shared/types";
import {
  measurementSourceFor,
  moneyInputValue,
  orderBalanceDueMinor,
  orderRouteLabel,
  orderTargetMinor,
  statusLabel,
} from "../utils";

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
        <MeasurementsSection
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

function PaymentDialog({
  order,
  returnTo,
  open,
  onClose,
  targetMinor,
  balanceDueMinor,
  canCollectBalance,
}: {
  order: OrderSummary;
  returnTo: string;
  open: boolean;
  onClose: () => void;
  targetMinor: number | null;
  balanceDueMinor: number;
  canCollectBalance: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              sx={{ display: "block", fontWeight: 950 }}
            >
              Payment controls
            </Typography>
            <Typography
              component="span"
              variant="body2"
              sx={{ display: "block", color: "text.secondary" }}
            >
              {order.design_title} · {order.customer_name || "Customer"}
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25}>
          <Form method="post">
            <input type="hidden" name="intent" value="set_agreed_total" />
            <input type="hidden" name="order_id" value={order.order_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <Stack spacing={1.25}>
              <Typography sx={{ fontWeight: 900 }}>Agreed total</Typography>
              <TextField
                name="agreed_total_ghs"
                label="Agreed total"
                size="small"
                defaultValue={moneyInputValue(targetMinor)}
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: "decimal" },
                }}
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button type="submit" variant="outlined" startIcon={<SaveRounded />}>
                  Save total
                </Button>
              </Stack>
            </Stack>
          </Form>
          <Divider />
          <Form method="post">
            <input type="hidden" name="intent" value="collect_balance" />
            <input type="hidden" name="order_id" value={order.order_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <Stack spacing={1.25}>
              <Typography sx={{ fontWeight: 900 }}>Collect balance</Typography>
              <TextField
                name="method"
                label="Balance method"
                select
                size="small"
                defaultValue="momo"
                disabled={!canCollectBalance}
                fullWidth
              >
                <MenuItem value="momo">Mobile money</MenuItem>
                <MenuItem value="card">Card</MenuItem>
              </TextField>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canCollectBalance}
                  startIcon={<PaymentsRounded />}
                >
                  {balanceDueMinor > 0
                    ? `Collect ${formatGHS(balanceDueMinor)}`
                    : "Paid"}
                </Button>
              </Stack>
            </Stack>
          </Form>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function MeasurementsSection({
  order,
  measurementFields,
  measurementSource,
  open,
  onOpen,
  onClose,
}: {
  order: OrderSummary;
  measurementFields: MeasurementField[];
  measurementSource: "visit" | "shop";
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        pt: 2,
      }}
    >
      {measurementFields.length === 0 ? (
        <Alert severity="info" icon={<StraightenRounded />}>
          Add measurement fields before recording this{" "}
          {orderRouteLabel(order).toLowerCase()} order.
        </Alert>
      ) : (
        <>
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
              <Typography sx={{ fontWeight: 800 }}>
                {measurementSource === "visit"
                  ? "Visit measurements"
                  : "Shop measurements"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {measurementFields.length} configured fields
              </Typography>
            </Box>
            <Button
              type="button"
              variant="outlined"
              startIcon={<StraightenRounded />}
              onClick={onOpen}
              fullWidth
              sx={{
                "@container (min-width: 720px)": {
                  width: "auto",
                  minWidth: 210,
                },
              }}
            >
              Record measurements
            </Button>
          </Stack>
          <MeasurementsDialog
            order={order}
            measurementFields={measurementFields}
            measurementSource={measurementSource}
            open={open}
            onClose={onClose}
          />
        </>
      )}
    </Box>
  );
}

function MeasurementsDialog({
  order,
  measurementFields,
  measurementSource,
  open,
  onClose,
}: {
  order: OrderSummary;
  measurementFields: MeasurementField[];
  measurementSource: "visit" | "shop";
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              sx={{ display: "block", fontWeight: 950 }}
            >
              {measurementSource === "visit"
                ? "Visit measurements"
                : "Shop measurements"}
            </Typography>
            <Typography
              component="span"
              variant="body2"
              sx={{ display: "block", color: "text.secondary" }}
            >
              {order.design_title} · {order.customer_name || "Customer"}
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Form method="post">
          <input type="hidden" name="intent" value="record_measurements" />
          <input type="hidden" name="order_id" value={order.order_id} />
          <input
            type="hidden"
            name="source"
            value={measurementSource ?? ""}
          />
          <input
            type="hidden"
            name="return_to"
            value={`/dashboard/orders?orders=${order.order_type}`}
          />
          <Stack spacing={2}>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                },
              }}
            >
              {measurementFields.map((field) => (
                <TextField
                  key={field.field_id}
                  name={`measurement_${field.field_id}`}
                  label={`${field.label} (${field.unit})`}
                  size="small"
                  slotProps={{
                    htmlInput: { inputMode: "decimal" },
                  }}
                />
              ))}
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ justifyContent: "flex-end" }}
            >
              <Button type="button" variant="outlined" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveRounded />}
              >
                Save measurements
              </Button>
            </Stack>
          </Stack>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
