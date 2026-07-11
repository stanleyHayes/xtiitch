import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import { StyledDateTimeField } from "../../shared/StyledDateTimeField";
import {
  promotionDiscountTypeOptions,
  promotionFundingSourceOptions,
  promotionScopeOptions,
  promotionStatusOptions,
} from "../options";
import { promotionTargetLabel, promotionValueDefault } from "../utils";
import { datetimeLocalDefault } from "../../shared/dates";
import { moneyInputDefault } from "../../shared/validation";
import type { AdminPromotion, AdminBusiness } from "../../../lib/api";

export function PromotionEditForm({
  promotion,
  businesses,
}: {
  promotion: AdminPromotion;
  businesses: AdminBusiness[];
}) {
  const archived = promotion.status === "archived";

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-promotion:update" />
      <input
        type="hidden"
        name="promotion_id"
        value={promotion.promotionId}
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
            label="Target"
            name="business_id"
            size="small"
            defaultValue={promotion.businessId ?? ""}
            disabled={archived}
          >
            <MenuItem value="">Platform-wide</MenuItem>
            {promotion.businessId &&
            !businesses.some(
              (business) => business.id === promotion.businessId,
            ) ? (
              <MenuItem value={promotion.businessId}>
                {promotionTargetLabel(promotion)}
              </MenuItem>
            ) : null}
            {businesses.map((business) => (
              <MenuItem key={business.id} value={business.id}>
                {business.name} · {business.handle}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Code"
            name="code"
            size="small"
            defaultValue={promotion.code}
            disabled={archived}
          />
          <TextField
            label="Title"
            name="title"
            size="small"
            defaultValue={promotion.title}
            required
            disabled={archived}
          />
          <TextField
            select
            label="Status"
            name="status"
            size="small"
            defaultValue={
              promotion.status === "archived" ? "paused" : promotion.status
            }
            disabled={archived}
          >
            {promotionStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Discount"
            name="discount_type"
            size="small"
            defaultValue={promotion.discountType}
            disabled={archived}
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
            defaultValue={promotionValueDefault(promotion)}
            disabled={archived}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
          />
          <TextField
            label="Max cap"
            name="max_discount_ghs"
            type="number"
            size="small"
            defaultValue={moneyInputDefault(promotion.maxDiscountMinor)}
            disabled={archived}
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
            defaultValue={moneyInputDefault(promotion.minSpendMinor)}
            disabled={archived}
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
            defaultValue={promotion.fundingSource}
            disabled={archived}
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
            defaultValue={promotion.scope}
            disabled={archived}
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
            defaultValue={promotion.targetCollectionId ?? ""}
            disabled={archived}
          />
          <TextField
            label="Design ID"
            name="target_design_id"
            size="small"
            defaultValue={promotion.targetDesignId ?? ""}
            disabled={archived}
          />
          <TextField
            label="Global limit"
            name="usage_limit_global"
            type="number"
            size="small"
            defaultValue={promotion.usageLimitGlobal ?? ""}
            placeholder="Unlimited"
            disabled={archived}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <TextField
            label="Per-customer limit"
            name="usage_limit_per_customer"
            type="number"
            size="small"
            defaultValue={promotion.usageLimitPerCustomer ?? ""}
            placeholder="Unlimited"
            disabled={archived}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <StyledDateTimeField
            label="Starts"
            name="starts_at"
            size="small"
            defaultValue={datetimeLocalDefault(promotion.startsAt)}
            disabled={archived}
          />
          <StyledDateTimeField
            label="Ends"
            name="ends_at"
            size="small"
            defaultValue={datetimeLocalDefault(promotion.endsAt)}
            disabled={archived}
          />
        </Box>
        <TextField
          label="Description"
          name="description"
          multiline
          minRows={2}
          size="small"
          defaultValue={promotion.description}
          disabled={archived}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={archived}
          sx={{ alignSelf: "flex-start" }}
        >
          Save promotion
        </Button>
      </Stack>
    </Form>
  );
}
