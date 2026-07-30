import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import SearchOffRounded from "@mui/icons-material/SearchOffRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../shared/formatting";
import { shortTimeOrFallback } from "../shared/dates";
import { AdminEmptyState } from "../../components/ui/AdminEmptyState";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { ADMIN_PAGE_SIZE } from "../shared/types";
import type {
  AdminBusinessActivityCategory,
  AdminBusinessActivityEvent,
} from "../../lib/api";
import type { loader as businessActivityLoader } from "../../routes/business-activity";

const CATEGORY_FILTERS: readonly {
  value: AdminBusinessActivityCategory | "all";
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "billing", label: "Billing" },
  { value: "payouts", label: "Payouts" },
  { value: "verification", label: "Verification" },
  { value: "admin", label: "Admin" },
  { value: "takings", label: "Takings" },
];

// One stable colour per category so an operator learns the feed's vocabulary:
// money-in greens, money-out ambers, identity purples, platform actions reds.
function categoryColor(category: string): string {
  switch (category) {
    case "orders":
      return tokens.info;
    case "payments":
    case "takings":
      return tokens.success;
    case "billing":
      return tokens.burgundy;
    case "payouts":
      return tokens.warning;
    case "verification":
      return tokens.info;
    case "admin":
      return tokens.danger;
    default:
      return tokens.mutedText;
  }
}

function ActivityFeedSkeleton() {
  return (
    <Stack spacing={1.25} aria-busy="true" aria-label="Loading activity">
      {[0, 1, 2, 3].map((key) => (
        <Box
          key={key}
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.08),
            borderRadius: 1.5,
            bgcolor: "rgba(var(--surface-rgb), 0.62)",
          }}
        >
          <Stack spacing={1}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <Skeleton variant="rounded" width={88} height={24} />
              <Skeleton variant="text" width={96} height={18} />
            </Stack>
            <Skeleton variant="text" width="78%" height={20} />
            <Skeleton variant="text" width="42%" height={16} />
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function ActivityRow({ event }: { event: AdminBusinessActivityEvent }) {
  const color = categoryColor(event.category);
  return (
    <Stack spacing={0.5}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Chip
          size="small"
          label={event.category || "activity"}
          sx={{
            bgcolor: alpha(color, 0.12),
            color,
            border: "1px solid",
            borderColor: alpha(color, 0.24),
            textTransform: "capitalize",
          }}
        />
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {shortTimeOrFallback(event.occurredAt, "Unknown time")}
        </Typography>
      </Stack>
      <Typography variant="body2">
        {event.summary || "Activity recorded"}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {event.actor || "system"}
        </Typography>
        {typeof event.amountMinor === "number" &&
        Number.isFinite(event.amountMinor) ? (
          <Typography variant="caption" sx={{ fontWeight: 800 }}>
            {formatGHS(event.amountMinor)}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}

function normalizeActivityEvents(
  events: AdminBusinessActivityEvent[] | null | undefined,
): AdminBusinessActivityEvent[] {
  if (!Array.isArray(events)) {
    return [];
  }
  return events.filter((event) => {
    if (!event || typeof event !== "object") {
      return false;
    }
    return Boolean(
      event.summary || event.eventType || event.refId || event.occurredAt,
    );
  });
}

function ActivityEmptyState({
  typeFilter,
}: {
  typeFilter: AdminBusinessActivityCategory | "all";
}) {
  if (typeFilter === "all") {
    return (
      <AdminEmptyState
        compact
        icon={<HistoryRounded />}
        eyebrow="Activity feed"
        title="No activity recorded yet"
        helper="Orders, payments, billing, payouts, verification, admin actions, and takings will appear here as they happen for this store — including unverified tenants."
      />
    );
  }
  return (
    <AdminEmptyState
      compact
      icon={<SearchOffRounded />}
      eyebrow="No matches"
      title="No activity in this category"
      helper="Nothing matches the selected filter yet. Choose All or another category to widen the feed."
    />
  );
}

function ActivityFeedResults({
  events,
  typeFilter,
  error,
  page,
  onPageChange,
}: {
  events: AdminBusinessActivityEvent[];
  typeFilter: AdminBusinessActivityCategory | "all";
  error: string | null;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const hasMore = events.length === ADMIN_PAGE_SIZE;
  const lowerBoundTotal =
    (page - 1) * ADMIN_PAGE_SIZE + events.length + (hasMore ? 1 : 0);

  if (error) {
    return <Alert severity="warning">{error}</Alert>;
  }
  return (
    <>
      {events.length === 0 ? <ActivityEmptyState typeFilter={typeFilter} /> : null}
      {events.map((event, index) => (
        <Box
          key={`${event.refId || "event"}:${event.occurredAt || index}:${index}`}
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.08),
            borderRadius: 1.5,
            bgcolor: "rgba(var(--surface-rgb), 0.62)",
          }}
        >
          <ActivityRow event={event} />
        </Box>
      ))}
      <PaginationFooter
        count={hasMore ? page + 1 : page}
        label="activity events"
        page={page}
        pageSize={ADMIN_PAGE_SIZE}
        total={lowerBoundTotal}
        onChange={onPageChange}
      />
    </>
  );
}

// §11.3: the unified per-business activity feed (orders, payments, billing,
// payouts, verification, admin, takings), newest first, fetched on demand
// through the server-side proxy route. The API returns a page without a
// total, so "has more" is inferred from a full page and the footer total is a
// lower bound.
export function BusinessActivityPanel({ businessId }: { businessId: string }) {
  const fetcher = useFetcher<typeof businessActivityLoader>();
  const [typeFilter, setTypeFilter] = useState<
    AdminBusinessActivityCategory | "all"
  >("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!businessId) {
      return;
    }
    const params = new URLSearchParams({
      limit: String(ADMIN_PAGE_SIZE),
      offset: String((page - 1) * ADMIN_PAGE_SIZE),
    });
    if (typeFilter !== "all") {
      params.set("type", typeFilter);
    }
    fetcher.load(
      `/admin/businesses/${encodeURIComponent(businessId)}/activity?${params.toString()}`,
    );
    // fetcher identity is stable; remount via key={businessId} resets filter/page.
  }, [businessId, typeFilter, page]);

  const hasSettled = fetcher.data !== undefined;
  const isLoading = fetcher.state !== "idle" || !hasSettled;
  const error =
    fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const events = normalizeActivityEvents(
    fetcher.data?.ok ? fetcher.data.activity : [],
  );

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
        {CATEGORY_FILTERS.map((filter) => (
          <Chip
            key={filter.value}
            size="small"
            label={filter.label}
            variant={typeFilter === filter.value ? "filled" : "outlined"}
            color={typeFilter === filter.value ? "primary" : "default"}
            disabled={isLoading}
            onClick={() => {
              setTypeFilter(filter.value);
              setPage(1);
            }}
          />
        ))}
      </Stack>
      {isLoading ? (
        <ActivityFeedSkeleton />
      ) : (
        <ActivityFeedResults
          events={events}
          typeFilter={typeFilter}
          error={error}
          page={page}
          onPageChange={setPage}
        />
      )}
    </Stack>
  );
}
