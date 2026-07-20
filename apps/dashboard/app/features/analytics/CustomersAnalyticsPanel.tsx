import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import PersonAddRounded from "@mui/icons-material/PersonAddRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { formatPercent } from "../shared/utils";
import { Panel } from "../../components/ui/Panel";
import { MiniStat } from "../../components/ui/MiniStat";
import { shortDate } from "../shared/utils";
import type { CustomerGrowthPoint, CustomersAnalytics } from "./types";

// §14.1 "New vs returning customers" — Starter sees the basic mix; Growth+
// adds the full customer analytics (repeat rate, top customers, monthly
// growth). The extra blocks render only when the API included them — it omits
// those keys below full, which is the gating signal.
export function CustomersAnalyticsPanel({
  customers,
}: {
  customers: CustomersAnalytics | null;
}) {
  const growth = customers?.growth ?? [];
  const topCustomers = customers?.top_customers ?? [];

  return (
    <Panel id="analytics-customers">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <PeopleAltRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Customer analytics</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Who is new, who comes back, and who spends the most.
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            },
          }}
        >
          <MiniStat
            icon={<PersonAddRounded fontSize="small" />}
            label="New customers"
            value={String(customers?.new_customers ?? 0)}
            helper="First order in the window"
            tone={tokens.success}
          />
          <MiniStat
            icon={<ReplayRounded fontSize="small" />}
            label="Returning customers"
            value={String(customers?.returning_customers ?? 0)}
            helper="Ordered before, ordered again"
            tone={tokens.info}
          />
          {typeof customers?.repeat_rate === "number" ? (
            <MiniStat
              icon={<FavoriteRounded fontSize="small" />}
              label="Repeat rate"
              value={formatPercent((customers.repeat_rate ?? 0) * 100)}
              helper="Share of customers who order again"
              tone={tokens.gold}
            />
          ) : null}
        </Box>

        {topCustomers.length > 0 ? (
          <Box sx={{ mt: 2.5 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Top customers
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {topCustomers.map((customer) => (
                <Stack
                  key={customer.customer_id}
                  direction="row"
                  spacing={1}
                  sx={{
                    p: 1.25,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    alignItems: "center",
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {customer.display_name || customer.phone}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      {customer.orders}{" "}
                      {customer.orders === 1 ? "order" : "orders"} · last{" "}
                      {shortDate(customer.last_order_at)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 900, flexShrink: 0 }}>
                    {formatGHS(customer.spend_minor)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ) : null}

        {growth.length > 0 ? <GrowthStrip growth={growth} /> : null}
      </Box>
    </Panel>
  );
}

// §14.1 Growth "month-on-month" framing: the new-customers-per-month series as
// a mini bar strip (horizontally scrollable once months outgrow the phone).
function GrowthStrip({ growth }: { growth: CustomerGrowthPoint[] }) {
  const peakGrowth = Math.max(1, ...growth.map((point) => point.new_customers));
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        New customers per month
      </Typography>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ mt: 1, alignItems: "flex-end", overflowX: "auto", pb: 0.5 }}
      >
        {growth.map((point) => (
          <Stack
            key={point.month}
            spacing={0.5}
            sx={{ alignItems: "center", minWidth: 44 }}
          >
            <Typography variant="caption" sx={{ fontWeight: 900 }}>
              {point.new_customers}
            </Typography>
            <Box
              sx={{
                width: 26,
                height: Math.max(
                  6,
                  Math.round((point.new_customers / peakGrowth) * 64),
                ),
                borderRadius: 1,
                bgcolor: (theme) =>
                  point.new_customers > 0
                    ? theme.palette.primary.main
                    : alpha(theme.palette.divider, 0.8),
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontSize: "0.66rem" }}
            >
              {monthLabel(point.month)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function monthLabel(month: string): string {
  // "2026-07" → "Jul"
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const index = Number.parseInt(month.slice(5, 7), 10) - 1;
  return names[index] ?? month;
}
