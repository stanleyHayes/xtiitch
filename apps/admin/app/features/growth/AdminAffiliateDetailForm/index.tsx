import Stack from "@mui/material/Stack";
import type { AdminAffiliate, AdminAffiliateAttribution } from "../../../lib/api";
import { AffiliateSummary } from "./AffiliateSummary";
import { AffiliateConversionsPanel } from "./AffiliateConversionsPanel";
import { AffiliatePayoutsPanel } from "./AffiliatePayoutsPanel";
import { AffiliateEditForm } from "./AffiliateEditForm";
import { AffiliateArchiveForm } from "./AffiliateArchiveForm";

export function AdminAffiliateDetailForm({
  affiliate,
  performance,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
}) {
  return (
    <Stack spacing={2}>
      <AffiliateSummary affiliate={affiliate} performance={performance} />
      <AffiliateConversionsPanel
        affiliate={affiliate}
        performance={performance}
      />
      <AffiliatePayoutsPanel affiliate={affiliate} performance={performance} />
      <AffiliateEditForm affiliate={affiliate} />
      <AffiliateArchiveForm affiliate={affiliate} />
    </Stack>
  );
}
