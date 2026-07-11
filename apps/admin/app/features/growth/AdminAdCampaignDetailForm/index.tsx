import Stack from "@mui/material/Stack";
import type { AdminAdCampaign, AdminBusiness } from "../../../lib/api";
import { AdCampaignSummary } from "./AdCampaignSummary";
import { AdCampaignPaymentPanel } from "./AdCampaignPaymentPanel";
import { AdCampaignEditForm } from "./AdCampaignEditForm";
import { AdCampaignArchiveForm } from "./AdCampaignArchiveForm";

export function AdminAdCampaignDetailForm({
  campaign,
  eligibleBusinesses,
}: {
  campaign: AdminAdCampaign;
  eligibleBusinesses: AdminBusiness[];
}) {
  return (
    <Stack spacing={2}>
      <AdCampaignSummary campaign={campaign} />
      <AdCampaignPaymentPanel campaign={campaign} />
      <AdCampaignEditForm
        campaign={campaign}
        eligibleBusinesses={eligibleBusinesses}
      />
      <AdCampaignArchiveForm campaign={campaign} />
    </Stack>
  );
}
