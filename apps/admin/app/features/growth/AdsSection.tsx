import type { AdminAdCampaign, AdminBusiness } from "../../lib/api";
import { adPlacementOptions, adCampaignStatusOptions } from "./options";
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
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CampaignRounded from "@mui/icons-material/CampaignRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import TextField from "../../components/form-text-field";
import { AdminActionFeedback } from "../shared/types";
import { formatGHS, formatPercentBps } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import { DetailLine } from "../shared/DetailLine";
import { CardDetailAction } from "../shared/CardDetailAction";
import { adCampaignStatusColor, adCampaignStatusLabel, adPlacementLabel } from "./utils";
import { FormGroupLabel } from "../shared/FormGroupLabel";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";
import { AdminAdCampaignDetailForm } from "./AdminAdCampaignDetailForm";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function AdsSection({
  campaigns,
  adCampaignsError,
  businesses,
  actionData,
}: {
  campaigns: AdminAdCampaign[];
  adCampaignsError: string | null;
  businesses: AdminBusiness[];
  actionData?: AdminActionFeedback;
}) {
  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);
  const eligibleBusinesses = businesses.filter(
    (business) =>
      business.verificationStatus === "verified" &&
      business.operationalStatus === "active",
  );
  const pendingCampaigns = campaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "active",
  );
  const completedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "completed",
  );
  const bookedMinor = campaigns.reduce(
    (total, campaign) => total + campaign.budgetMinor,
    0,
  );
  const collectedMinor = campaigns.reduce(
    (total, campaign) =>
      total +
      campaign.payments.reduce(
        (paymentTotal, payment) =>
          paymentTotal + (payment.status === "paid" ? payment.amountMinor : 0),
        0,
      ),
    0,
  );
  const openPaymentMinor = campaigns.reduce(
    (total, campaign) =>
      total +
      campaign.payments.reduce(
        (paymentTotal, payment) =>
          paymentTotal +
          (payment.status === "initiated" ? payment.amountMinor : 0),
        0,
      ),
    0,
  );
  const impressions = campaigns.reduce(
    (total, campaign) => total + campaign.impressionCount,
    0,
  );
  const clicks = campaigns.reduce(
    (total, campaign) => total + campaign.clickCount,
    0,
  );
  const {
    page: adPage,
    pageCount: adPageCount,
    pagedItems: pagedCampaigns,
    setPage: setAdPage,
  } = usePagedItems(campaigns, 4, campaigns.length);
  const selectedCampaign =
    campaigns.find((campaign) => campaign.campaignId === detailID) ?? null;

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Growth controls"
        title="Sponsored placements"
        helper="Review paid featured businesses, promoted designs, homepage slots, date windows, and prepaid budgets."
      />

      {actionData?.section === "ads" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          {actionData.message}
        </Alert>
      ) : null}
      {adCampaignsError ? (
        <Alert severity="warning">{adCampaignsError}</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <MetricCard
          label="Pending review"
          value={String(pendingCampaigns.length)}
          helper="Needs operator decision"
          trend={`${campaigns.length} total campaigns`}
        />
        <MetricCard
          label="Active placements"
          value={String(activeCampaigns.length)}
          helper="Visible inside active windows"
          trend={`${completedCampaigns.length} completed`}
        />
        <MetricCard
          label="Collected budget"
          value={formatGHS(collectedMinor)}
          helper={`${formatGHS(bookedMinor)} booked campaign value`}
          trend={
            openPaymentMinor > 0
              ? `${formatGHS(openPaymentMinor)} open`
              : "Paystack ready"
          }
        />
        <MetricCard
          label="Engagement"
          value={formatPercentBps(
            impressions > 0 ? (clicks / impressions) * 10000 : 0,
          )}
          helper={`${impressions} impressions · ${clicks} clicks`}
          trend="Server event rollup"
        />
      </Box>

      {!adCampaignsError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create placement</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Only verified active businesses can be selected.
              </Typography>
            </Box>
            <Button
              variant={adDialogOpen ? "outlined" : "contained"}
              startIcon={<CampaignRounded />}
              endIcon={
                <KeyboardArrowDownRounded
                  sx={{
                    transition: "transform 0.2s ease",
                    transform: adDialogOpen ? "rotate(180deg)" : "none",
                  }}
                />
              }
              disabled={eligibleBusinesses.length === 0}
              onClick={() => setAdDialogOpen((open) => !open)}
              aria-expanded={adDialogOpen}
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            >
              {adDialogOpen ? "Close form" : "New placement"}
            </Button>
          </Stack>
          {eligibleBusinesses.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              No verified active businesses are eligible for sponsored placement
              yet.
            </Alert>
          ) : null}
          <Collapse in={adDialogOpen} unmountOnExit>
            <Box
              sx={{
                mt: 2,
                pt: 2,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 950 }}>
                  Create ad placement
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Set the business, placement, budget, and review note.
                </Typography>
              </Box>
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="admin-ad-campaign:create"
                />
                <input type="hidden" name="pricing_model" value="flat_time" />
                <Stack spacing={2}>
                  <FormGroupLabel>Campaign</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                        xl: "1.2fr 1fr 1fr 1fr",
                      },
                    }}
                  >
                    <TextField
                      select
                      label="Business"
                      name="business_id"
                      size="small"
                      required
                      disabled={eligibleBusinesses.length === 0}
                      defaultValue={eligibleBusinesses[0]?.id ?? ""}
                    >
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
                      defaultValue="featured_business"
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
                      placeholder="Design ID when promoted design"
                    />
                    <TextField
                      select
                      label="Status"
                      name="status"
                      size="small"
                      defaultValue="pending_review"
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
                      required
                    />
                  </Box>
                  <FormGroupLabel>Budget &amp; schedule</FormGroupLabel>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        xl: "repeat(4, minmax(0, 1fr))",
                      },
                    }}
                  >
                    <TextField
                      label="Budget"
                      name="budget_ghs"
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
                      label="Daily cap"
                      name="daily_cap_ghs"
                      type="number"
                      size="small"
                      placeholder="Optional"
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
                    <StyledDateTimeField
                      label="Starts"
                      name="starts_at"
                      size="small"
                      required
                    />
                    <StyledDateTimeField
                      label="Ends"
                      name="ends_at"
                      size="small"
                      required
                    />
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    }}
                  >
                    <TextField
                      label="Description"
                      name="description"
                      multiline
                      minRows={2}
                      size="small"
                    />
                    <TextField
                      label="Review note"
                      name="review_note"
                      multiline
                      minRows={2}
                      size="small"
                    />
                  </Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => setAdDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<CampaignRounded />}
                      disabled={eligibleBusinesses.length === 0}
                    >
                      Create placement
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            </Box>
          </Collapse>
        </Panel>
      ) : null}

      {!adCampaignsError && campaigns.length === 0 ? (
        <Alert severity="info">
          No sponsored placement campaigns are configured yet.
        </Alert>
      ) : null}

      {!adCampaignsError && campaigns.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
            alignItems: "start",
          }}
        >
          {pagedCampaigns.map((campaign) => {
            const archived = campaign.status === "archived";
            const color = adCampaignStatusColor(campaign.status);
            const paidMinor = campaign.payments.reduce(
              (total, payment) =>
                total + (payment.status === "paid" ? payment.amountMinor : 0),
              0,
            );
            const dueMinor = Math.max(campaign.budgetMinor - paidMinor, 0);
            const openPayment = campaign.payments.find(
              (payment) => payment.status === "initiated",
            );
            return (
              <Panel
                key={campaign.campaignId}
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
                        <Typography variant="h6">
                          {campaign.headline}
                        </Typography>
                        <Chip
                          size="small"
                          label={adPlacementLabel(campaign.placementType)}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.5, color: "text.secondary" }}
                      >
                        {campaign.businessName} · {campaign.businessHandle}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={adCampaignStatusLabel(campaign.status)}
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
                    <DetailLine label="Target" value={campaign.targetLabel} />
                    <DetailLine
                      label="Budget"
                      value={`${formatGHS(paidMinor)} collected / ${formatGHS(
                        campaign.budgetMinor,
                      )} booked`}
                    />
                    <DetailLine
                      label="Daily cap"
                      value={
                        typeof campaign.dailyCapMinor === "number"
                          ? formatGHS(campaign.dailyCapMinor)
                          : "No cap"
                      }
                    />
                    <DetailLine
                      label="Window"
                      value={`${shortTime(campaign.startsAt)} - ${shortTime(
                        campaign.endsAt,
                      )}`}
                    />
                    <DetailLine
                      label="Impressions"
                      value={`${campaign.impressionCount} views`}
                    />
                    <DetailLine
                      label="Clicks"
                      value={`${campaign.clickCount} · ${formatPercentBps(
                        campaign.clickRateBps,
                      )}`}
                    />
                  </Box>

                  <CardDetailAction
                    onClick={() => setDetailID(campaign.campaignId)}
                    hint={
                      openPayment
                        ? "Payment link open"
                        : dueMinor > 0
                          ? `${formatGHS(dueMinor)} due · awaiting collection`
                          : "Budget collected"
                    }
                  />
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}
      {!adCampaignsError && campaigns.length > 0 ? (
        <PaginationFooter
          count={adPageCount}
          label="placements"
          page={adPage}
          pageSize={4}
          total={campaigns.length}
          onChange={setAdPage}
        />
      ) : null}

      <Dialog
        open={Boolean(selectedCampaign)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">
                {selectedCampaign?.headline ?? "Placement details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Collect payment, edit the placement, or archive it.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedCampaign ? (
            <AdminAdCampaignDetailForm
              campaign={selectedCampaign}
              eligibleBusinesses={eligibleBusinesses}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
