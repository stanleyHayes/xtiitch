import { Form } from "react-router";
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
import CloseRounded from "@mui/icons-material/CloseRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import TextField from "../../../../components/form-text-field";
import { formatGHS } from "../../../../lib/format";
import type { OrderSummary } from "../../../shared/types";
import { moneyInputValue } from "../../utils";

export function PaymentDialog({
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
