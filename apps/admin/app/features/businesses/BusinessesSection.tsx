import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ViewListRounded from "@mui/icons-material/ViewListRounded";
import GridViewRounded from "@mui/icons-material/GridViewRounded";
import TextField from "../../components/form-text-field";
import { Panel, SectionHeader, PaginationFooter } from "../../components/ui";
import { usePagedItems } from "../shared/usePagedItems";
import type { AdminBusiness } from "../../lib/api";
import {
  AdminActionFeedback,
  StatusFilter,
  Section,
  statusFilters,
} from "../shared/types";
import { BusinessRow } from "../verifications/BusinessRow";
import { BusinessInspector } from "../verifications/BusinessInspector";
import { BusinessTable } from "./BusinessTable";

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
  const [businessQuery, setBusinessQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [businessView, setBusinessView] = useState<"list" | "card">("list");
  const [selectedBusiness, setSelectedBusiness] =
    useState<AdminBusiness | null>(null);

  const filteredBusinesses = useMemo(() => {
    const query = businessQuery.trim().toLowerCase();
    return adminBusinesses.filter((business) => {
      const matchesStatus =
        statusFilter === "all" || business.status === statusFilter;
      const matchesQuery =
        !query ||
        business.name.toLowerCase().includes(query) ||
        business.handle.toLowerCase().includes(query) ||
        business.ownerEmail.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [adminBusinesses, businessQuery, statusFilter]);

  const businessPageSize = businessView === "card" ? 6 : 10;
  const {
    page: businessPage,
    pageCount: businessPageCount,
    pagedItems: pagedBusinesses,
    setPage: setBusinessPage,
  } = usePagedItems(
    filteredBusinesses,
    businessPageSize,
    `${businessQuery}:${statusFilter}:${businessView}`,
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Tenant operations"
        title="Businesses"
        helper="Search stores, monitor GMV and commission, and suspend risky tenants without touching customer data."
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
            value={businessQuery}
            onChange={(event) => setBusinessQuery(event.target.value)}
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
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            sx={{ minWidth: { md: 220 } }}
          >
            {statusFilters.map((filter) => (
              <MenuItem key={filter.value} value={filter.value}>
                {filter.label}
              </MenuItem>
            ))}
          </TextField>
          <ToggleButtonGroup
            exclusive
            value={businessView}
            onChange={(_event, next) => {
              if (next) setBusinessView(next as "list" | "card");
            }}
            aria-label="Business view"
            sx={{
              alignSelf: { xs: "stretch", md: "center" },
              "& .MuiToggleButton-root": {
                px: 1.5,
                border: "1px solid",
                borderColor: "divider",
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "primary.main",
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                },
              },
            }}
          >
            <ToggleButton value="list" aria-label="List view">
              <ViewListRounded fontSize="small" />
            </ToggleButton>
            <ToggleButton value="card" aria-label="Card view">
              <GridViewRounded fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Panel>
      {filteredBusinesses.length === 0 ? (
        <Panel sx={{ p: 3, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 800 }}>
            No businesses match this view.
          </Typography>
          <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
            Clear the search or choose another status.
          </Typography>
        </Panel>
      ) : businessView === "card" ? (
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            alignContent: "start",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          {pagedBusinesses.map((business) => (
            <BusinessRow
              key={business.id}
              business={business}
              selected={selectedBusiness?.id === business.id}
              onInspect={setSelectedBusiness}
              compact
            />
          ))}
        </Box>
      ) : (
        <BusinessTable
          businesses={pagedBusinesses}
          selectedId={selectedBusiness?.id ?? null}
          onInspect={setSelectedBusiness}
        />
      )}
      <PaginationFooter
        count={businessPageCount}
        label="businesses"
        page={businessPage}
        pageSize={businessPageSize}
        total={filteredBusinesses.length}
        onChange={setBusinessPage}
      />
      <Drawer
        anchor="right"
        open={Boolean(selectedBusiness)}
        onClose={() => setSelectedBusiness(null)}
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
        <BusinessInspector
          business={selectedBusiness}
          onReviewPayments={() => {
            onSelect("money");
            setSelectedBusiness(null);
          }}
          onOpenAudit={() => {
            onSelect("audit");
            setSelectedBusiness(null);
          }}
          onClose={() => setSelectedBusiness(null)}
        />
      </Drawer>
    </Stack>
  );
}
