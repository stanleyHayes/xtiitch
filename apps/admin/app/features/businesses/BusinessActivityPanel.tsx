import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
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
function categoryColor(category: AdminBusinessActivityCategory): string {
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
          label={event.category}
          sx={{
            bgcolor: alpha(color, 0.12),
            color,
            border: "1px solid",
            borderColor: alpha(color, 0.24),
            textTransform: "capitalize",
          }}
        />
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {shortTime(event.occurredAt)}
        </Typography>
      </Stack>
      <Typography variant="body2">{event.summary}</Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {event.actor || "system"}
        </Typography>
        {typeof event.amountMinor === "number" ? (
          <Typography variant="caption" sx={{ fontWeight: 800 }}>
            {formatGHS(event.amountMinor)}
          </Typography>
        ) : null}
      </Stack>
    </Stack>
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
    // fetcher identity is stable; re-key on business/filter/page only.
  }, [businessId, typeFilter, page]);

  const events = fetcher.data?.ok ? fetcher.data.activity : [];
  const hasMore = events.length === ADMIN_PAGE_SIZE;
  const lowerBoundTotal =
    (page - 1) * ADMIN_PAGE_SIZE + events.length + (hasMore ? 1 : 0);

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
            onClick={() => {
              setTypeFilter(filter.value);
              setPage(1);
            }}
          />
        ))}
      </Stack>
      {fetcher.state !== "idle" ? <LinearProgress /> : null}
      {fetcher.data && !fetcher.data.ok ? (
        <Alert severity="warning">{fetcher.data.error}</Alert>
      ) : null}
      {fetcher.data?.ok && events.length === 0 ? (
        <Box sx={{ py: 2, textAlign: "center" }}>
          <Typography sx={{ color: "text.secondary" }}>
            No activity recorded yet.
          </Typography>
        </Box>
      ) : null}
      {events.map((event, index) => (
        <Box
          key={`${event.refId}:${event.occurredAt}:${index}`}
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
        onChange={setPage}
      />
    </Stack>
  );
}
