import Stack from "@mui/material/Stack";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
  AdminPartnerMilestone,
} from "../../../lib/api";
import { AffiliateSummary } from "./AffiliateSummary";
import { AffiliateConversionsPanel } from "./AffiliateConversionsPanel";
import { AffiliatePayoutsPanel } from "./AffiliatePayoutsPanel";
import { AffiliateEditForm } from "./AffiliateEditForm";
import { AffiliateArchiveForm } from "./AffiliateArchiveForm";

export function AdminAffiliateDetailForm({
  affiliate,
  performance,
  affiliates,
  milestones,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
  affiliates: AdminAffiliate[];
  milestones: AdminPartnerMilestone[];
}) {
  return (
    <Stack spacing={2}>
      <AffiliateSummary
        affiliate={affiliate}
        performance={performance}
        milestones={milestones}
      />
      <AffiliateConversionsPanel
        affiliate={affiliate}
        performance={performance}
        affiliates={affiliates}
      />
      <AffiliatePayoutsPanel affiliate={affiliate} performance={performance} />
      <AffiliateEditForm affiliate={affiliate} />
      <AffiliateArchiveForm affiliate={affiliate} />
    </Stack>
  );
}
