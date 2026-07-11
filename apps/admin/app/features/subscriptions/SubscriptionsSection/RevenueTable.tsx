import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import { formatGHS } from "../../shared/formatting";
import type { AdminPlan } from "../../shared/types";

export type PlanRevenueRow = {
  plan: AdminPlan;
  activeTotal: number;
  businessTotal: number;
  gmvMinor: number;
  commissionMinor: number;
  estimatedMrrMinor: number;
};

export function RevenueTable({
  planRows,
  pagedPlanRows,
  page,
  pageCount,
  onPageChange,
}: {
  planRows: PlanRevenueRow[];
  pagedPlanRows: PlanRevenueRow[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography variant="h6">Revenue by package</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Subscribers, GMV and commission earned per package — the editable
          definitions and recurring fees are in the cards above.
        </Typography>
      </Stack>
      <Panel sx={{ p: 0, overflow: "hidden" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) repeat(3, minmax(0, 1fr))",
            gap: 1,
            px: { xs: 1.5, md: 2 },
            py: 1.25,
            bgcolor: "rgba(var(--surface-rgb), 0.5)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {["Package", "Businesses", "GMV", "Commission earned"].map(
            (headLabel, index) => (
              <Typography
                key={headLabel}
                variant="caption"
                sx={{
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "text.secondary",
                  textAlign: index === 0 ? "left" : "right",
                }}
              >
                {headLabel}
              </Typography>
            ),
          )}
        </Box>
        {pagedPlanRows.map((row) => (
          <Box
            key={row.plan.code}
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.5fr) repeat(3, minmax(0, 1fr))",
              gap: 1,
              px: { xs: 1.5, md: 2 },
              py: 1.5,
              alignItems: "center",
              borderBottom: "1px solid",
              borderColor: "divider",
              opacity: row.plan.isActive ? 1 : 0.6,
              "&:last-of-type": { borderBottom: "none" },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }} noWrap>
                {row.plan.name}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {row.plan.monthlyFeeMinor > 0
                  ? formatGHS(row.plan.monthlyFeeMinor)
                  : "Free"}{" "}
                monthly · {formatGHS(row.plan.yearlyFeeMinor)} yearly ·{" "}
                {row.plan.commissionBps / 100}% commission
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, textAlign: "right" }}>
              {row.activeTotal}
              <Typography
                component="span"
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                {" "}
                / {row.businessTotal}
              </Typography>
            </Typography>
            <Typography sx={{ fontWeight: 800, textAlign: "right" }}>
              {formatGHS(row.gmvMinor)}
            </Typography>
            <Typography sx={{ fontWeight: 800, textAlign: "right" }}>
              {formatGHS(row.commissionMinor)}
            </Typography>
          </Box>
        ))}
      </Panel>
      <PaginationFooter
        count={pageCount}
        label="package revenue rows"
        page={page}
        pageSize={8}
        total={planRows.length}
        onChange={onPageChange}
      />
    </>
  );
}
