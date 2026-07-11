import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "../../components/form-text-field";
import { AdminSubscriptionDiscountCode, AdminPlan } from "../shared/types";
import {
  subscriptionDiscountCadenceOptions,
  subscriptionDiscountTypeOptions,
  subscriptionDiscountValueDefault,
} from "./utils";
import { FormGroupLabel } from "../shared/FormGroupLabel";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";



export function SubscriptionDiscountCodeFormFields({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  discountCode,
  plans,
}: {
  discountCode?: AdminSubscriptionDiscountCode;
  plans: AdminPlan[];
}) {
  const selectedPlanCodes = new Set(
    discountCode && discountCode.eligiblePlans.length > 0
      ? discountCode.eligiblePlans
      : plans.map((plan) => plan.code),
  );
  const selectedCadences = new Set(
    discountCode && discountCode.eligibleCadences.length > 0
      ? discountCode.eligibleCadences
      : subscriptionDiscountCadenceOptions.map((option) => option.value),
  );
  const discountType = discountCode?.discountType ?? "percentage";

  return (
    <Stack spacing={1.5}>
      <Box>
        <FormGroupLabel>Code details</FormGroupLabel>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "1.2fr 1fr 1fr",
            },
          }}
        >
          <TextField
            label="Code"
            name="code"
            size="small"
            defaultValue={discountCode?.code ?? ""}
            placeholder="STUDENT50"
            required
          />
          <TextField
            select
            label="Discount type"
            name="discount_type"
            size="small"
            defaultValue={discountType}
          >
            {subscriptionDiscountTypeOptions.map((option) => (
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
            defaultValue={
              discountCode
                ? subscriptionDiscountValueDefault(discountCode)
                : discountType === "free_period"
                  ? "1"
                  : "0"
            }
            helperText="Percent, GHS, or months"
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            required
          />
        </Box>
      </Box>

      <Box>
        <FormGroupLabel>Eligibility</FormGroupLabel>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          <Box
            sx={{
              p: 1.25,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb), 0.62)",
            }}
          >
            <Typography sx={{ fontWeight: 850, mb: 0.75 }}>Packages</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
              {plans.map((plan) => (
                <FormControlLabel
                  key={plan.code}
                  sx={{ mr: 1 }}
                  control={
                    <Checkbox
                      name="eligible_plans"
                      value={plan.code}
                      size="small"
                      defaultChecked={selectedPlanCodes.has(plan.code)}
                    />
                  }
                  label={plan.name}
                />
              ))}
            </Stack>
          </Box>
          <Box
            sx={{
              p: 1.25,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "rgba(var(--surface-rgb), 0.62)",
            }}
          >
            <Typography sx={{ fontWeight: 850, mb: 0.75 }}>Cadences</Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
              {subscriptionDiscountCadenceOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  sx={{ mr: 1 }}
                  control={
                    <Checkbox
                      name="eligible_cadences"
                      value={option.value}
                      size="small"
                      defaultChecked={selectedCadences.has(option.value)}
                    />
                  }
                  label={option.label}
                />
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box>
        <FormGroupLabel>Controls</FormGroupLabel>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          <TextField
            label="Total cap"
            name="max_redemptions_total"
            type="number"
            size="small"
            defaultValue={discountCode?.maxRedemptionsTotal ?? ""}
            placeholder="Unlimited"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <TextField
            label="Per account"
            name="max_per_account"
            type="number"
            size="small"
            defaultValue={discountCode?.maxPerAccount ?? 1}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            required
          />
          <TextField
            label="Owner / institution"
            name="owner_name"
            size="small"
            defaultValue={discountCode?.ownerName ?? ""}
            placeholder="University of Ghana"
          />
          <TextField
            label="Batch"
            name="batch_label"
            size="small"
            defaultValue={discountCode?.batchLabel ?? ""}
            placeholder="2026 intake"
          />
        </Box>
      </Box>

      <Box>
        <FormGroupLabel>Lifecycle</FormGroupLabel>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          <StyledDateTimeField
            name="valid_from"
            label="Valid from"
            defaultValue={discountCode?.validFrom ?? ""}
          />
          <StyledDateTimeField
            name="valid_until"
            label="Valid until"
            defaultValue={discountCode?.validUntil ?? ""}
          />
        </Box>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                name="first_purchase_only"
                size="small"
                defaultChecked={discountCode?.firstPurchaseOnly ?? true}
              />
            }
            label="First purchase only"
          />
          <FormControlLabel
            control={
              <Checkbox
                name="active"
                size="small"
                defaultChecked={discountCode?.active ?? true}
              />
            }
            label="Active"
          />
        </Stack>
      </Box>
    </Stack>
  );
}
