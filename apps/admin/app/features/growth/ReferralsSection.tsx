import type { AdminReferralProgramme, AdminBusiness } from "../../lib/api";
import { referralStatusOptions, referralAudienceOptions, referralRewardKindOptions, referralRefereeRewardKindOptions, referralRewardTypeOptions } from "./options";
import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import TextField from "../../components/form-text-field";
import { AdminActionFeedback } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import { DetailLine } from "../shared/DetailLine";
import { CardDetailAction } from "../shared/CardDetailAction";
import { referralAudienceLabel, referralRefereeRewardKindLabel, referralRewardKindLabel, referralRewardLabel, referralRewardTypeLabel, referralStatusColor, referralStatusLabel } from "./utils";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";
import { AdminReferralProgrammeDetailForm } from "./AdminReferralProgrammeDetailForm";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function ReferralsSection({
  programmes,
  referralProgrammesError,
  businesses,
  actionData,
}: {
  programmes: AdminReferralProgramme[];
  referralProgrammesError: string | null;
  businesses: AdminBusiness[];
  actionData?: AdminActionFeedback;
}) {
  const [showReferralCreate, setShowReferralCreate] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);
  const activeProgrammes = programmes.filter(
    (programme) => programme.status === "active",
  );
  const draftProgrammes = programmes.filter(
    (programme) => programme.status === "draft",
  );
  const pausedProgrammes = programmes.filter(
    (programme) => programme.status === "paused",
  );
  const archivedProgrammes = programmes.filter(
    (programme) => programme.status === "archived",
  );
  const issuedCodeCount = programmes.reduce(
    (total, programme) => total + programme.codes.length,
    0,
  );
  const eligibleBusinesses = businesses.filter(
    (business) =>
      business.verificationStatus === "verified" &&
      business.operationalStatus === "active",
  );
  const {
    page: referralPage,
    pageCount: referralPageCount,
    pagedItems: pagedProgrammes,
    setPage: setReferralPage,
  } = usePagedItems(programmes, 4, programmes.length);
  const selectedProgramme =
    programmes.find((programme) => programme.programmeId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Referral programmes"
        helper="Create two-sided referral programmes, control reward economics, qualifying order minimums, payout holds, date windows, and lifecycle state."
      />

      {actionData?.section === "referrals" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {referralProgrammesError ? (
        <Alert severity="warning">{referralProgrammesError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Active programmes"
          value={String(activeProgrammes.length)}
          helper="Eligible for referral links"
          trend={`${programmes.length} total`}
        />
        <MetricCard
          label="Draft"
          value={String(draftProgrammes.length)}
          helper="Not visible to customers"
          trend="Setup queue"
        />
        <MetricCard
          label="Paused"
          value={String(pausedProgrammes.length)}
          helper="Temporarily disabled"
          trend="No new rewards"
        />
        <MetricCard
          label="Issued codes"
          value={String(issuedCodeCount)}
          helper="Latest codes loaded"
          trend={`${archivedProgrammes.length} archived`}
        />
      </Box>

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
          <Form method="post">
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
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {pagedProgrammes.map((programme) => {
            const color = referralStatusColor(programme.status);
            const archived = programme.status === "archived";
            const windowText =
              programme.startsAt || programme.endsAt
                ? `${programme.startsAt ? shortTime(programme.startsAt) : "Now"} to ${
                    programme.endsAt ? shortTime(programme.endsAt) : "open"
                  }`
                : "Always available";

            return (
              <Panel
                key={programme.programmeId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(color, archived ? 0.12 : 0.2),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    color,
                    archived ? 0.035 : 0.075,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "flex-start" },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">{programme.title}</Typography>
                        <Chip
                          size="small"
                          label={programme.codePrefix}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {referralAudienceLabel(programme.audience)} ·{" "}
                        {referralRewardTypeLabel(programme.rewardType)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={referralStatusLabel(programme.status)}
                      sx={{
                        bgcolor: alpha(color, 0.12),
                        color,
                        fontWeight: 900,
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    }}
                  >
                    <DetailLine
                      label="Reward"
                      value={referralRewardLabel(programme)}
                    />
                    <DetailLine
                      label="Reward route"
                      value={`${referralRewardKindLabel(
                        programme.referrerRewardKind,
                      )} / ${referralRefereeRewardKindLabel(
                        programme.refereeRewardKind,
                      )}`}
                    />
                    <DetailLine
                      label="Minimum order"
                      value={formatGHS(programme.qualifyingOrderMinMinor)}
                    />
                    <DetailLine
                      label="Hold"
                      value={`${programme.rewardHoldDays} days`}
                    />
                    <DetailLine label="Window" value={windowText} />
                    <DetailLine
                      label="Updated"
                      value={shortTime(programme.updatedAt)}
                    />
                  </Box>

                  <CardDetailAction
                    onClick={() => setDetailID(programme.programmeId)}
                    hint={
                      programme.codes.length
                        ? `${programme.codes.length} issued code${
                            programme.codes.length === 1 ? "" : "s"
                          }`
                        : "No codes issued"
                    }
                  />
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}
      {!referralProgrammesError && programmes.length > 0 ? (
        <PaginationFooter
          count={referralPageCount}
          label="referral programmes"
          page={referralPage}
          pageSize={4}
          total={programmes.length}
          onChange={setReferralPage}
        />
      ) : null}

      <Dialog
        open={Boolean(selectedProgramme)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">
                {selectedProgramme?.title ?? "Referral programme"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Issue codes, edit reward economics, or archive.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedProgramme ? (
            <AdminReferralProgrammeDetailForm
              programme={selectedProgramme}
              eligibleBusinesses={eligibleBusinesses}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
