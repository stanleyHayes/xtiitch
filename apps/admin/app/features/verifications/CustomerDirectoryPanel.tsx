import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TextField from "../../components/form-text-field";
import { AdminCustomer } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { CustomerStat } from "./CustomerStat";
import { CustomerTable } from "./CustomerTable";
import { CustomerInspector } from "./CustomerInspector";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function CustomerDirectoryPanel({
  customers,
  visibleCustomers,
  selectedCustomer,
  query,
  error,
  onQueryChange,
  onInspect,
  onCloseInspector,
}: {
  customers: AdminCustomer[];
  visibleCustomers: AdminCustomer[];
  selectedCustomer: AdminCustomer | null;
  query: string;
  error: string | null;
  onQueryChange: (value: string) => void;
  onInspect: (customer: AdminCustomer) => void;
  onCloseInspector: () => void;
}) {
  const multiBusinessCustomers = customers.filter(
    (customer) => customer.tenantCount > 1,
  ).length;
  const customOrderCustomers = customers.filter(
    (customer) => customer.customOrderCount > 0,
  ).length;
  const totalGMVMinor = customers.reduce(
    (sum, customer) => sum + customer.gmvMinor,
    0,
  );
  const {
    page: customerPage,
    pageCount: customerPageCount,
    pagedItems: pagedCustomers,
    setPage: setCustomerPage,
  } = usePagedItems(visibleCustomers, 10, query);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Customer operations"
        title="Customers"
        helper="Search client identities, cross-business relationships, custom-order volume, and payment activity."
      />
      {error ? <Alert severity="warning">{error}</Alert> : null}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <CustomerStat
          label="Customers"
          value={String(customers.length)}
          helper={`${visibleCustomers.length} in current view`}
        />
        <CustomerStat
          label="Multi-business"
          value={String(multiBusinessCustomers)}
          helper="Customers seen across tenants"
        />
        <CustomerStat
          label="Custom orders"
          value={String(customOrderCustomers)}
          helper="Customers with bespoke demand"
        />
        <CustomerStat
          label="Customer GMV"
          value={formatGHS(totalGMVMinor)}
          helper="Succeeded platform payments"
        />
      </Box>
      <Panel sx={{ p: 2 }}>
        <TextField
          label="Search customer"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
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
      {!error && visibleCustomers.length === 0 ? (
        <Panel sx={{ p: 3, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 800 }}>
            No customers match this view.
          </Typography>
          <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
            Clear the search to return to the full customer directory.
          </Typography>
        </Panel>
      ) : (
        <Stack spacing={1.5}>
          <CustomerTable
            customers={pagedCustomers}
            selectedId={selectedCustomer?.id ?? null}
            onInspect={onInspect}
          />
          <PaginationFooter
            count={customerPageCount}
            label="customers"
            page={customerPage}
            pageSize={10}
            total={visibleCustomers.length}
            onChange={setCustomerPage}
          />
        </Stack>
      )}
      <Drawer
        anchor="right"
        open={Boolean(selectedCustomer)}
        onClose={onCloseInspector}
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
        <CustomerInspector
          customer={selectedCustomer}
          onClose={onCloseInspector}
        />
      </Drawer>
    </Stack>
  );
}
