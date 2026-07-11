import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import { StyledDateTimeField } from "../../shared/StyledDateTimeField";
import { adCampaignStatusOptions, adPlacementOptions } from "../options";
import { datetimeLocalDefault } from "../../shared/dates";
import { moneyInputDefault } from "../../shared/validation";
import type { AdminAdCampaign, AdminBusiness } from "../../../lib/api";

export function AdCampaignEditForm({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  campaign,
  eligibleBusinesses,
}: {
  campaign: AdminAdCampaign;
  eligibleBusinesses: AdminBusiness[];
}) {
  const archived = campaign.status === "archived";

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="admin-ad-campaign:update" />
      <input type="hidden" name="campaign_id" value={campaign.campaignId} />
      <input type="hidden" name="pricing_model" value="flat_time" />
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
            label="Business"
            name="business_id"
            size="small"
            defaultValue={campaign.businessId}
            disabled={archived}
          >
            {!eligibleBusinesses.some(
              (business) => business.id === campaign.businessId,
            ) ? (
              <MenuItem value={campaign.businessId}>
                {campaign.businessName} · {campaign.businessHandle}
              </MenuItem>
            ) : null}
            {eligibleBusinesses.map((business) => (
              <MenuItem key={business.id} value={business.id}>
                {business.name} · {business.handle}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Placement"
            name="placement_type"
            size="small"
            defaultValue={campaign.placementType}
            disabled={archived}
          >
            {adPlacementOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Target ref"
            name="target_ref_id"
            size="small"
            defaultValue={campaign.targetRefId}
            disabled={archived}
          />
          <TextField
            select
            label="Status"
            name="status"
            size="small"
            defaultValue={
              campaign.status === "archived" ? "paused" : campaign.status
            }
            disabled={archived}
          >
            {adCampaignStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Headline"
            name="headline"
            size="small"
            defaultValue={campaign.headline}
            required
            disabled={archived}
          />
          <TextField
            label="Budget"
            name="budget_ghs"
            type="number"
            size="small"
            defaultValue={moneyInputDefault(campaign.budgetMinor)}
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
            label="Daily cap"
            name="daily_cap_ghs"
            type="number"
            size="small"
            defaultValue={moneyInputDefault(campaign.dailyCapMinor)}
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
          <StyledDateTimeField
            label="Starts"
            name="starts_at"
            size="small"
            defaultValue={datetimeLocalDefault(campaign.startsAt)}
            required
            disabled={archived}
          />
          <StyledDateTimeField
            label="Ends"
            name="ends_at"
            size="small"
            defaultValue={datetimeLocalDefault(campaign.endsAt)}
            required
            disabled={archived}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <TextField
            label="Description"
            name="description"
            multiline
            minRows={2}
            size="small"
            defaultValue={campaign.description}
            disabled={archived}
          />
          <TextField
            label="Review note"
            name="review_note"
            multiline
            minRows={2}
            size="small"
            defaultValue={campaign.reviewNote}
            disabled={archived}
          />
        </Box>
        <Button
          type="submit"
          variant="contained"
          disabled={archived}
          sx={{ alignSelf: "flex-start" }}
        >
          Save placement
        </Button>
      </Stack>
    </Form>
  );
}
