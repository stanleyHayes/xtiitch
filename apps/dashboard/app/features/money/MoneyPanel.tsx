import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import TextField from "../../components/form-text-field";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { MoneySummary, ManualTaking, OrderSummary } from "../shared/types";
import { useCloseOnSuccess } from "../settings/useCloseOnSuccess";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { MiniStat } from "../../components/ui/MiniStat";
import { manualTakingMethods } from "../shared/constants";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { formatMethod, formatCommissionStatus } from "./utils";
import { shortDateTime } from "../shared/utils";
import { PaginationFooter } from "../../components/ui/PaginationFooter";

export function MoneyPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  summary,
  takings,
  orders,
  error,
}: {
  summary: MoneySummary;
  takings: ManualTaking[];
  orders: OrderSummary[];
  error?: string;
}) {
  const linkableOrders = orders.filter((order) => order.status !== "cancelled");
  const [logOpen, setLogOpen] = useState(false);
  useCloseOnSuccess(setLogOpen, "log_taking", Boolean(error));
  const {
    page: takingPage,
    pageCount: takingPageCount,
    pagedItems: pagedTakings,
    setPage: setTakingPage,
  } = usePagedItems(takings, 6, takings.length);

  return (
    <Panel id="money">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <AccountBalanceWalletRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Money desk</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Track Paystack splits, cash/direct momo takings, and offline
                commission due.
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { xs: "stretch", sm: "center" } }}
          >
            <ToneChip
              label={`${takings.length} manual entries`}
              tone={tokens.info}
            />
            <Button
              type="button"
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setLogOpen(true)}
            >
              Log taking
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <MiniStat
            icon={<PaymentsRounded fontSize="small" />}
            label="Platform"
            value={formatGHS(summary.through_platform_minor)}
            helper="Paid through checkout"
            tone={tokens.success}
          />
          <MiniStat
            icon={<AccountBalanceWalletRounded fontSize="small" />}
            label="Manual"
            value={formatGHS(summary.manual_takings_minor)}
            helper="Logged cash or momo"
            tone={tokens.info}
          />
          <MiniStat
            icon={<ReceiptLongRounded fontSize="small" />}
            label="Paystack fee"
            value={formatGHS(summary.commission_minor)}
            helper="Already split online"
            tone={tokens.warning}
          />
          <MiniStat
            icon={<WarningAmberRounded fontSize="small" />}
            label="Offline due"
            value={formatGHS(summary.offline_commission_due_minor)}
            helper="Invoice or reconcile later"
            tone={tokens.warning}
          />
          <MiniStat
            icon={<CheckCircleRounded fontSize="small" />}
            label="Net income"
            value={formatGHS(summary.net_income_minor)}
            helper="Gross less online and offline fees"
            tone={tokens.burgundy}
          />
        </Box>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Dialog
          open={logOpen}
          onClose={() => setLogOpen(false)}
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
                  Log manual taking
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  Record cash, direct momo, bank transfer, or other income that
                  did not pass through Xtiitch checkout.
                </Typography>
              </Box>
              <IconButton aria-label="Close" onClick={() => setLogOpen(false)}>
                <CloseRounded />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Form method="post">
              <input type="hidden" name="intent" value="log_taking" />
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
                  <TextField
                    name="amount_ghs"
                    label="Amount"
                    size="small"
                    required
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">GHS</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: "decimal" },
                    }}
                  />
                  <TextField
                    name="method"
                    label="Method"
                    select
                    defaultValue="cash"
                    size="small"
                  >
                    {manualTakingMethods.map((method) => (
                      <MenuItem key={method.value} value={method.value}>
                        {method.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    name="order_id"
                    label="Order link"
                    select
                    defaultValue=""
                    size="small"
                  >
                    <MenuItem value="">No order link</MenuItem>
                    {linkableOrders.map((order) => (
                      <MenuItem key={order.order_id} value={order.order_id}>
                        {order.design_title} ·{" "}
                        {order.customer_name || "Customer"}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    name="what_for"
                    label="What for"
                    size="small"
                    placeholder="Balance, walk-in, alteration"
                    required
                  />
                </Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setLogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<AddRounded />}
                  >
                    Log taking
                  </Button>
                </Stack>
              </Stack>
            </Form>
          </DialogContent>
        </Dialog>
      </Box>

      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        {takings.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <InlineEmptyState
              icon={<AccountBalanceWalletRounded sx={{ fontSize: 38 }} />}
              title="No manual takings yet"
              helper="Cash, mobile money, and other off-platform income will appear here after staff log it."
            />
          </Box>
        ) : (
          <>
            {pagedTakings.map((taking) => (
              <Box
                key={taking.taking_id}
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.4,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(0, 1fr) auto",
                  },
                  alignItems: "center",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {taking.what_for}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {formatMethod(taking.method)} ·{" "}
                    {shortDateTime(taking.taken_at)}
                  </Typography>
                  {taking.commission_minor > 0 ? (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      Offline commission {formatGHS(taking.commission_minor)} ·{" "}
                      {formatCommissionStatus(taking.commission_status)}
                    </Typography>
                  ) : null}
                </Box>
                <Stack
                  spacing={0.35}
                  sx={{ alignItems: { xs: "flex-start", md: "flex-end" } }}
                >
                  <Typography sx={{ fontWeight: 900 }}>
                    {formatGHS(taking.amount_minor)}
                  </Typography>
                  {taking.commission_bps > 0 ? (
                    <ToneChip
                      label={`${(taking.commission_bps / 100).toFixed(2)}% due`}
                      tone={tokens.warning}
                    />
                  ) : null}
                </Stack>
              </Box>
            ))}
            <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
              <PaginationFooter
                count={takingPageCount}
                label="manual entries"
                page={takingPage}
                pageSize={6}
                total={takings.length}
                onChange={setTakingPage}
              />
            </Box>
          </>
        )}
      </Box>
    </Panel>
  );
}
