import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import TextField from "../../../components/form-text-field";
import type { AdminPlan } from "../../shared/types";
import { FormGroupLabel } from "../../shared/FormGroupLabel";
import { PlanBenefitsField } from "../../plans/PlanBenefitsField";
import { Panel } from "../../../components/ui/Panel";

export function BillingPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  plans,
  plansError,
  createPlanOpen,
  onCreateOpenChange,
}: {
  plans: AdminPlan[];
  plansError: string | null;
  createPlanOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <Stack spacing={1}>
        <Typography variant="h6">Package controls</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Define the packages businesses can be assigned to. Archive old
          packages instead of deleting them so existing businesses keep their
          history.
        </Typography>
      </Stack>
      {plansError ? <Alert severity="warning">{plansError}</Alert> : null}
      {!plansError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Add a package</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Create a new billing tier only when you need one.
              </Typography>
            </Box>
            <Button
              type="button"
              variant="contained"
              startIcon={<WorkspacePremiumRounded />}
              onClick={() => onCreateOpenChange(true)}
              sx={{ alignSelf: { xs: "stretch", md: "center" } }}
            >
              New package
            </Button>
          </Stack>
          <Dialog
            open={createPlanOpen}
            onClose={() => onCreateOpenChange(false)}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle sx={{ pb: 0.5 }}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    component="span"
                    sx={{ display: "block", fontWeight: 950 }}
                  >
                    Create package
                  </Typography>
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ display: "block", color: "text.secondary" }}
                  >
                    Add a package definition for future business assignments.
                  </Typography>
                </Box>
                <IconButton
                  aria-label="Close"
                  onClick={() => onCreateOpenChange(false)}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Form method="post">
                <input type="hidden" name="intent" value="admin-plan:create" />
                <Stack spacing={2}>
                  <Box>
                    <FormGroupLabel>Identity</FormGroupLabel>
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
                        label="Code"
                        name="code"
                        placeholder="pro-plus"
                        size="small"
                        required
                      />
                      <TextField
                        label="Name"
                        name="name"
                        placeholder="Pro Plus"
                        size="small"
                        required
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
                          md: "repeat(4, minmax(0, 1fr))",
                        },
                      }}
                    >
                      <TextField
                        label="Monthly fee"
                        name="monthly_fee_ghs"
                        type="number"
                        size="small"
                        defaultValue="0.00"
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
                        label="Yearly fee"
                        name="yearly_fee_ghs"
                        type="number"
                        size="small"
                        defaultValue="0.00"
                        helperText="Used when a business pays for a year upfront."
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
                        defaultValue="100"
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
                        label="Design limit"
                        name="design_limit"
                        type="number"
                        size="small"
                        placeholder="Unlimited"
                        slotProps={{ htmlInput: { min: 0, step: 1 } }}
                      />
                    </Box>
                  </Box>
                  <PlanBenefitsField />
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => onCreateOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<WorkspacePremiumRounded />}
                    >
                      Create package
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            </DialogContent>
          </Dialog>
        </Panel>
      ) : null}
      {!plansError && plans.length === 0 ? (
        <Alert severity="info">
          No editable plan packages are available yet; showing the default
          package model below.
        </Alert>
      ) : null}
    </>
  );
}
