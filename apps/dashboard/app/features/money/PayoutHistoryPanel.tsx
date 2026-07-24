import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import type { MoneyPayout } from "../shared/types";
import { shortDateTime } from "../shared/utils";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { PaginationFooter } from "../../components/ui/PaginationFooter";

// Paystack settlement statuses → a tone the owner can scan. Unknown statuses
// stay neutral rather than reading as a failure.
function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "settled") {
    return tokens.success;
  }
  if (normalized === "failed" || normalized === "reversed") {
    return "#b3261e";
  }
  if (normalized === "pending" || normalized === "processing") {
    return tokens.warning;
  }
  return tokens.info;
}

function statusLabel(status: string): string {
  if (!status) {
    return "Unknown";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// §3.3 payout history: every payout the moment Paystack makes it (automatic
// T+1 cycle, §4.10), plus the current unpaid online amount as a pending row.
// This stays all-time even when the Money Desk cards are filtered.
export function PayoutHistoryPanel({ payouts }: { payouts: MoneyPayout[] }) {
  const { page, pageCount, pagedItems, setPage } = usePagedItems(
    payouts,
    8,
    payouts.length,
  );

  return (
    <Panel id="payout-history">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <AccountBalanceRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Payout history</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Pending and paid Paystack payouts to your MoMo number.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${payouts.length} records`}
            tone={tokens.success}
          />
        </Stack>
      </Box>

      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        {payouts.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <InlineEmptyState
              icon={<AccountBalanceRounded sx={{ fontSize: 38 }} />}
              title="No payouts yet"
              helper="Pending payouts appear here once online sales clear; paid payouts update from Paystack settlements."
            />
          </Box>
        ) : (
          <>
            {/* Column headings, desktop only — on phones each row stacks the
                same four facts with the amount up front. */}
            <Box
              sx={{
                display: { xs: "none", md: "grid" },
                px: 2.5,
                py: 1,
                gap: 1,
                gridTemplateColumns:
                  "minmax(0, 1.1fr) minmax(0, 1.4fr) minmax(0, 0.8fr) auto",
                alignItems: "center",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                Date
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                Reference
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 900 }}>
                Amount
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 900, textAlign: "right" }}
              >
                Status
              </Typography>
            </Box>
            {pagedItems.map((payout) => (
              <Box
                key={payout.settlement_id}
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.4,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "grid",
                  gap: { xs: 0.5, md: 1 },
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr) auto",
                    md: "minmax(0, 1.1fr) minmax(0, 1.4fr) minmax(0, 0.8fr) auto",
                  },
                  alignItems: "center",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {shortDateTime(payout.settled_at || payout.created_at)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      display: { xs: "block", md: "none" },
                    }}
                    noWrap
                  >
                    {payout.reference || "—"}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    display: { xs: "none", md: "block" },
                  }}
                  noWrap
                >
                  {payout.reference || "—"}
                </Typography>
                <Typography sx={{ fontWeight: 900 }} noWrap>
                  {formatGHS(payout.amount_minor)}
                </Typography>
                <Box
                  sx={{
                    justifySelf: "end",
                    gridColumn: { xs: "2", md: "auto" },
                    gridRow: { xs: "1", md: "auto" },
                  }}
                >
                  <ToneChip
                    label={statusLabel(payout.status)}
                    tone={statusTone(payout.status)}
                  />
                </Box>
              </Box>
            ))}
            <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
              <PaginationFooter
                count={pageCount}
                label="payouts"
                page={page}
                pageSize={8}
                total={payouts.length}
                onChange={setPage}
              />
            </Box>
          </>
        )}
      </Box>
    </Panel>
  );
}
