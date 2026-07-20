import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { ADMIN_PAGE_SIZE } from "../shared/types";
import { PayoutStatusChip } from "./PayoutTable";
import type { AdminPayoutRow } from "../../lib/api";
import type { loader as payoutHistoryLoader } from "../../routes/payout-history";



// §11.5 payout history: every payout made to one store (amount, date, status),
// fetched on demand through the server-side proxy route — the admin token
// never reaches the browser. The API returns a page without a total count, so
// "has more" is inferred from a full page and PaginationFooter's total is a
// lower bound (documented on the footer copy by the surrounding note).
export function PayoutHistoryDrawer({
  payout,
  onClose,
}: {
  payout: AdminPayoutRow | null;
  onClose: () => void;
}) {
  const fetcher = useFetcher<typeof payoutHistoryLoader>();
  const [page, setPage] = useState(1);

  // Reload from page 1 whenever a different store is opened.
  useEffect(() => {
    setPage(1);
  }, [payout?.businessId]);

  useEffect(() => {
    if (payout) {
      fetcher.load(
        `/admin/payouts/${encodeURIComponent(payout.businessId)}/history?limit=${ADMIN_PAGE_SIZE}&offset=${(page - 1) * ADMIN_PAGE_SIZE}`,
      );
    }
    // fetcher identity is stable; re-key on store/page only.
  }, [payout?.businessId, page]);

  const history = fetcher.data?.ok ? fetcher.data.payouts : [];
  const hasMore = history.length === ADMIN_PAGE_SIZE;
  const lowerBoundTotal =
    (page - 1) * ADMIN_PAGE_SIZE + history.length + (hasMore ? 1 : 0);

  return (
    <Drawer
      anchor="right"
      open={Boolean(payout)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: "100%", sm: 460 },
            maxWidth: "100%",
            bgcolor: "background.default",
            p: { xs: 2, sm: 2.5 },
          },
        },
      }}
    >
      {payout ? (
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">{payout.businessName}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {payout.handle}.xtiitch.com · payout history
              </Typography>
            </Box>
            <Button size="small" onClick={onClose}>
              Close
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Amounts mirror Paystack (the source of truth) — use them to answer
            any “was I paid?” question against Paystack’s own records.
          </Typography>
          <Divider />
          {fetcher.state !== "idle" ? <LinearProgress /> : null}
          {fetcher.data && !fetcher.data.ok ? (
            <Alert severity="warning">{fetcher.data.error}</Alert>
          ) : null}
          {fetcher.data?.ok && history.length === 0 ? (
            <Typography sx={{ color: "text.secondary" }}>
              No payouts recorded yet for this store.
            </Typography>
          ) : null}
          {history.map((entry) => (
            <Stack
              key={entry.settlementId}
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>
                  {formatGHS(entry.amountMinor)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                >
                  {shortTime(entry.settledAt || entry.createdAt)} · ref{" "}
                  {entry.reference || "—"}
                </Typography>
              </Box>
              <PayoutStatusChip status={entry.status} />
            </Stack>
          ))}
          <PaginationFooter
            count={hasMore ? page + 1 : page}
            label="payouts"
            page={page}
            pageSize={ADMIN_PAGE_SIZE}
            total={lowerBoundTotal}
            onChange={setPage}
          />
        </Stack>
      ) : null}
    </Drawer>
  );
}
