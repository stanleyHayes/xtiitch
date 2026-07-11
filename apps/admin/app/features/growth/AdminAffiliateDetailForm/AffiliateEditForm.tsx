import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import { affiliateCommissionDefault } from "../utils";
import {
  affiliateCommissionOptions,
  affiliateEntityOptions,
  affiliatePayoutOptions,
  affiliateStatusOptions,
} from "../options";
import type { AdminAffiliate } from "../../../lib/api";

export function AffiliateEditForm({
  affiliate,
}: {
  affiliate: AdminAffiliate;
}) {
  const archived = affiliate.status === "archived";

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-affiliate:update" />
      <input
        type="hidden"
        name="affiliate_id"
        value={affiliate.affiliateId}
      />
      <Stack spacing={1.25}>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <TextField
            select
            label="Entity"
            name="entity_type"
            size="small"
            defaultValue={affiliate.entityType}
            disabled={archived}
          >
            {affiliateEntityOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Code"
            name="code"
            size="small"
            defaultValue={affiliate.code}
            required
            disabled={archived}
          />
          <TextField
            label="Display name"
            name="display_name"
            size="small"
            defaultValue={affiliate.displayName}
            required
            disabled={archived}
          />
          <TextField
            label="Contact name"
            name="contact_name"
            size="small"
            defaultValue={affiliate.contactName}
            disabled={archived}
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            size="small"
            defaultValue={affiliate.email}
            disabled={archived}
          />
          <TextField
            label="Phone"
            name="phone"
            size="small"
            defaultValue={affiliate.phone}
            disabled={archived}
          />
          <TextField
            label="Website"
            name="website_url"
            type="url"
            size="small"
            defaultValue={affiliate.websiteUrl}
            disabled={archived}
          />
          <TextField
            select
            label="Commission"
            name="commission_model"
            size="small"
            defaultValue={affiliate.commissionModel}
            disabled={archived}
          >
            {affiliateCommissionOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Commission value"
            name="commission_value"
            type="number"
            size="small"
            defaultValue={affiliateCommissionDefault(affiliate)}
            required
            disabled={archived}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
          />
          <TextField
            label="Cookie window"
            name="cookie_window_days"
            type="number"
            size="small"
            defaultValue={affiliate.cookieWindowDays}
            disabled={archived}
            slotProps={{
              htmlInput: { min: 1, max: 365, step: 1 },
            }}
          />
          <TextField
            select
            label="Payout mode"
            name="payout_mode"
            size="small"
            defaultValue={affiliate.payoutMode}
            disabled={archived}
          >
            {affiliatePayoutOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            name="status"
            size="small"
            defaultValue={
              affiliate.status === "archived" ? "paused" : affiliate.status
            }
            disabled={archived}
          >
            {affiliateStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <TextField
            label="Payout reference"
            name="payout_reference"
            size="small"
            defaultValue={affiliate.payoutReference}
            disabled={archived}
          />
          <TextField
            label="Notes"
            name="notes"
            multiline
            minRows={2}
            size="small"
            defaultValue={affiliate.notes}
            disabled={archived}
          />
        </Box>
        <Button
          type="submit"
          variant="contained"
          disabled={archived}
          sx={{ alignSelf: "flex-start" }}
        >
          Save partner
        </Button>
      </Stack>
    </Form>
  );
}
