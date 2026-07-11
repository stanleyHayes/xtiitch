import type { AdminBusiness } from "../../lib/api";
import { promotionDiscountTypeOptions, promotionFundingSourceOptions, promotionScopeOptions, promotionStatusOptions } from "./options";
import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import TextField from "../../components/form-text-field";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";



export function AdminPromotionCreateForm({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  businesses,
}: {
  businesses: AdminBusiness[];
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-promotion:create" />
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
              xl: "1.1fr 1fr 1.4fr repeat(3, minmax(120px, 0.85fr))",
            },
          }}
        >
          <TextField
            select
            label="Target"
            name="business_id"
            size="small"
            defaultValue=""
          >
            <MenuItem value="">Platform-wide</MenuItem>
            {businesses.map((business) => (
              <MenuItem key={business.id} value={business.id}>
                {business.name} · {business.handle}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Code"
            name="code"
            placeholder="WELCOME10"
            size="small"
          />
          <TextField label="Title" name="title" size="small" required />
          <TextField
            select
            label="Discount"
            name="discount_type"
            size="small"
            defaultValue="percentage"
          >
            {promotionDiscountTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Value"
            name="discount_value"
            type="number"
            size="small"
            defaultValue="10"
            slotProps={{
              htmlInput: { min: 0, step: "0.01" },
            }}
          />
          <TextField
            label="Max cap"
            name="max_discount_ghs"
            type="number"
            size="small"
            defaultValue="50.00"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { min: 0, step: "0.01" },
            }}
          />
          <TextField
            label="Minimum spend"
            name="min_spend_ghs"
            type="number"
            size="small"
            defaultValue="0.00"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { min: 0, step: "0.01" },
            }}
          />
          <TextField
            select
            label="Funding"
            name="funding_source"
            size="small"
            defaultValue="business"
          >
            {promotionFundingSourceOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Scope"
            name="scope"
            size="small"
            defaultValue="store"
          >
            {promotionScopeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Collection ID"
            name="target_collection_id"
            size="small"
          />
          <TextField label="Design ID" name="target_design_id" size="small" />
          <TextField
            select
            label="Status"
            name="status"
            size="small"
            defaultValue="active"
          >
            {promotionStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Global limit"
            name="usage_limit_global"
            type="number"
            size="small"
            placeholder="Unlimited"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <TextField
            label="Per-customer limit"
            name="usage_limit_per_customer"
            type="number"
            size="small"
            placeholder="Unlimited"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <StyledDateTimeField label="Starts" name="starts_at" size="small" />
          <StyledDateTimeField label="Ends" name="ends_at" size="small" />
        </Box>
        <TextField
          label="Description"
          name="description"
          multiline
          minRows={2}
          size="small"
        />
        <Button
          type="submit"
          variant="contained"
          startIcon={<LocalOfferRounded />}
          sx={{ alignSelf: "flex-start" }}
        >
          Create promotion
        </Button>
      </Stack>
    </Form>
  );
}
