import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import PriceCheckRounded from "@mui/icons-material/PriceCheckRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import TextField from "../../components/form-text-field";
import AiAssistField from "../../components/ai-assist";
import type { Design } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { BusinessPromotion, CollectionSummary } from "../shared/types";
import { MiniStat } from "../../components/ui/MiniStat";
import { promotionDiscountLabel, promotionTargetLabel, promotionStatusTone, promotionWindowLabel, promotionPercentInputValue } from "./utils";
import { InfoStrip } from "../studio/InfoStrip";
import { datetimeLocalValue } from "../shared/utils";
import { moneyInputValue } from "../orders/utils";
import { StyledDateTimeField } from "../../components/ui/StyledDateTimeField";

export function PromotionDetailForm({
  promotion,
  collections,
  designs,
}: {
  promotion: BusinessPromotion;
  collections: CollectionSummary[];
  designs: Design[];
}) {
  const archived = promotion.status === "archived";
  const currentCollectionID = promotion.target_collection_id ?? "";
  const currentDesignID = promotion.target_design_id ?? "";

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <MiniStat
          icon={<LocalOfferRounded fontSize="small" />}
          label="Discount"
          value={promotionDiscountLabel(promotion)}
          helper={promotionTargetLabel(promotion, collections, designs)}
          tone={promotionStatusTone(promotion.status)}
        />
        <MiniStat
          icon={<PriceCheckRounded fontSize="small" />}
          label="Redemptions"
          value={String(promotion.redemption_count)}
          helper={formatGHS(promotion.discount_redeemed_minor)}
          tone={tokens.success}
        />
        <MiniStat
          icon={<ScheduleRounded fontSize="small" />}
          label="Window"
          value={promotion.status}
          helper={promotionWindowLabel(promotion)}
          tone={promotionStatusTone(promotion.status)}
        />
      </Box>

      {archived ? (
        <InfoStrip
          icon={<WarningAmberRounded />}
          tone={tokens.mutedText}
          title="Archived promotion"
          helper="Archived codes stay visible for reporting and cannot be edited here."
        />
      ) : (
        <Stack spacing={1.5}>
          <Form method="post">
            <input type="hidden" name="intent" value="update_promotion" />
            <input
              type="hidden"
              name="promotion_id"
              value={promotion.promotion_id}
            />
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(4, minmax(0, 1fr))",
                },
              }}
            >
              <TextField
                name="code"
                label="Code"
                size="small"
                defaultValue={promotion.code}
                required
              />
              <TextField
                name="title"
                label="Title"
                size="small"
                defaultValue={promotion.title}
                required
              />
              <TextField
                name="discount_type"
                label="Type"
                select
                size="small"
                defaultValue={
                  promotion.discount_type === "fixed" ? "fixed" : "percentage"
                }
              >
                <MenuItem value="percentage">Percent</MenuItem>
                <MenuItem value="fixed">Fixed</MenuItem>
              </TextField>
              <TextField
                name="status"
                label="Status"
                select
                size="small"
                defaultValue={
                  promotion.status === "paused" ? "paused" : "active"
                }
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="paused">Paused</MenuItem>
              </TextField>
              <AiAssistField
                name="description"
                label="Note"
                assistField="promotion note"
                size="small"
                defaultValue={promotion.description}
                multiline
                minRows={2}
                fullWidth
                sx={{ gridColumn: { lg: "span 2" } }}
              />
              <TextField
                name="percentage_discount"
                label="Percent"
                size="small"
                defaultValue={promotionPercentInputValue(promotion)}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
              />
              <TextField
                name="fixed_discount_ghs"
                label="Fixed"
                size="small"
                defaultValue={
                  promotion.discount_type === "fixed"
                    ? moneyInputValue(promotion.discount_value)
                    : ""
                }
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: "decimal" },
                }}
              />
              <TextField
                name="max_discount_ghs"
                label="Max"
                size="small"
                defaultValue={moneyInputValue(promotion.max_discount_minor)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: "decimal" },
                }}
              />
              <TextField
                name="min_spend_ghs"
                label="Min spend"
                size="small"
                defaultValue={moneyInputValue(promotion.min_spend_minor)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: "decimal" },
                }}
              />
              <TextField
                name="scope"
                label="Applies to"
                select
                size="small"
                defaultValue={
                  ["store", "collection", "design"].includes(promotion.scope)
                    ? promotion.scope
                    : "store"
                }
              >
                <MenuItem value="store">Store</MenuItem>
                <MenuItem value="collection">Collection</MenuItem>
                <MenuItem value="design">Design</MenuItem>
              </TextField>
              <TextField
                name="target_collection_id"
                label="Collection"
                select
                size="small"
                defaultValue={currentCollectionID}
              >
                <MenuItem value="">No collection</MenuItem>
                {collections.map((collection) => (
                  <MenuItem
                    key={collection.collection_id}
                    value={collection.collection_id}
                  >
                    {collection.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                name="target_design_id"
                label="Design"
                select
                size="small"
                defaultValue={currentDesignID}
              >
                <MenuItem value="">No design</MenuItem>
                {designs.map((design) => (
                  <MenuItem key={design.design_id} value={design.design_id}>
                    {design.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                name="usage_limit_global"
                label="Total uses"
                type="number"
                size="small"
                defaultValue={promotion.usage_limit_global ?? ""}
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                name="usage_limit_per_customer"
                label="Uses/customer"
                type="number"
                size="small"
                defaultValue={promotion.usage_limit_per_customer ?? ""}
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <StyledDateTimeField
                name="starts_at"
                label="Starts"
                size="small"
                defaultValue={datetimeLocalValue(promotion.starts_at ?? "")}
              />
              <StyledDateTimeField
                name="ends_at"
                label="Ends"
                size="small"
                defaultValue={datetimeLocalValue(promotion.ends_at ?? "")}
              />
            </Box>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveRounded />}
              sx={{ mt: 1.5 }}
            >
              Save promotion
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="archive_promotion" />
            <input
              type="hidden"
              name="promotion_id"
              value={promotion.promotion_id}
            />
            <Button type="submit" variant="outlined" color="error">
              Archive promotion
            </Button>
          </Form>
        </Stack>
      )}
    </Stack>
  );
}