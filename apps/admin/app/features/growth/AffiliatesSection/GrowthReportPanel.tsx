import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import type { AdminGrowthReport } from "../../../lib/api";
import { formatGHS } from "../../shared/formatting";
import { Panel } from "../../../components/ui/Panel";

export function GrowthReportPanel({
  report,
  error,
}: {
  report: AdminGrowthReport;
  error: string | null;
}) {
  const metrics = report.metrics;
  const items = [
    ["Clicks", metrics.clicks.toLocaleString()],
    ["Qualified signups", (metrics.customer_signups + metrics.business_signups).toLocaleString()],
    ["Purchases", metrics.purchase_conversions.toLocaleString()],
    ["Paid-plan signups", metrics.paid_plan_conversions.toLocaleString()],
    ["Gross eligible", formatGHS(metrics.gross_eligible_minor)],
    ["Total discounts", formatGHS(metrics.store_discount_minor + metrics.paid_plan_discount_minor)],
    ["Commission settled", formatGHS(metrics.settled_commission_minor)],
    ["Commission reversed", formatGHS(metrics.reversed_commission_minor)],
  ];
  return (
    <Panel sx={{ p: 2.5 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <Box>
          <Typography variant="overline">Growth reporting</Typography>
          <Typography variant="h6">Affiliate and promotion funnel</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Combined store and paid-plan performance for the last 30 days.
          </Typography>
        </Box>
        <Button component="a" href="/admin/growth-report.csv" startIcon={<DownloadRounded />} variant="outlined">
          Export CSV
        </Button>
      </Stack>
      {error ? <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5, mt: 2 }}>
        {items.map(([label, value]) => (
          <Box key={label} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>{label}</Typography>
            <Typography sx={{ fontWeight: 900 }}>{value}</Typography>
          </Box>
        ))}
      </Box>
    </Panel>
  );
}
