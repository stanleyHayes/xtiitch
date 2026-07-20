import { Form, useSearchParams } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ContactPhoneRounded from "@mui/icons-material/ContactPhoneRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import {
  EXPORT_FORMAT_LABELS,
  exportFormats,
} from "../../lib/entitlements";
import { DASHBOARD_PAGE_SIZE } from "../shared/constants";
import { shortDate } from "../shared/utils";
import TextField from "../../components/form-text-field";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import type { Profile } from "../shared/types";
import type { CrmCustomerRow, CrmData, CrmQuery } from "./types";

// §15.1 customer list — on EVERY plan: name, phone, source. Spend & order
// counts ladder in at Starter (the API nulls them at Free, so a lock hint
// shows instead of fake zeros — the deliberate §15 ladder). Search submits
// GET at Starter+; the Growth filter row (tag / segment / min spend / last
// order) rides the same GET navigation. Export links go through the
// report-download resource route with exactly the plan's export_* formats.
export function CustomerListPanel({
  profile,
  level,
  data,
  onOpenCustomer,
}: {
  profile: Profile;
  level: number;
  data: CrmData;
  onOpenCustomer: (customer: CrmCustomerRow) => void;
}) {
  const { list, query } = data;
  const formats = exportFormats(profile.entitlements);
  const [, setSearchParams] = useSearchParams();
  const pageCount = Math.max(1, Math.ceil(list.total / DASHBOARD_PAGE_SIZE));
  // Tags seen in the current page feed the tag filter's suggestions.
  const knownTags = [
    ...new Set(list.customers.flatMap((customer) => customer.tags ?? [])),
  ];

  return (
    <Panel id="crm-list">
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
              <ContactPhoneRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Customers</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Every customer who orders is added automatically — {list.total}{" "}
                so far.
              </Typography>
            </Box>
          </Stack>
          {formats.length > 0 ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {formats.map((format) => (
                <Button
                  key={format}
                  component="a"
                  href={`/report-download?report=customers&format=${format}`}
                  download
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadRounded />}
                >
                  {EXPORT_FORMAT_LABELS[format]}
                </Button>
              ))}
            </Stack>
          ) : (
            // §15.1: customer-list export starts at Growth.
            <ToneChip
              icon={<LockRounded sx={{ fontSize: 14 }} />}
              label="List export starts at Growth"
              tone={tokens.gold}
            />
          )}
        </Stack>

        <FilterBar level={level} query={query} knownTags={knownTags} />

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {list.customers.length === 0 ? (
            <InlineEmptyState
              icon={<ContactPhoneRounded sx={{ fontSize: 38 }} />}
              title={query.q || query.tag || query.segment ? "No matches" : "No customers yet"}
              helper={
                query.q || query.tag || query.segment
                  ? "Try a different search or clear the filters."
                  : "Your list builds itself: every customer who orders from your store appears here."
              }
            />
          ) : (
            list.customers.map((customer) => (
              <CustomerRow
                key={customer.customer_id}
                customer={customer}
                level={level}
                onOpen={() => onOpenCustomer(customer)}
              />
            ))
          )}
        </Stack>

        {list.total > DASHBOARD_PAGE_SIZE ? (
          <Stack sx={{ mt: 2, alignItems: "center" }}>
            <Pagination
              count={pageCount}
              page={Math.min(query.page, pageCount)}
              onChange={(_event, nextPage) =>
                setSearchParams((current) => {
                  current.set("page", String(nextPage));
                  return current;
                })
              }
              color="primary"
              size="small"
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {list.total} customers
            </Typography>
          </Stack>
        ) : null}
      </Box>
    </Panel>
  );
}

function CustomerRow({
  customer,
  level,
  onOpen,
}: {
  customer: CrmCustomerRow;
  level: number;
  onOpen: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      sx={{
        p: 1.5,
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(theme.palette.common.white, 0.03)
            : alpha(theme.palette.common.black, 0.015),
        "&:hover": { borderColor: alpha(tokens.burgundy, 0.35) },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", minWidth: 0 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 900 }} noWrap>
            {customer.name || customer.phone}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {customer.phone}
            {customer.last_order_at
              ? ` · last order ${shortDate(customer.last_order_at)}`
              : ""}
          </Typography>
        </Box>
        <ToneChip
          label={customer.source === "walk_in" ? "Walk-in" : "Online"}
          tone={customer.source === "walk_in" ? tokens.gold : tokens.info}
        />
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 0.75, alignItems: "center", flexWrap: "wrap" }}
      >
        {customer.total_spend_minor !== null ? (
          <Typography variant="caption" sx={{ fontWeight: 900 }}>
            {formatGHS(customer.total_spend_minor)} ·{" "}
            {customer.orders_count ?? 0}{" "}
            {(customer.orders_count ?? 0) === 1 ? "order" : "orders"}
          </Typography>
        ) : level === 0 ? (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontStyle: "italic" }}
          >
            Spend &amp; order counts on Starter
          </Typography>
        ) : null}
        {(customer.tags ?? []).map((tag) => (
          <ToneChip key={tag} label={tag} tone={tokens.burgundy} />
        ))}
      </Stack>
    </Box>
  );
}

// §15.1 search (Starter+) and the filter row (Growth+): tag, segment,
// min spend and last-order date. All ride one GET navigation so the URL stays
// shareable; Free sees the ladder hint instead (§15.2 "a clear reason").
function FilterBar({
  level,
  query,
  knownTags,
}: {
  level: number;
  query: CrmQuery;
  knownTags: string[];
}) {
  if (level < 1) {
    return (
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Search, spend &amp; order counts start on Starter; tags, filters and
          export on Growth.{" "}
          <Button
            component="a"
            href="/onboarding/billing"
            size="small"
            sx={{ ml: 0.5 }}
          >
            See plans
          </Button>
        </Typography>
      </Box>
    );
  }
  return (
    <>
      <Stack
        component={Form}
        method="get"
        action="/dashboard/customers"
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        sx={{ mt: 2 }}
      >
        <TextField
          name="q"
          label="Search"
          size="small"
          fullWidth
          defaultValue={query.q}
          placeholder="Name or phone"
        />
        {level >= 2 ? (
          <>
            <TextField
              select
              name="segment"
              label="Segment"
              size="small"
              fullWidth
              defaultValue={query.segment}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="returning">Returning</MenuItem>
              <MenuItem value="lapsed">Lapsed (90+ days)</MenuItem>
            </TextField>
            <TextField
              name="tag"
              label="Tag"
              size="small"
              fullWidth
              defaultValue={query.tag}
              slotProps={{ htmlInput: { list: "crm-tag-options" } }}
            />
            <TextField
              name="min_spend"
              label="Min spend (GHS)"
              size="small"
              fullWidth
              defaultValue={query.minSpendGhs}
              inputMode="decimal"
            />
            <TextField
              name="last_order_before"
              label="Last order before"
              type="date"
              size="small"
              fullWidth
              defaultValue={query.lastOrderBefore}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        ) : null}
        <Button
          type="submit"
          variant="contained"
          startIcon={<SearchRounded />}
          sx={{ flexShrink: 0 }}
        >
          Search
        </Button>
      </Stack>
      <datalist id="crm-tag-options">
        {knownTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </>
  );
}
