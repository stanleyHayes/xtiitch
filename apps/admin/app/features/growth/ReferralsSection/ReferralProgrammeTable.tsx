import { Form } from "react-router";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SyncRounded from "@mui/icons-material/SyncRounded";
import type { AdminReferralProgramme } from "../../../lib/api";
import TextField from "../../../components/form-text-field";
import { Panel } from "../../../components/ui/Panel";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import { StyledDateTimeField } from "../../shared/StyledDateTimeField";
import {
  useActionSuccess,
  useFormResetKey,
} from "../../shared/useActionSuccess";
import {
  referralAudienceOptions,
  referralRefereeRewardKindOptions,
  referralRewardKindOptions,
  referralRewardTypeOptions,
  referralStatusOptions,
} from "../options";
import { ReferralDetail } from "./ReferralDetail";

export function ReferralProgrammeTable({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  programmes,
  pagedProgrammes,
  page,
  pageCount,
  onPageChange,
  onSelect,
  referralProgrammesError,
}: {
  programmes: AdminReferralProgramme[];
  pagedProgrammes: AdminReferralProgramme[];
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onSelect: (programmeId: string) => void;
  referralProgrammesError: string | null;
}) {
  const [showReferralCreate, setShowReferralCreate] = useState(false);

  // §1.2/§11.4: the create disclosure closes on a successful submit (its
  // Collapse unmounts the fields), and the always-visible issue form
  // re-mounts cleared via the reset key.
  const actionSuccess = useActionSuccess("referrals");
  const issueResetKey = useFormResetKey("referrals");
  useEffect(() => {
    if (actionSuccess) {
      setShowReferralCreate(false);
    }
  }, [actionSuccess]);

  return (
    <>
      {!referralProgrammesError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-referral-programme:create"
            />
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Typography variant="h6">
                    Create referral programme
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Define the code prefix and the rewards for both sides of the
                    invitation.
                  </Typography>
                </Box>
                <Button
                  type="button"
                  variant={showReferralCreate ? "outlined" : "contained"}
                  onClick={() => setShowReferralCreate((value) => !value)}
                >
                  {showReferralCreate ? "Cancel" : "New programme"}
                </Button>
              </Stack>
              <Collapse in={showReferralCreate} unmountOnExit>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                    }}
                  >
                    <TextField label="Title" name="title" required />
                    <TextField
                      label="Code prefix"
                      name="code_prefix"
                      required
                      placeholder="REF"
                    />
                    <TextField
                      select
                      label="Audience"
                      name="audience"
                      defaultValue="customers"
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
                      defaultValue="voucher"
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
                      defaultValue="voucher"
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
                      defaultValue="fixed"
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
                      required
                      defaultValue={25}
                      slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    />
                    <TextField
                      label="Percentage cap (GHS)"
                      name="max_reward_ghs"
                      type="number"
                      defaultValue={50}
                      slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    />
                    <TextField
                      label="Minimum order (GHS)"
                      name="qualifying_order_min_ghs"
                      type="number"
                      defaultValue={150}
                      slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    />
                    <TextField
                      label="Reward hold days"
                      name="reward_hold_days"
                      type="number"
                      defaultValue={14}
                      slotProps={{ htmlInput: { min: 0, max: 180, step: 1 } }}
                    />
                    <TextField
                      select
                      label="Status"
                      name="status"
                      defaultValue="draft"
                    >
                      {referralStatusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    }}
                  >
                    <StyledDateTimeField label="Starts" name="starts_at" />
                    <StyledDateTimeField label="Ends" name="ends_at" />
                  </Box>
                  <TextField label="Notes" name="notes" multiline minRows={2} />
                  <Button
                    type="submit"
                    variant="contained"
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Create programme
                  </Button>
                </Stack>
              </Collapse>
            </Stack>
          </Form>
        </Panel>
      ) : null}

      {!referralProgrammesError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Form method="post" key={issueResetKey}>
            <input
              type="hidden"
              name="intent"
              value="admin-referral-rewards:issue"
            />
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              sx={{
                justifyContent: "space-between",
                alignItems: { lg: "end" },
              }}
            >
              <Box sx={{ maxWidth: 760 }}>
                <Typography variant="h6">Issue due rewards</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Runs the idempotent reward issuer for qualified referrals that
                  have passed their hold window. Voucher rewards become
                  single-use promotion codes; commission rebates stay pending
                  for finance review.
                </Typography>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                sx={{ width: { xs: "100%", lg: "auto" } }}
              >
                <TextField
                  label="Batch limit"
                  name="limit"
                  type="number"
                  size="small"
                  defaultValue={50}
                  sx={{ minWidth: { sm: 150 } }}
                  slotProps={{ htmlInput: { min: 1, max: 500, step: 1 } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SyncRounded />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Issue rewards
                </Button>
              </Stack>
            </Stack>
          </Form>
        </Panel>
      ) : null}

      {!referralProgrammesError && programmes.length === 0 ? (
        <Alert severity="info">
          No referral programmes are registered yet.
        </Alert>
      ) : null}

      {!referralProgrammesError && programmes.length > 0 ? (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            }}
          >
            {pagedProgrammes.map((programme) => (
              <ReferralDetail
                key={programme.programmeId}
                programme={programme}
                onOpen={() => onSelect(programme.programmeId)}
              />
            ))}
          </Box>
          <PaginationFooter
            count={pageCount}
            label="referral programmes"
            page={page}
            pageSize={4}
            total={programmes.length}
            onChange={onPageChange}
          />
        </>
      ) : null}
    </>
  );
}
