import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "../../../components/form-text-field";
import { StyledDateTimeField } from "../../shared/StyledDateTimeField";
import {
  referralAudienceOptions,
  referralRefereeRewardKindOptions,
  referralRewardKindOptions,
  referralRewardTypeOptions,
  referralStatusOptions,
} from "../options";
import { referralRewardDefault } from "../utils";
import { datetimeLocalDefault } from "../../shared/dates";
import { moneyInputDefault } from "../../shared/validation";
import type { AdminReferralProgramme } from "../../../lib/api";

export function ReferralProgrammeEditForm({
  programme,
}: {
  programme: AdminReferralProgramme;
}) {
  const archived = programme.status === "archived";

  return (
    <Form method="post">
      <input
        type="hidden"
        name="intent"
        value="admin-referral-programme:update"
      />
      <input
        type="hidden"
        name="programme_id"
        value={programme.programmeId}
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
            label="Title"
            name="title"
            size="small"
            defaultValue={programme.title}
            required
            disabled={archived}
          />
          <TextField
            label="Code prefix"
            name="code_prefix"
            size="small"
            defaultValue={programme.codePrefix}
            required
            disabled={archived}
          />
          <TextField
            select
            label="Audience"
            name="audience"
            size="small"
            defaultValue={programme.audience}
            disabled={archived}
          >
            {referralAudienceOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Referrer reward"
            name="referrer_reward_kind"
            size="small"
            defaultValue={programme.referrerRewardKind}
            disabled={archived}
          >
            {referralRewardKindOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="New customer reward"
            name="referee_reward_kind"
            size="small"
            defaultValue={programme.refereeRewardKind}
            disabled={archived}
          >
            {referralRefereeRewardKindOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Reward type"
            name="reward_type"
            size="small"
            defaultValue={programme.rewardType}
            disabled={archived}
          >
            {referralRewardTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reward value"
            name="reward_value"
            type="number"
            size="small"
            defaultValue={referralRewardDefault(programme)}
            required
            disabled={archived}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
          />
          <TextField
            label="Percentage cap (GHS)"
            name="max_reward_ghs"
            type="number"
            size="small"
            defaultValue={moneyInputDefault(programme.maxRewardMinor)}
            disabled={archived}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
          />
          <TextField
            label="Minimum order (GHS)"
            name="qualifying_order_min_ghs"
            type="number"
            size="small"
            defaultValue={moneyInputDefault(
              programme.qualifyingOrderMinMinor,
            )}
            disabled={archived}
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
          />
          <TextField
            label="Reward hold days"
            name="reward_hold_days"
            type="number"
            size="small"
            defaultValue={programme.rewardHoldDays}
            disabled={archived}
            slotProps={{
              htmlInput: { min: 0, max: 180, step: 1 },
            }}
          />
          <TextField
            select
            label="Status"
            name="status"
            size="small"
            defaultValue={
              programme.status === "archived" ? "paused" : programme.status
            }
            disabled={archived}
          >
            {referralStatusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <StyledDateTimeField
            label="Starts"
            name="starts_at"
            size="small"
            defaultValue={datetimeLocalDefault(programme.startsAt)}
            disabled={archived}
          />
          <StyledDateTimeField
            label="Ends"
            name="ends_at"
            size="small"
            defaultValue={datetimeLocalDefault(programme.endsAt)}
            disabled={archived}
          />
        </Box>
        <TextField
          label="Notes"
          name="notes"
          multiline
          minRows={2}
          size="small"
          defaultValue={programme.notes}
          disabled={archived}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={archived}
          sx={{ alignSelf: "flex-start" }}
        >
          Save programme
        </Button>
      </Stack>
    </Form>
  );
}
