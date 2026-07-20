import type { AdminAdCampaign, AdminBusiness } from "../../../lib/api";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { AdminActionFeedback } from "../../shared/types";
import { formatGHS, formatPercentBps } from "../../shared/formatting";
import { MetricCard } from "../../../components/ui/MetricCard";
import { usePagedItems } from "../../shared/usePagedItems";
import { useActionSuccess } from "../../shared/useActionSuccess";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { AdminAdCampaignDetailForm } from "../AdminAdCampaignDetailForm";
import { AdCampaignTable } from "./AdCampaignTable";

export function AdsSection({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
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
  const [detailID, setDetailID] = useState<string | null>(null);

  // §1.2/§11.4: the placement dialog closes on any successful ads action
  // (create, payment, edit, archive); errors stay open with input intact.
  const actionSuccess = useActionSuccess("ads");
  useEffect(() => {
    if (actionSuccess) {
      setDetailID(null);
    }
  }, [actionSuccess]);

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

      <AdCampaignTable
        campaigns={campaigns}
        pagedCampaigns={pagedCampaigns}
        businesses={businesses}
        page={adPage}
        pageCount={adPageCount}
        onPageChange={setAdPage}
        onSelect={setDetailID}
        adCampaignsError={adCampaignsError}
      />

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
              eligibleBusinesses={businesses.filter(
                (business) =>
                  business.verificationStatus === "verified" &&
                  business.operationalStatus === "active",
              )}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
