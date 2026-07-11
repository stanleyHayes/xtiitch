import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TextField from "../../../../components/form-text-field";
import type { MeasurementField, OrderSummary } from "../../../shared/types";
import { orderRouteLabel } from "../../utils";

export function MeasurementsDialog({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
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
        </>
      )}
    </Box>
  );
}
