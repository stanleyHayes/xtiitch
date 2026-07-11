import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
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
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import SaveRounded from "@mui/icons-material/SaveRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TextField from "../../components/form-text-field";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { OrderSummary, MeasurementField } from "../shared/types";
import { stageColor, paymentTone, measurementSourceFor, orderTargetMinor, orderBalanceDueMinor, orderRouteLabel, statusLabel, paymentLabel, moneyProgress, moneyInputValue } from "./utils";
import { Panel } from "../../components/ui/Panel";
import { orderInitials, shortDate, whatsappHref } from "../shared/utils";
import { ToneChip } from "../../components/ui/ToneChip";
import { InfoStrip } from "../studio/InfoStrip";

export function OrderCard({
  order,
  returnTo,
  measurementFields,
  showMoneyDetails,
}: {
  order: OrderSummary;
  returnTo: string;
  measurementFields: MeasurementField[];
  showMoneyDetails: boolean;
}) {
  const colour = stageColor(order.colour);
  const payTone = paymentTone(order);
  const canAdvance = order.status === "confirmed";
  const measurementSource = measurementSourceFor(order);
  const showMeasurementCapture = Boolean(measurementSource);
  const targetMinor = orderTargetMinor(order);
  const balanceDueMinor = orderBalanceDueMinor(order);
  const canCollectBalance =
    showMoneyDetails &&
    balanceDueMinor > 0 &&
    ["confirmed", "fulfilled"].includes(order.status);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);

  return (
    <Panel
      id={`order-${order.order_id}`}
      sx={{
        height: "100%",
        p: { xs: 2, md: 2.5 },
        containerType: "inline-size",
      }}
    >
      <Stack spacing={2.25}>
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

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: "1fr",
            "@container (min-width: 720px)": {
              gridTemplateColumns: "1fr 1fr",
            },
          }}
        >
          <InfoStrip
            icon={<PaymentsRounded />}
            tone={payTone}
            title={paymentLabel(order)}
            helper={
              showMoneyDetails
                ? moneyProgress(order)
                : "Payment detail visible to owners and admins"
            }
          />
          <InfoStrip
            icon={<PhoneRounded />}
            tone={tokens.info}
            title={order.customer_phone || "No phone captured"}
            helper={order.customer_email || "No email captured"}
          />
          {whatsappHref(order.customer_whatsapp, order.customer_phone) ? (
            <Button
              component="a"
              href={
                whatsappHref(order.customer_whatsapp, order.customer_phone) ??
                undefined
              }
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              size="small"
              fullWidth
              startIcon={<WhatsApp />}
              sx={{
                mt: 1,
                bgcolor: "#25D366",
                color: "#0a3d20",
                fontWeight: 700,
                "&:hover": { bgcolor: "#1EBE57" },
              }}
            >
              Chat on WhatsApp
              {order.customer_whatsapp ? ` · ${order.customer_whatsapp}` : ""}
            </Button>
          ) : null}
        </Box>

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
                onClick={() => setPaymentOpen(true)}
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
            <Dialog
              open={paymentOpen}
              onClose={() => setPaymentOpen(false)}
              fullWidth
              maxWidth="sm"
            >
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
                  <IconButton
                    aria-label="Close"
                    onClick={() => setPaymentOpen(false)}
                  >
                    <CloseRounded />
                  </IconButton>
                </Stack>
              </DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2.25}>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="set_agreed_total"
                    />
                    <input
                      type="hidden"
                      name="order_id"
                      value={order.order_id}
                    />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Stack spacing={1.25}>
                      <Typography sx={{ fontWeight: 900 }}>
                        Agreed total
                      </Typography>
                      <TextField
                        name="agreed_total_ghs"
                        label="Agreed total"
                        size="small"
                        defaultValue={moneyInputValue(targetMinor)}
                        fullWidth
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                GHS
                              </InputAdornment>
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
                        <Button
                          type="submit"
                          variant="outlined"
                          startIcon={<SaveRounded />}
                        >
                          Save total
                        </Button>
                      </Stack>
                    </Stack>
                  </Form>
                  <Divider />
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="collect_balance"
                    />
                    <input
                      type="hidden"
                      name="order_id"
                      value={order.order_id}
                    />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Stack spacing={1.25}>
                      <Typography sx={{ fontWeight: 900 }}>
                        Collect balance
                      </Typography>
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

        {showMeasurementCapture ? (
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
                  onClick={() => setMeasurementsOpen(true)}
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
                <Dialog
                  open={measurementsOpen}
                  onClose={() => setMeasurementsOpen(false)}
                  fullWidth
                  maxWidth="sm"
                >
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
                          {order.design_title} ·{" "}
                          {order.customer_name || "Customer"}
                        </Typography>
                      </Box>
                      <IconButton
                        aria-label="Close"
                        onClick={() => setMeasurementsOpen(false)}
                      >
                        <CloseRounded />
                      </IconButton>
                    </Stack>
                  </DialogTitle>
                  <DialogContent dividers>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="record_measurements"
                      />
                      <input
                        type="hidden"
                        name="order_id"
                        value={order.order_id}
                      />
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
                          <Button
                            type="button"
                            variant="outlined"
                            onClick={() => setMeasurementsOpen(false)}
                          >
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
              </Stack>
            )}
          </Box>
        ) : null}
      </Stack>
    </Panel>
  );
}