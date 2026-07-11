import type { AdminPromotion, AdminBusiness } from "../../lib/api";
import { promotionStatusOptions, promotionDiscountTypeOptions, promotionFundingSourceOptions, promotionScopeOptions } from "./options";
import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { formatGHS } from "../shared/formatting";
import { datetimeLocalDefault, shortID, shortTime } from "../shared/dates";
import { DetailLine } from "../shared/DetailLine";
import { promotionDiscountLabel, promotionScopeTargetLabel, promotionTargetLabel, promotionValueDefault } from "./utils";
import { moneyInputDefault } from "../shared/validation";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";



export function AdminPromotionDetailForm({
  promotion,
  businesses,
}: {
  promotion: AdminPromotion;
  businesses: AdminBusiness[];
}) {
  const archived = promotion.status === "archived";

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
        }}
      >
        <DetailLine
          label="Discount"
          value={promotionDiscountLabel(promotion)}
        />
        <DetailLine
          label="Cap"
          value={
            typeof promotion.maxDiscountMinor === "number"
              ? formatGHS(promotion.maxDiscountMinor)
              : "No cap"
          }
        />
        <DetailLine
          label="Minimum spend"
          value={formatGHS(promotion.minSpendMinor)}
        />
        <DetailLine
          label="Redemptions"
          value={`${promotion.redemptionCount} uses · ${formatGHS(
            promotion.discountRedeemedMinor,
          )}`}
        />
        <DetailLine
          label="Limits"
          value={`Global ${
            promotion.usageLimitGlobal ?? "unlimited"
          } · Customer ${promotion.usageLimitPerCustomer ?? "unlimited"}`}
        />
        <DetailLine
          label="Funding"
          value={`${promotion.fundingSource} · ${promotionScopeTargetLabel(
            promotion,
          )}`}
        />
        <DetailLine
          label="Starts"
          value={promotion.startsAt ? shortTime(promotion.startsAt) : "Now"}
        />
        <DetailLine
          label="Ends"
          value={promotion.endsAt ? shortTime(promotion.endsAt) : "Open"}
        />
      </Box>

      {promotion.recentRedemptions.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          }}
        >
          {promotion.recentRedemptions.map((redemption) => (
            <Box
              key={redemption.promotionRedemptionId}
              sx={{
                p: 1.1,
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                borderRadius: 1,
                bgcolor: "rgba(var(--surface-rgb), 0.7)",
                minWidth: 0,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Chip
                  size="small"
                  label={redemption.status}
                  color={
                    redemption.status === "applied"
                      ? "success"
                      : redemption.status === "pending"
                        ? "warning"
                        : "default"
                  }
                  variant="outlined"
                  sx={{ textTransform: "capitalize" }}
                />
                <Typography sx={{ fontWeight: 900 }}>
                  {formatGHS(redemption.discountMinor)}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.75,
                  color: "text.secondary",
                  overflowWrap: "anywhere",
                }}
              >
                {redemption.customerName ||
                  (redemption.customerId
                    ? `Customer ${shortID(redemption.customerId)}`
                    : "Unknown customer")}
                {" · "}
                {redemption.orderId
                  ? `Order ${shortID(redemption.orderId)}`
                  : "No order linked"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
              >
                {shortTime(redemption.redeemedAt ?? redemption.createdAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info">No recent redemptions have been recorded.</Alert>
      )}

      {archived ? (
        <Alert severity="info">
          Archived promotions stay visible for reporting and cannot be edited.
        </Alert>
      ) : null}

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

      <Form method="post">
        <input type="hidden" name="intent" value="admin-promotion:archive" />
        <input
          type="hidden"
          name="promotion_id"
          value={promotion.promotionId}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            label="Archive reason"
            name="reason"
            size="small"
            placeholder="Campaign ended"
            fullWidth
            disabled={archived}
          />
          <Button
            type="submit"
            variant="outlined"
            color="warning"
            disabled={archived}
            sx={{ minWidth: { sm: 140 } }}
          >
            Archive
          </Button>
        </Stack>
      </Form>
    </Stack>
  );
}
