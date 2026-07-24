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
import { Link, useNavigate } from "react-router";
import TextField from "../../components/form-text-field";
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
  customFrom,
  customTo,
  transactions,
  takings,
  orders,
  payouts,
  error,
}: {
  summary: MoneySummary;
  period: MoneyPeriod;
  customFrom: string;
  customTo: string;
  transactions: MoneyTransaction[];
  takings: ManualTaking[];
  orders: OrderSummary[];
  payouts: MoneyPayout[];
  error?: string;
}) {
  return (
    <>
      <MoneyPeriodFilter
        period={period}
        customFrom={customFrom}
        customTo={customTo}
      />
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

function MoneyPeriodFilter({
  period,
  customFrom,
  customTo,
}: {
  period: MoneyPeriod;
  customFrom: string;
  customTo: string;
}) {
  return (
    <Stack spacing={1.25}>
      <Box sx={{ overflowX: "auto", pb: 0.25 }}>
        <Stack direction="row" spacing={1} sx={{ minWidth: "max-content" }}>
          {moneyPeriodOptions.map((option) => (
            <Button
              key={option.value}
              component={Link}
              to={moneyPeriodHref(option.value, customFrom, customTo)}
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
      {period === "custom" && (
        <CustomRangeFields customFrom={customFrom} customTo={customTo} />
      )}
    </Stack>
  );
}

// The two date fields for a custom range (§3). Each opens the browser's native
// calendar picker; changing either reloads the desk to the new range while
// keeping the other bound. The end date never precedes the start date.
function CustomRangeFields({
  customFrom,
  customTo,
}: {
  customFrom: string;
  customTo: string;
}) {
  const navigate = useNavigate();
  const goTo = (from: string, to: string) => {
    const params = new URLSearchParams({ money: "custom" });
    if (from) {
      params.set("money_from", from);
    }
    if (to) {
      params.set("money_to", to);
    }
    navigate(`/dashboard/money?${params.toString()}`, { replace: true });
  };

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ alignItems: { xs: "stretch", sm: "center" }, maxWidth: 420 }}
    >
      <TextField
        name="money_from"
        label="Start date"
        type="date"
        size="small"
        value={customFrom}
        onChange={(event) => goTo(event.target.value, customTo)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: customTo || undefined } }}
        fullWidth
      />
      <TextField
        name="money_to"
        label="End date"
        type="date"
        size="small"
        value={customTo}
        onChange={(event) => goTo(customFrom, event.target.value)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: customFrom || undefined } }}
        fullWidth
      />
    </Stack>
  );
}

// Named periods carry no dates; the custom option preserves any bounds already
// chosen so re-selecting it does not wipe the range.
function moneyPeriodHref(
  value: MoneyPeriod,
  customFrom: string,
  customTo: string,
): string {
  if (value !== "custom") {
    return `/dashboard/money?money=${value}`;
  }
  const params = new URLSearchParams({ money: "custom" });
  if (customFrom) {
    params.set("money_from", customFrom);
  }
  if (customTo) {
    params.set("money_to", customTo);
  }
  return `/dashboard/money?${params.toString()}`;
}
