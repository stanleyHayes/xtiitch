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
import { AffiliateMilestonesPanel } from "./AffiliateMilestonesPanel";
import { AffiliateInvitationsPanel } from "./AffiliateInvitationsPanel";
import { AffiliateReferralsPanel } from "./AffiliateReferralsPanel";
import { AffiliateLifecycleActions } from "./AffiliateLifecycleActions";

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
      <AffiliateLifecycleActions affiliate={affiliate} />
      <AffiliateReferralsPanel
        affiliate={affiliate}
        performance={performance}
        affiliates={affiliates}
      />
      <AffiliateConversionsPanel
        affiliate={affiliate}
        performance={performance}
      />
      <AffiliatePayoutsPanel affiliate={affiliate} performance={performance} />
      <AffiliateInvitationsPanel performance={performance} />
      <AffiliateMilestonesPanel performance={performance} />
      <AffiliateEditForm affiliate={affiliate} />
    </Stack>
  );
}
