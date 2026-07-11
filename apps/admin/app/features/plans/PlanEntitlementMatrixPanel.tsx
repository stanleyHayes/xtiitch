import { Form } from "react-router";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { AdminPlan, AdminPlanEntitlementFeature } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { entitlementValueLabel, planEntitlementValue } from "./utils";



export function PlanEntitlementMatrixPanel({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  features,
  featuresError,
  plans,
}: {
  features: AdminPlanEntitlementFeature[];
  featuresError: string | null;
  plans: AdminPlan[];
}) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xs: "stretch", md: "flex-start" } }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <ShieldRounded sx={{ color: tokens.info }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">Entitlement matrix</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Package-by-package feature access, usage limits, and
                  storefront unlocks.
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Chip
            label={`${features.length} features`}
            variant="outlined"
            sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
          />
        </Stack>

        {featuresError ? (
          <Alert severity="warning">{featuresError}</Alert>
        ) : null}
        {!featuresError && plans.length === 0 ? (
          <Alert severity="info">
            Create or load plan packages before editing entitlements.
          </Alert>
        ) : null}
        {!featuresError && features.length === 0 ? (
          <Alert severity="info">
            No entitlement features have been configured yet.
          </Alert>
        ) : null}

        {!featuresError && features.length > 0 && plans.length > 0 ? (
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-plan-entitlements:update"
            />
            <Stack spacing={1.5}>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table
                  sx={{ minWidth: Math.max(840, 260 + plans.length * 210) }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 260 }}>Feature</TableCell>
                      {plans.map((plan) => (
                        <TableCell key={plan.planId} sx={{ minWidth: 210 }}>
                          <Typography sx={{ fontWeight: 900 }}>
                            {plan.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            {plan.code}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {features.map((feature) => (
                      <TableRow key={feature.featureKey} hover>
                        <TableCell sx={{ verticalAlign: "top" }}>
                          <Typography sx={{ fontWeight: 900 }}>
                            {feature.label}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {feature.description}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{ mt: 0.75, flexWrap: "wrap" }}
                          >
                            <Chip
                              size="small"
                              label={feature.category}
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={
                                feature.valueType === "limit"
                                  ? "Limit"
                                  : "Boolean"
                              }
                              variant="outlined"
                            />
                          </Stack>
                        </TableCell>
                        {plans.map((plan) => {
                          const value = planEntitlementValue(feature, plan);
                          const inputId = `${plan.planId}:${feature.featureKey}`;
                          return (
                            <TableCell
                              key={`${plan.planId}:${feature.featureKey}`}
                              sx={{ verticalAlign: "top" }}
                            >
                              <input
                                type="hidden"
                                name="entitlement_row"
                                value={JSON.stringify({
                                  planId: plan.planId,
                                  featureKey: feature.featureKey,
                                  valueType: feature.valueType,
                                })}
                              />
                              <Stack spacing={0.75}>
                                <FormControlLabel
                                  sx={{ m: 0 }}
                                  control={
                                    <Checkbox
                                      name={`enabled:${inputId}`}
                                      size="small"
                                      defaultChecked={Boolean(value?.enabled)}
                                    />
                                  }
                                  label={entitlementValueLabel(feature, plan)}
                                />
                                {feature.valueType === "limit" ? (
                                  <TextField
                                    name={`limit:${inputId}`}
                                    type="number"
                                    size="small"
                                    label={feature.unit || "Limit"}
                                    defaultValue={value?.limitValue ?? ""}
                                    placeholder="Unlimited"
                                    slotProps={{
                                      htmlInput: { min: 0, step: 1 },
                                    }}
                                  />
                                ) : null}
                              </Stack>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<CheckCircleRounded />}
                >
                  Save matrix
                </Button>
              </Stack>
            </Stack>
          </Form>
        ) : null}
      </Stack>
    </Panel>
  );
}
