import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TextField from "../../../components/form-text-field";
import type { AdminPlan } from "../../shared/types";
import {
  subscriptionBillingModeOptions,
  subscriptionStatusOptions,
} from "../utils";

export function SubscriptionFilters({
  query,
  planFilter,
  statusFilter,
  institutionFilter,
  billingModeFilter,
  cadenceFilter,
  onQueryChange,
  onPlanFilterChange,
  onStatusFilterChange,
  onInstitutionFilterChange,
  onBillingModeFilterChange,
  onCadenceFilterChange,
  plans,
  institutionOptions,
}: {
  query: string;
  planFilter: string;
  statusFilter: string;
  institutionFilter: string;
  billingModeFilter: string;
  // How often the subscription RENEWS (quarterly/yearly). Required by the CRM
  // spec (Pricing Book §6.2) and distinct from billing MODE, which is how it is
  // collected — the two used to be conflated under one control.
  cadenceFilter: string;
  onQueryChange: (value: string) => void;
  onPlanFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onInstitutionFilterChange: (value: string) => void;
  onBillingModeFilterChange: (value: string) => void;
  onCadenceFilterChange: (value: string) => void;
  plans: AdminPlan[];
  institutionOptions: string[];
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(220px, 1.4fr) repeat(4, minmax(140px, 0.8fr))",
        },
        alignItems: "center",
      }}
    >
      <TextField
        label="Search subscribers"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        size="small"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        select
        label="Plan"
        value={planFilter}
        onChange={(event) => onPlanFilterChange(event.target.value)}
        size="small"
      >
        <MenuItem value="all">All plans</MenuItem>
        {plans.map((plan) => (
          <MenuItem key={plan.planId} value={plan.code}>
            {plan.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Status"
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.target.value)}
        size="small"
      >
        <MenuItem value="all">All statuses</MenuItem>
        {subscriptionStatusOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Institution"
        value={institutionFilter}
        onChange={(event) => onInstitutionFilterChange(event.target.value)}
        size="small"
      >
        <MenuItem value="all">All institutions</MenuItem>
        {institutionOptions.map((institution) => (
          <MenuItem key={institution} value={institution}>
            {institution}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Billing mode"
        value={billingModeFilter}
        onChange={(event) => onBillingModeFilterChange(event.target.value)}
        size="small"
      >
        <MenuItem value="all">All modes</MenuItem>
        {subscriptionBillingModeOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      {/* Cadence is how often the subscription RENEWS — required by §6.2 and a
          different question from the billing mode above. Only the two cadences
          Xtiitch bills on exist; "not set" is a real state (a store that has not
          started billing), so it is filterable rather than hidden. */}
      <TextField
        select
        label="Cadence"
        value={cadenceFilter}
        onChange={(event) => onCadenceFilterChange(event.target.value)}
        size="small"
      >
        <MenuItem value="all">All cadences</MenuItem>
        <MenuItem value="quarterly">Quarterly</MenuItem>
        <MenuItem value="yearly">Yearly</MenuItem>
        <MenuItem value="none">Not set</MenuItem>
      </TextField>
    </Box>
  );
}
