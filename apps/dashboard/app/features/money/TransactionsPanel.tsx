import { useState } from "react";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import InfoRounded from "@mui/icons-material/InfoRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { formatGHS } from "../../lib/format";
import { Panel } from "../../components/ui/Panel";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { ToneChip } from "../../components/ui/ToneChip";
import { tokens } from "../../theme";
import type { MoneyPeriod, MoneyTransaction } from "../shared/types";
import { usePagedItems } from "../shared/hooks";
import { shortDateTime } from "../shared/utils";

const transactionPageSize = 8;

function periodLabel(period: MoneyPeriod): string {
  switch (period) {
    case "last_7_days":
      return "Last 7 days";
    case "this_month":
      return "This month";
    case "last_month":
      return "Last month";
    case "all_time":
      return "All time";
    default:
      return "Today";
  }
}

function purposeLabel(purpose: string): string {
  return purpose
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TransactionsPanel({
  transactions,
  period,
}: {
  transactions: MoneyTransaction[];
  period: MoneyPeriod;
}) {
  const [selected, setSelected] = useState<MoneyTransaction | null>(null);
  const { page, pageCount, pagedItems, setPage } = usePagedItems(
    transactions,
    transactionPageSize,
    transactions.length,
  );

  return (
    <Panel id="money-transactions">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          sx={{
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <ReceiptLongRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
                {period === "today"
                  ? "Today's transactions"
                  : `${periodLabel(period)} transactions`}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Paid storefront transactions with Paystack, tax and take-home
                breakdowns.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${transactions.length} paid`}
            tone={tokens.success}
          />
        </Stack>
      </Box>

      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        {transactions.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <InlineEmptyState
              icon={<ReceiptLongRounded sx={{ fontSize: 38 }} />}
              title="No paid transactions here yet"
              helper="Successful storefront payments in the selected period will appear here with their full breakdown."
            />
          </Box>
        ) : (
          <>
            {pagedItems.map((transaction) => (
              <TransactionRow
                key={transaction.payment_id}
                transaction={transaction}
                onOpen={() => setSelected(transaction)}
              />
            ))}
            <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
              <PaginationFooter
                count={pageCount}
                label="transactions"
                page={page}
                pageSize={transactionPageSize}
                total={transactions.length}
                onChange={setPage}
              />
            </Box>
          </>
        )}
      </Box>
      <TransactionDialog
        transaction={selected}
        onClose={() => setSelected(null)}
      />
    </Panel>
  );
}

function TransactionRow({
  transaction,
  onOpen,
}: {
  transaction: MoneyTransaction;
  onOpen: () => void;
}) {
  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
        display: "grid",
        gap: { xs: 1, md: 1.25 },
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1.25fr) minmax(0, 0.8fr) minmax(0, 0.8fr) auto",
        },
        alignItems: "center",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 900 }} noWrap>
          {transaction.design_title || purposeLabel(transaction.purpose)}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
          {transaction.customer_name || "Customer"} ·{" "}
          {shortDateTime(transaction.created_at)}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Gross paid
        </Typography>
        <Typography sx={{ fontWeight: 900 }}>
          {formatGHS(transaction.amount_minor)}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Take-home
        </Typography>
        <Typography sx={{ fontWeight: 900 }}>
          {formatGHS(transaction.take_home_minor)}
        </Typography>
      </Box>
      <Button
        type="button"
        variant="outlined"
        size="small"
        startIcon={<InfoRounded />}
        onClick={onOpen}
        sx={{ justifySelf: { xs: "stretch", md: "end" }, whiteSpace: "nowrap" }}
      >
        View details
      </Button>
    </Box>
  );
}

function TransactionDialog({
  transaction,
  onClose,
}: {
  transaction: MoneyTransaction | null;
  onClose: () => void;
}) {
  if (!transaction) {
    return null;
  }
  const rows = [
    ["Design cost", transaction.design_cost_minor],
    ["Paystack fee", transaction.paystack_fee_minor],
    ["Xtiitch fee", transaction.xtiitch_fee_minor],
    ["Tax fee", transaction.xtiitch_tax_minor],
    ["Business take-home", transaction.take_home_minor],
  ] as const;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 950 }} noWrap>
              Transaction breakdown
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
              {transaction.reference}
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={onClose}>
            <CloseRounded />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <ToneChip
              label={transaction.order_id || "No order ID"}
              tone={tokens.info}
            />
            <ToneChip
              label={purposeLabel(transaction.purpose)}
              tone={tokens.burgundy}
            />
          </Stack>
          <Box
            sx={{
              p: 1.5,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "rgba(var(--surface-rgb), 0.72)",
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <AccountBalanceWalletRounded
                sx={{ color: tokens.success, fontSize: 20 }}
              />
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Gross paid by customer
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 950 }}>
                  {formatGHS(transaction.amount_minor)}
                </Typography>
              </Box>
            </Stack>
          </Box>
          {rows.map(([label, amount]) => (
            <Stack
              key={label}
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid",
                borderColor: "divider",
                pb: 1,
              }}
            >
              <Typography sx={{ color: "text.secondary" }}>{label}</Typography>
              <Typography sx={{ fontWeight: 900 }}>{formatGHS(amount)}</Typography>
            </Stack>
          ))}
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Paystack fee, Xtiitch fee and tax fee are stored from the paid
            transaction. Net income uses the business take-home amount and
            drops when the matching Paystack payout settles.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
