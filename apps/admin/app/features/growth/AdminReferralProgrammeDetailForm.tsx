import type { AdminReferralProgramme, AdminBusiness } from "../../lib/api";
import { referralCodeOwnerOptions, referralCodeStatusOptions, referralAudienceOptions, referralRewardKindOptions, referralRefereeRewardKindOptions, referralRewardTypeOptions, referralStatusOptions } from "./options";
import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { formatGHS } from "../shared/formatting";
import { datetimeLocalDefault, shortTime } from "../shared/dates";
import { DetailLine } from "../shared/DetailLine";
import { referralRefereeRewardKindLabel, referralRewardDefault, referralRewardKindLabel, referralRewardLabel } from "./utils";
import { moneyInputDefault } from "../shared/validation";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";



export function AdminReferralProgrammeDetailForm({
  programme,
  eligibleBusinesses,
}: {
  programme: AdminReferralProgramme;
  eligibleBusinesses: AdminBusiness[];
}) {
  const archived = programme.status === "archived";
  const windowText =
    programme.startsAt || programme.endsAt
      ? `${programme.startsAt ? shortTime(programme.startsAt) : "Now"} to ${
          programme.endsAt ? shortTime(programme.endsAt) : "open"
        }`
      : "Always available";
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
        }}
      >
        <DetailLine label="Reward" value={referralRewardLabel(programme)} />
        <DetailLine
          label="Reward route"
          value={`${referralRewardKindLabel(
            programme.referrerRewardKind,
          )} / ${referralRefereeRewardKindLabel(programme.refereeRewardKind)}`}
        />
        <DetailLine
          label="Minimum order"
          value={formatGHS(programme.qualifyingOrderMinMinor)}
        />
        <DetailLine label="Hold" value={`${programme.rewardHoldDays} days`} />
        <DetailLine label="Window" value={windowText} />
        <DetailLine label="Updated" value={shortTime(programme.updatedAt)} />
      </Box>

      <Stack spacing={1.5}>
        {programme.notes ? (
          <Box
            sx={{
              p: 1.25,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.08),
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.7)",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Notes
            </Typography>
            <Typography sx={{ overflowWrap: "anywhere" }}>
              {programme.notes}
            </Typography>
          </Box>
        ) : null}

        <Box
          sx={{
            p: 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.ink, 0.08),
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.74)",
          }}
        >
          <Stack spacing={1.25}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  Issued codes
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {programme.codes.length
                    ? `${programme.codes.length} recent code${
                        programme.codes.length === 1 ? "" : "s"
                      }`
                    : "No codes issued"}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${programme.codes.reduce(
                  (total, code) => total + code.referralCount,
                  0,
                )} referrals`}
                variant="outlined"
              />
            </Stack>

            {programme.codes.length > 0 ? (
              <Stack spacing={0.75}>
                {programme.codes.map((code) => (
                  <Box
                    key={code.referralCodeId}
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
                      },
                      alignItems: "center",
                      p: 1,
                      borderRadius: 1,
                      bgcolor: alpha(tokens.ink, 0.035),
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 900,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {code.code}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {code.ownerLabel || "Platform"} ·{" "}
                        {shortTime(code.updatedAt)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {code.referralCount} total · {code.qualifiedCount}{" "}
                      qualified
                    </Typography>
                    <Chip
                      size="small"
                      label={code.status}
                      sx={{
                        justifySelf: { sm: "end" },
                        bgcolor: alpha(
                          code.status === "active"
                            ? tokens.success
                            : tokens.warning,
                          0.12,
                        ),
                        color:
                          code.status === "active"
                            ? tokens.success
                            : tokens.warning,
                        fontWeight: 900,
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            ) : null}

            <Divider />

            <Form method="post">
              <input
                type="hidden"
                name="intent"
                value="admin-referral-code:create"
              />
              <input
                type="hidden"
                name="programme_id"
                value={programme.programmeId}
              />
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "1fr 1fr 1.2fr auto",
                  },
                  alignItems: "center",
                }}
              >
                <TextField
                  select
                  label="Owner"
                  name="owner_type"
                  size="small"
                  defaultValue="platform"
                  disabled={archived || programme.status !== "active"}
                >
                  {referralCodeOwnerOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Business"
                  name="business_id"
                  size="small"
                  defaultValue=""
                  disabled={
                    archived ||
                    programme.status !== "active" ||
                    eligibleBusinesses.length === 0
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {eligibleBusinesses.map((business) => (
                    <MenuItem key={business.id} value={business.id}>
                      {business.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Code"
                  name="code"
                  size="small"
                  placeholder={`${programme.codePrefix}AMA`}
                  required
                  disabled={archived || programme.status !== "active"}
                />
                <TextField
                  select
                  label="Status"
                  name="status"
                  size="small"
                  defaultValue="active"
                  disabled={archived || programme.status !== "active"}
                >
                  {referralCodeStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Button
                type="submit"
                variant="outlined"
                disabled={archived || programme.status !== "active"}
                sx={{ mt: 1.25 }}
              >
                Issue code
              </Button>
            </Form>
          </Stack>
        </Box>

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

        <Form method="post">
          <input
            type="hidden"
            name="intent"
            value="admin-referral-programme:archive"
          />
          <input
            type="hidden"
            name="programme_id"
            value={programme.programmeId}
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
    </Stack>
  );
}
