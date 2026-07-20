import type {
  ManualTaking,
  MoneyPayout,
  MoneySummary,
  OrderSummary,
} from "../shared/types";
import { MoneyPanel } from "./MoneyPanel";
import { PayoutHistoryPanel } from "./PayoutHistoryPanel";

// The whole Money Desk section: the summary cards + manual takings (MoneyPanel)
// and, below them, the §3.3 payout history table fed by the mirrored Paystack
// settlements. Kept here so DashboardSections stays within its line budget.
export function MoneySection({
  summary,
  takings,
  orders,
  payouts,
  error,
}: {
  summary: MoneySummary;
  takings: ManualTaking[];
  orders: OrderSummary[];
  payouts: MoneyPayout[];
  error?: string;
}) {
  return (
    <>
      <MoneyPanel
        summary={summary}
        takings={takings}
        orders={orders}
        error={error}
      />
      <PayoutHistoryPanel payouts={payouts} />
    </>
  );
}
