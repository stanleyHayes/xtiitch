import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SavingsRounded from "@mui/icons-material/SavingsRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { shortDate } from "../shared/utils";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import type { OutstandingBalanceRow } from "./types";

// §14.1 "Outstanding deposits & balances (bespoke owed)" — Starter+. This is
// the money customers still owe on bespoke work: agreed total, what has
// settled, and the outstanding remainder per order.
export function BalancesPanel({
  balances,
  totalOutstandingMinor,
}: {
  balances: OutstandingBalanceRow[];
  totalOutstandingMinor: number;
}) {
  return (
    <Panel id="analytics-balances">
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
              <SavingsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
                Outstanding deposits &amp; balances
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                What customers still owe on confirmed work.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${formatGHS(totalOutstandingMinor)} outstanding`}
            tone={totalOutstandingMinor > 0 ? tokens.warning : tokens.success}
          />
        </Stack>

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {balances.length === 0 ? (
            <InlineEmptyState
              icon={<SavingsRounded sx={{ fontSize: 38 }} />}
              title="Nothing outstanding"
              helper="When a bespoke order is part-paid, the balance owed tracks here."
            />
          ) : (
            balances.map((balance) => {
              const settledShare =
                balance.agreed_total_minor > 0
                  ? balance.settled_minor / balance.agreed_total_minor
                  : 0;
              return (
                <Box
                  key={balance.order_id}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.common.white, 0.03)
                        : alpha(theme.palette.common.black, 0.015),
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "baseline", minWidth: 0 }}
                  >
                    <Typography
                      sx={{ fontWeight: 900, minWidth: 0, flex: 1 }}
                      noWrap
                      title={balance.customer_name}
                    >
                      {balance.customer_name}
                    </Typography>
                    <Typography
                      sx={{ fontWeight: 900, flexShrink: 0, color: tokens.warning }}
                    >
                      {formatGHS(balance.outstanding_minor)} owed
                    </Typography>
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block", mt: 0.25 }}
                  >
                    {balance.design_title} · {balance.status} · since{" "}
                    {shortDate(balance.created_at)}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mt: 0.75 }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 999,
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark"
                            ? alpha(theme.palette.common.white, 0.08)
                            : alpha(theme.palette.common.black, 0.08),
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${Math.round(Math.min(1, settledShare) * 100)}%`,
                          height: "100%",
                          bgcolor: tokens.success,
                          borderRadius: 999,
                        }}
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", flexShrink: 0 }}
                    >
                      {formatGHS(balance.settled_minor)} of{" "}
                      {formatGHS(balance.agreed_total_minor)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })
          )}
        </Stack>
      </Box>
    </Panel>
  );
}
