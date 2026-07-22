import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../components/form-text-field";
import { AdminEmptyState, PaginationFooter, Panel, SectionHeader } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import type { AdminBusiness } from "../../lib/api";
import { AdminActionFeedback, StatusFilter, Section, statusFilters } from "../shared/types";
import { BusinessInspector } from "../verifications/BusinessInspector";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { tokens } from "../../theme";

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
  const selected = adminBusinesses.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => adminBusinesses.filter((business) => {
    const needle = query.trim().toLowerCase();
    return (status === "all" || business.status === status) && (!needle || [business.name, business.handle, business.ownerEmail].some((value) => value.toLowerCase().includes(needle)));
  }), [adminBusinesses, query, status]);
  const { page, pageCount, pagedItems, setPage } = usePagedItems(filtered, 10, `${query}:${status}`);
  const clearSelected = () => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("business"); return next; });

  if (selected) {
    return <BusinessInspector business={selected} onReviewPayments={() => onSelect("money")} onOpenAudit={() => onSelect("audit")} onClose={clearSelected} />;
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader eyebrow="Businesses & money" title="Business directory" helper="A compact operating view of every tenant. Open a business for its complete record and admin-safe actions." />
      {actionData?.section === "businesses" && actionData.message ? <Alert severity={actionData.severity ?? "success"}>{actionData.message}</Alert> : null}
      {businessManagementError ? <Alert severity="warning">{businessManagementError}</Alert> : null}
      <Panel sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        <TextField label="Search business" value={query} onChange={(event) => setQuery(event.target.value)} fullWidth slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
        <TextField select label="Status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} sx={{ minWidth: { md: 220 } }}>{statusFilters.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField>
      </Stack></Panel>
      <Panel sx={{ overflow: "hidden" }}>
        {pagedItems.map((business, index) => (
          <Box key={business.id} component="button" type="button" onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("business", business.id); return next; })}
            sx={{ width: "100%", p: { xs: 2, md: 2.25 }, display: "grid", gridTemplateColumns: { xs: "auto minmax(0, 1fr) auto", md: "auto minmax(230px, 1.2fr) minmax(180px, .8fr) minmax(160px, .7fr) auto" }, gap: 1.5, alignItems: "center", border: 0, borderBottom: index === pagedItems.length - 1 ? 0 : "1px solid", borderColor: "divider", bgcolor: "transparent", color: "text.primary", textAlign: "left", cursor: "pointer", font: "inherit", "&:hover": { bgcolor: alpha(tokens.burgundy, .045) } }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: alpha(tokens.burgundy, .09), color: tokens.burgundy }}><StorefrontRounded /></Box>
            <Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={.75} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 900 }}>{business.name}</Typography><StatusChip status={business.status} /><RiskChip level={business.riskLevel} /></Stack><Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{business.handle}.xtiitch.com · {business.ownerEmail}</Typography></Box>
            <Box sx={{ display: { xs: "none", md: "block" } }}><Typography variant="caption" sx={{ color: "text.secondary" }}>Gross volume</Typography><Typography sx={{ fontWeight: 900 }}>{formatGHS(business.gmvMinor)}</Typography></Box>
            <Box sx={{ display: { xs: "none", md: "block" } }}><Typography variant="caption" sx={{ color: "text.secondary" }}>Last active</Typography><Typography variant="body2" sx={{ fontWeight: 800 }}>{shortTime(business.lastActive)}</Typography></Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Chip size="small" label={business.plan} variant="outlined" sx={{ display: { xs: "none", sm: "flex" } }} /><ArrowForwardRounded sx={{ color: tokens.burgundy }} /></Stack>
          </Box>
        ))}
        {filtered.length === 0 ? <AdminEmptyState compact icon={<StorefrontRounded />} eyebrow="Business directory" title="No businesses found" helper="Clear the search or select another status to widen the directory." /> : null}
      </Panel>
      <PaginationFooter count={pageCount} label="businesses" page={page} pageSize={10} total={filtered.length} onChange={setPage} />
    </Stack>
  );
}
