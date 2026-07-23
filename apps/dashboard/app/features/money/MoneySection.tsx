import type {
  ManualTaking,
  MoneyPayout,
  MoneyPeriod,
  MoneySummary,
  MoneyTransaction,
  OrderSummary,
} from "../shared/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { Link } from "react-router";
import { moneyPeriodOptions } from "../shared/constants";
import { MoneyPanel } from "./MoneyPanel";
import { PayoutHistoryPanel } from "./PayoutHistoryPanel";
import { TransactionsPanel } from "./TransactionsPanel";
import { tokens } from "../../theme";

// The whole Money Desk section: the summary cards + manual takings (MoneyPanel)
// and, below them, the §3.3 payout history table fed by the mirrored Paystack
// settlements. Kept here so DashboardSections stays within its line budget.
export function MoneySection({
  summary,
  period,
  transactions,
  takings,
  orders,
  payouts,
  error,
}: {
  summary: MoneySummary;
  period: MoneyPeriod;
  transactions: MoneyTransaction[];
  takings: ManualTaking[];
  orders: OrderSummary[];
  payouts: MoneyPayout[];
  error?: string;
}) {
  return (
    <>
      <MoneyPeriodFilter period={period} />
      <MoneyPanel
        summary={summary}
        takings={takings}
        orders={orders}
        error={error}
      />
      <TransactionsPanel transactions={transactions} period={period} />
      <PayoutHistoryPanel payouts={payouts} />
    </>
  );
}

function MoneyPeriodFilter({ period }: { period: MoneyPeriod }) {
  return (
    <Box sx={{ overflowX: "auto", pb: 0.25 }}>
      <Stack direction="row" spacing={1} sx={{ minWidth: "max-content" }}>
        {moneyPeriodOptions.map((option) => (
          <Button
            key={option.value}
            component={Link}
            to={`/dashboard/money?money=${option.value}`}
            replace
            size="small"
            variant={period === option.value ? "contained" : "outlined"}
            sx={{
              borderRadius: 999,
              whiteSpace: "nowrap",
              ...(period === option.value
                ? {}
                : { color: tokens.burgundy, borderColor: "divider" }),
            }}
          >
            {option.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}
