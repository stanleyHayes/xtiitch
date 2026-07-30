import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../components/form-text-field";
import {
  AdminEmptyState,
  PaginationFooter,
  Panel,
  SectionHeader,
} from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import type { AdminBusiness } from "../../lib/api";
import {
  AdminActionFeedback,
  StatusFilter,
  Section,
  statusFilters,
} from "../shared/types";
import { BusinessInspector } from "../verifications/BusinessInspector";
import { BusinessDirectoryItem } from "./BusinessDirectoryItem";

export function BusinessesSection({
  adminBusinesses,
  businessManagementError,
  actionData,
  onSelect,
}: {
  adminBusinesses: AdminBusiness[];
  businessManagementError: string | null;
  actionData?: AdminActionFeedback;
  onSelect: (section: Section) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const selectedId = searchParams.get("business");
  const selected =
    adminBusinesses.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      adminBusinesses.filter((business) => {
        const needle = query.trim().toLowerCase();
        const haystack = [
          business.name,
          business.handle,
          business.ownerEmail,
          business.ownerName,
          business.ownerPhone,
          business.ownerWhatsApp,
        ];
        return (
          (status === "all" || business.status === status) &&
          (!needle ||
            haystack.some((value) => value.toLowerCase().includes(needle)))
        );
      }),
    [adminBusinesses, query, status],
  );
  const { page, pageCount, pagedItems, setPage } = usePagedItems(
    filtered,
    10,
    `${query}:${status}`,
  );
  const clearSelected = () =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("business");
      return next;
    });

  if (selected) {
    return (
      <BusinessInspector
        business={selected}
        onReviewPayments={() => onSelect("money")}
        onOpenAudit={() => onSelect("audit")}
        onClose={clearSelected}
      />
    );
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Businesses & money"
        title="Business directory"
        helper="A compact operating view of every tenant. Open a business for its complete record, owner contacts, and admin-safe actions."
      />
      {actionData?.section === "businesses" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {businessManagementError ? (
        <Alert severity="warning">{businessManagementError}</Alert>
      ) : null}
      <Panel sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Search business"
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
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            sx={{ minWidth: { md: 220 } }}
          >
            {statusFilters.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Panel>
      <Panel sx={{ overflow: "hidden", p: 0 }}>
        {pagedItems.map((business, index) => (
          <BusinessDirectoryItem
            key={business.id}
            business={business}
            isLast={index === pagedItems.length - 1}
            onOpen={() =>
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("business", business.id);
                return next;
              })
            }
          />
        ))}
        {filtered.length === 0 ? (
          <AdminEmptyState
            compact
            icon={<StorefrontRounded />}
            eyebrow="Business directory"
            title="No businesses found"
            helper="Clear the search or select another status to widen the directory."
          />
        ) : null}
      </Panel>
      <PaginationFooter
        count={pageCount}
        label="businesses"
        page={page}
        pageSize={10}
        total={filtered.length}
        onChange={setPage}
      />
    </Stack>
  );
}
