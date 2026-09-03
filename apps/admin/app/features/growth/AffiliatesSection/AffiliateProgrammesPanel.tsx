import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Form } from "react-router";
import TextField from "../../../components/form-text-field";
import type { AdminAffiliateProgramme } from "../../../lib/api";

export function AffiliateProgrammesPanel({
  programmes,
  error,
}: {
  programmes: AdminAffiliateProgramme[];
  error: string | null;
}) {
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="h6">Programme policy</Typography>
        <Typography variant="body2" color="text.secondary">
          Set independent purchase and first-paid-plan rates. Existing
          conversions keep their snapshotted rates.
        </Typography>
      </Box>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      {programmes.map((programme) => (
        <ProgrammeForm
          key={programme.affiliateProgrammeId}
          programme={programme}
        />
      ))}
    </Stack>
  );
}

// eslint-disable-next-line max-lines-per-function -- policy fields intentionally remain in one operator form
function ProgrammeForm({ programme }: { programme: AdminAffiliateProgramme }) {
  const milestonePayload = programme.milestones.map((milestone) => ({
    milestoneId: milestone.milestoneId,
    threshold: milestone.threshold,
    title: milestone.title,
    rewardDescription: milestone.rewardDescription,
    status: milestone.status,
  }));
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Form method="post">
        <input
          type="hidden"
          name="intent"
          value="admin-affiliate-programme:update"
        />
        <input
          type="hidden"
          name="affiliate_programme_id"
          value={programme.affiliateProgrammeId}
        />
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{programme.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {programme.ownerType === "platform"
                ? "Platform-owned"
                : programme.businessName}{" "}
              · {programme.affiliateCount} affiliates
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            <TextField
              label="Programme name"
              name="name"
              defaultValue={programme.name}
              required
            />
            <TextField
              label="Purchase commission (%)"
              name="purchase_commission_value"
              type="number"
              defaultValue={programme.defaultPurchaseCommissionBps / 100}
              slotProps={{ htmlInput: { min: 0, max: 100, step: "0.01" } }}
            />
            <TextField
              label="First paid-plan commission (%)"
              name="paid_plan_commission_value"
              type="number"
              defaultValue={programme.defaultFirstPaidPlanCommissionBps / 100}
              slotProps={{ htmlInput: { min: 0, max: 100, step: "0.01" } }}
            />
            <TextField
              label="Cookie window (days)"
              name="cookie_window_days"
              type="number"
              defaultValue={programme.cookieWindowDays}
              slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }}
            />
            <TextField
              label="Commission hold (days)"
              name="hold_days"
              type="number"
              defaultValue={programme.holdDays}
              slotProps={{ htmlInput: { min: 0, max: 365, step: 1 } }}
            />
            <TextField
              label="Minimum payout (GHS)"
              name="minimum_payout_value"
              type="number"
              defaultValue={programme.minimumPayoutMinor / 100}
              slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            />
            <TextField
              select
              label="Payout mode"
              name="payout_mode"
              defaultValue={programme.payoutMode}
            >
              <MenuItem value="manual">Manual reconciliation</MenuItem>
              <MenuItem value="voucher">Voucher</MenuItem>
              <MenuItem value="paystack_transfer">Paystack transfer</MenuItem>
              <MenuItem value="paystack_split">Paystack split</MenuItem>
            </TextField>
            <TextField
              select
              label="Status"
              name="status"
              defaultValue={programme.status}
              disabled={programme.isDefault}
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
          </Box>
          <input
            type="hidden"
            name="description"
            value={programme.description}
          />
          <input
            type="hidden"
            name="allowed_target_scope"
            value={programme.allowedTargetScope}
          />
          <input
            type="hidden"
            name="milestones"
            value={JSON.stringify(milestonePayload)}
          />
          {programme.isDefault && programme.milestones.length > 0 ? (
            <Stack spacing={1.25}>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>
                  Milestone ladder
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Configure the paid-referral threshold, recognition title,
                  reward, and availability.
                </Typography>
              </Box>
              {programme.milestones.map((milestone, index) => (
                <MilestoneFields
                  key={milestone.milestoneId}
                  milestone={milestone}
                  index={index}
                />
              ))}
            </Stack>
          ) : null}
          {programme.isDefault ? (
            <input type="hidden" name="status" value="active" />
          ) : null}
          <Button
            type="submit"
            variant="contained"
            sx={{ alignSelf: "flex-start" }}
          >
            Save policy
          </Button>
        </Stack>
      </Form>
    </Paper>
  );
}

function MilestoneFields({
  milestone,
  index,
}: {
  milestone: AdminAffiliateProgramme["milestones"][number];
  index: number;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: { xs: "1fr", md: "0.6fr 1fr 2fr 0.8fr" },
      }}
    >
      <TextField
        label="Paid referrals"
        type="number"
        defaultValue={milestone.threshold}
        slotProps={{ htmlInput: { min: 1, step: 1 } }}
        onChange={(event) =>
          updateMilestonePayload(
            event.currentTarget.form,
            index,
            "threshold",
            Number(event.target.value),
          )
        }
      />
      <TextField
        label="Recognition"
        defaultValue={milestone.title}
        onChange={(event) =>
          updateMilestonePayload(
            event.currentTarget.form,
            index,
            "title",
            event.target.value,
          )
        }
      />
      <TextField
        label="Configured reward"
        defaultValue={milestone.rewardDescription}
        onChange={(event) =>
          updateMilestonePayload(
            event.currentTarget.form,
            index,
            "rewardDescription",
            event.target.value,
          )
        }
      />
      <TextField
        select
        label="Status"
        defaultValue={milestone.status}
        onChange={(event) =>
          updateMilestonePayload(
            event.currentTarget.form,
            index,
            "status",
            event.target.value,
          )
        }
      >
        <MenuItem value="active">Active</MenuItem>
        <MenuItem value="paused">Paused</MenuItem>
        <MenuItem value="archived">Archived</MenuItem>
      </TextField>
    </Box>
  );
}

function updateMilestonePayload(
  form: HTMLFormElement | null,
  index: number,
  field: string,
  value: string | number,
) {
  const input = form?.elements.namedItem(
    "milestones",
  ) as HTMLInputElement | null;
  if (!input) return;
  const milestones = JSON.parse(input.value) as Record<
    string,
    string | number
  >[];
  if (!milestones[index]) return;
  milestones[index][field] = value;
  input.value = JSON.stringify(milestones);
}
