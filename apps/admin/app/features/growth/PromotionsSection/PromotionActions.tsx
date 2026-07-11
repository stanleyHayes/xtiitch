import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import SearchRounded from "@mui/icons-material/SearchRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import TextField from "../../../components/form-text-field";
import { Panel } from "../../../components/ui/Panel";
import {
  promotionScopeOptions,
  promotionStatusOptions,
} from "../options";

export function PromotionActions({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  scopeFilter,
  onScopeFilterChange,
  onCreate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  scopeFilter: string;
  onScopeFilterChange: (value: string) => void;
  onCreate: () => void;
}) {
  return (
    <Panel sx={{ overflow: "hidden" }}>
      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(220px, 1fr) repeat(2, minmax(140px, 0.35fr)) auto",
          },
          alignItems: "center",
        }}
      >
        <TextField
          label="Search promotions"
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
          label="Status"
          select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          size="small"
        >
          <MenuItem value="all">All statuses</MenuItem>
          {promotionStatusOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Scope"
          select
          value={scopeFilter}
          onChange={(event) => onScopeFilterChange(event.target.value)}
          size="small"
        >
          <MenuItem value="all">All scopes</MenuItem>
          {promotionScopeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          startIcon={<LocalOfferRounded />}
          onClick={onCreate}
          sx={{ minHeight: 42, whiteSpace: "nowrap" }}
        >
          New promotion
        </Button>
      </Box>
    </Panel>
  );
}
