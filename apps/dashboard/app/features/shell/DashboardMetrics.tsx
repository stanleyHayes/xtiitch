import Box from "@mui/material/Box";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import { MetricCard } from "../../components/ui/MetricCard";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";

export function DashboardMetrics({
  canManage,
  liveOrders,
  pendingPayments,
  needsMeasurements,
  activeBookings,
  openHandovers,
  readyForHandover,
  moneySummary,
}: {
  canManage: boolean;
  liveOrders: { length: number };
  pendingPayments: number;
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  readyForHandover: number;
  moneySummary: { net_income_minor: number };
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          xl: "repeat(4, 1fr)",
        },
      }}
    >
      <MetricCard
        icon={<ReceiptLongRounded />}
        label="Live orders"
        value={String(liveOrders.length)}
        href="/dashboard/orders"
        helper={
          canManage
            ? `${pendingPayments} awaiting payment`
            : "Active production and fitting work"
        }
      />
      {canManage ? (
        <MetricCard
          icon={<AccountBalanceWalletRounded />}
          label="Net income"
          value={formatGHS(moneySummary.net_income_minor)}
          helper="Platform and manual takings"
          tone={tokens.success}
          href="/dashboard/money"
        />
      ) : (
        <MetricCard
          icon={<StraightenRounded />}
          label="Measurements"
          value={String(needsMeasurements)}
          helper="Visit or shop captures waiting"
          tone={tokens.burgundy}
          href="/dashboard/orders"
        />
      )}
      <MetricCard
        icon={<CalendarMonthRounded />}
        label="Visit queue"
        value={String(activeBookings)}
        helper="Held or booked home visits"
        tone={tokens.info}
        href="/dashboard/visits"
      />
      <MetricCard
        icon={<LocalShippingRounded />}
        label="Open handovers"
        value={String(openHandovers)}
        helper={`${readyForHandover} fulfilled orders ready`}
        tone={tokens.warning}
        href="/dashboard/handovers"
      />
    </Box>
  );
}
