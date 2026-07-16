import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import TextField from "../../../components/form-text-field";
import type { AdminPlan } from "../../shared/types";
import { PLAN_BENEFITS } from "../../../lib/api";
import { formatGHS } from "../../shared/formatting";
import { Panel } from "../../../components/ui/Panel";
import { PlanStatTile } from "../../plans/PlanStatTile";
import { PlanCadenceFields } from "../../plans/PlanCadenceFields";
import { FormGroupLabel } from "../../shared/FormGroupLabel";
import {
  grantedPlanBenefitKeys,
  planDesignLimitLabel,
  planVisualFor,
  planYearlyFeeDefault,
} from "../../plans/utils";

export function PlanCard({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  plan,
  dialogOpen,
  onDialogChange,
}: {
  plan: AdminPlan;
  dialogOpen: boolean;
  onDialogChange: (open: boolean) => void;
}) {
  const visual = planVisualFor(plan.code);
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(visual.tone, plan.isActive ? 0.2 : 0.12),
        backgroundImage: `linear-gradient(180deg, ${alpha(
          visual.tone,
          plan.isActive ? 0.075 : 0.035,
        )}, transparent 42%)`,
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {plan.name}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary" }}
            >
              {plan.businessCount} businesses ·{" "}
              {plan.activeSubscriptionCount} active subscriptions
            </Typography>
          </Box>
          <Chip
            size="small"
            label={plan.isActive ? "Active" : "Archived"}
            color={plan.isActive ? "success" : "default"}
            variant={plan.isActive ? "filled" : "outlined"}
          />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(5, minmax(0, 1fr))",
            },
          }}
        >
          <PlanStatTile
            label="Monthly fee"
            value={formatGHS(plan.monthlyFeeMinor)}
          />
          <PlanStatTile
            label="Yearly fee"
            value={formatGHS(plan.yearlyFeeMinor)}
          />
          <PlanStatTile
            label="Commission"
            value={`${plan.commissionBps / 100}%`}
          />
          <PlanStatTile
            label="Design limit"
            value={planDesignLimitLabel(plan)}
          />
          <PlanStatTile
            label="Monthly recurring"
            value={formatGHS(plan.estimatedMrrMinor)}
          />
        </Box>
        <Box sx={{ mt: 1.5 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "text.secondary",
              mb: 0.75,
            }}
          >
            Benefits
          </Typography>
          {grantedPlanBenefitKeys(plan.features).length > 0 ? (
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 0.75 }}
            >
              {PLAN_BENEFITS.filter(
                (benefit) => plan.features[benefit.key],
              ).map((benefit) => (
                <Chip
                  key={benefit.key}
                  size="small"
                  label={benefit.label}
                  variant="outlined"
                />
              ))}
            </Stack>
          ) : (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary" }}
            >
              No storefront-customization benefits.
            </Typography>
          )}
        </Box>
        <Button
          type="button"
          variant="outlined"
          startIcon={<SettingsRounded />}
          onClick={() => onDialogChange(true)}
          sx={{ alignSelf: "flex-start" }}
        >
          Edit package
        </Button>
        <Dialog
          open={dialogOpen}
          onClose={() => onDialogChange(false)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Stack
              direction="row"
              spacing={1.25}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="span"
                  sx={{ display: "block", fontWeight: 950 }}
                >
                  Edit {plan.name}
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  Update package pricing, limits, and availability.
                </Typography>
              </Box>
              <IconButton
                aria-label="Close"
                onClick={() => onDialogChange(false)}
              >
                <CloseRounded />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.25}>
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-plan:update"
                />
                <input
                  type="hidden"
                  name="plan_id"
                  value={plan.planId}
                />
                <Stack spacing={2}>
                  <Box>
                    <FormGroupLabel>Package details</FormGroupLabel>
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        },
                      }}
                    >
                      <TextField
                        label="Name"
                        name="name"
                        size="small"
                        defaultValue={plan.name}
                        required
                      />
                      <TextField
                        label="Code"
                        size="small"
                        defaultValue={plan.code}
                        disabled
                      />
                    </Box>
                  </Box>
                  <Box>
                    <FormGroupLabel>Pricing & limits</FormGroupLabel>
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                          lg: "repeat(4, minmax(0, 1fr))",
                        },
                      }}
                    >
                      <PlanCadenceFields plan={plan} />
                      <TextField
                        label="Yearly fee"
                        name="yearly_fee_ghs"
                        type="number"
                        size="small"
                        defaultValue={planYearlyFeeDefault(plan)}
                        helperText="Upfront annual price"
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                GHS
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { min: 0, step: "0.01" },
                        }}
                      />
                      <TextField
                        label="Commission"
                        name="commission_bps"
                        type="number"
                        size="small"
                        defaultValue={plan.commissionBps}
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                bps
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { min: 0, max: 10000, step: 1 },
                        }}
                      />
                      <TextField
                        select
                        label="Status"
                        name="is_active"
                        size="small"
                        defaultValue={String(plan.isActive)}
                      >
                        <MenuItem value="true">Active</MenuItem>
                        <MenuItem value="false">Archived</MenuItem>
                      </TextField>
                    </Box>
                  </Box>
                  {/* Benefits and the design limit are edited in the feature
                      entitlements matrix below, which is their source of truth.
                      They used to be editable here too, and because this dialog
                      always posted a full benefit set, saving it for any reason
                      silently reset whatever the matrix had configured. */}
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Benefits and limits for this plan are set in the feature
                    entitlements matrix below.
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => onDialogChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained">
                      Save package
                    </Button>
                  </Stack>
                </Stack>
              </Form>
              <Divider />
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-plan:archive"
                />
                <input
                  type="hidden"
                  name="plan_id"
                  value={plan.planId}
                />
                <Stack spacing={1.25}>
                  <FormGroupLabel>Archive package</FormGroupLabel>
                  <TextField
                    label="Archive reason"
                    name="reason"
                    size="small"
                    placeholder="Replaced by new package"
                    fullWidth
                    disabled={!plan.isActive}
                  />
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      type="submit"
                      variant="outlined"
                      color="warning"
                      disabled={!plan.isActive}
                    >
                      Archive package
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            </Stack>
          </DialogContent>
        </Dialog>
      </Stack>
    </Panel>
  );
}
