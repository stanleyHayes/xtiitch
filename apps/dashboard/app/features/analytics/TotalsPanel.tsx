import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { lookbackLabel } from "../../lib/entitlements";
import { Panel } from "../../components/ui/Panel";
import { MetricCard } from "../../components/ui/MetricCard";
import { ToneChip } from "../../components/ui/ToneChip";
import { shortDate } from "../shared/utils";
import type { AnalyticsSummary } from "./types";

// The API echoes the exact window it applied; that (not the plan label) is
// the truth — a Studio custom range narrows it, full history leaves it open.
function windowLabelFor(
  summary: AnalyticsSummary | null,
  lookbackDays: number | null,
  customRangeActive: boolean,
): string {
  if (!summary) {
    return lookbackLabel(lookbackDays);
  }
  if (customRangeActive && summary.window.from) {
    return `${shortDate(summary.window.from)} – ${shortDate(summary.window.to)}`;
  }
  return summary.window.from
    ? `${lookbackLabel(lookbackDays)} · since ${shortDate(summary.window.from)}`
    : lookbackLabel(null);
}

// §14.1 "Totals" — the one analytics capability EVERY plan gets: sales,
// orders, order-status counts, customers and designs across the plan's
// lookback window. The window itself is displayed (Free 30d / Starter 12mo /
// full history) so the numbers are never read out of context.
export function TotalsPanel({
  summary,
  lookbackDays,
  customRangeActive,
}: {
  summary: AnalyticsSummary | null;
  lookbackDays: number | null;
  customRangeActive: boolean;
}) {
  const windowLabel = windowLabelFor(summary, lookbackDays, customRangeActive);

  return (
    <Panel id="analytics-totals">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <InsightsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Store totals</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Sales, orders, customers and designs across your plan&apos;s
                window.
              </Typography>
            </Box>
          </Stack>
          <ToneChip label={windowLabel} tone={tokens.info} />
        </Stack>

        <Box
          sx={{
            mt: 2,
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
            icon={<PaymentsRounded />}
            label="Sales"
            value={formatGHS(summary?.sales_total_minor ?? 0)}
            helper="Checkout + manual takings in the window"
            tone={tokens.success}
          />
          <MetricCard
            icon={<ReceiptLongRounded />}
            label="Orders"
            value={String(summary?.orders_count ?? 0)}
            helper="Placed in the window"
            tone={tokens.burgundy}
          />
          <MetricCard
            icon={<PeopleAltRounded />}
            label="Customers"
            value={String(summary?.customers_count ?? 0)}
            helper="Ordered from your store"
            tone={tokens.info}
          />
          <MetricCard
            icon={<DesignServicesRounded />}
            label="Designs"
            value={String(summary?.designs_count ?? 0)}
            helper="Live in your catalogue"
            tone={tokens.gold}
          />
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
          {(summary?.orders_by_status ?? []).map((bucket) => (
            <ToneChip
              key={bucket.status}
              label={`${bucket.count} ${statusLabel(bucket.status)}`}
              tone={statusTone(bucket.status)}
            />
          ))}
          {(summary?.orders_by_status ?? []).length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No orders in this window yet — share your storefront to get the
              first one.
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Panel>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "awaiting pay";
    case "confirmed":
      return "in studio";
    case "fulfilled":
      return "fulfilled";
    case "cancelled":
      return "cancelled";
    default:
      return status.replaceAll("_", " ");
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "fulfilled":
      return tokens.success;
    case "confirmed":
      return tokens.info;
    case "draft":
      return tokens.warning;
    case "cancelled":
      return tokens.mutedText;
    default:
      return tokens.gold;
  }
}
