import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TextField from "../../components/form-text-field";
import { PaginationFooter, Panel, SectionHeader } from "../../components/ui";
import { ADMIN_PAGE_SIZE } from "../shared/types";
import { PayoutTable } from "./PayoutTable";
import { PayoutHistoryDrawer } from "./PayoutHistoryDrawer";
import type { AdminPayoutRow } from "../../lib/api";
import type { loader as payoutsLoader } from "../../routes/payouts";

function payoutsUrl(query: string, page: number): string {
  const params = new URLSearchParams({
    limit: String(ADMIN_PAGE_SIZE),
    offset: String((page - 1) * ADMIN_PAGE_SIZE),
  });
  if (query.trim()) {
    params.set("query", query.trim());
  }
  return `/admin/payouts?${params.toString()}`;
}

// The loading / error / empty / table region, kept separate so the section
// body stays readable (and inside the complexity budget).
function PayoutsResults({
  fetcher,
  query,
  payouts,
  selectedId,
  onInspect,
}: {
  fetcher: ReturnType<typeof useFetcher<typeof payoutsLoader>>;
  query: string;
  payouts: AdminPayoutRow[];
  selectedId: string | null;
  onInspect: (payout: AdminPayoutRow) => void;
}) {
  if (fetcher.data && !fetcher.data.ok) {
    return <Alert severity="warning">{fetcher.data.error}</Alert>;
  }
  if (fetcher.data === undefined) {
    // First load — the progress bar above already signals work in flight.
    return null;
  }
  if (payouts.length === 0) {
    return (
      <Panel sx={{ p: 3, textAlign: "center" }}>
        <Typography sx={{ fontWeight: 800 }}>
          No payout records match this view.
        </Typography>
        <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
          {query.trim()
            ? "Try another business or owner name."
            : "Stores appear here once their payout details are on file."}
        </Typography>
      </Panel>
    );
  }
  return (
    <PayoutTable
      payouts={payouts}
      selectedId={selectedId}
      onInspect={onInspect}
    />
  );
}

// §11.5 Payouts CRM: one searchable row per store, figures mirrored from
// Paystack (the source of truth) by the API. Search + pagination are
// server-side through the /admin/payouts resource route, so the table stays
// accurate as the tenant count grows; the admin token never reaches the
// browser. The API returns a page without a total, so "has more" is inferred
// from a full page and the footer total is a lower bound.
export function PayoutsSection() {
  const fetcher = useFetcher<typeof payoutsLoader>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminPayoutRow | null>(null);

  // Debounce the search so each keystroke does not hit the API; a changed
  // query restarts at page 1.
  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetcher.load(payoutsUrl(query, page));
    // fetcher identity is stable; re-key on query/page only.
  }, [query, page]);

  const payouts = fetcher.data?.ok ? fetcher.data.payouts : [];
  const hasMore = payouts.length === ADMIN_PAGE_SIZE;
  const lowerBoundTotal =
    (page - 1) * ADMIN_PAGE_SIZE + payouts.length + (hasMore ? 1 : 0);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Operations"
        title="Payouts"
        helper="Every store owner's payout record — MoMo destination, subaccount, sales, fees, and amount due. Figures mirror Paystack (the source of truth), never local calculations."
      />
      <Panel sx={{ p: 2 }}>
        <TextField
          label="Search business or owner"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded />
                </InputAdornment>
              ),
            },
          }}
        />
      </Panel>
      {fetcher.state !== "idle" ? <LinearProgress /> : null}
      <PayoutsResults
        fetcher={fetcher}
        query={query}
        payouts={payouts}
        selectedId={selected?.businessId ?? null}
        onInspect={setSelected}
      />
      <PaginationFooter
        count={hasMore ? page + 1 : page}
        label="stores"
        page={page}
        pageSize={ADMIN_PAGE_SIZE}
        total={lowerBoundTotal}
        onChange={setPage}
      />
      <PayoutHistoryDrawer
        payout={selected}
        onClose={() => setSelected(null)}
      />
    </Stack>
  );
}
