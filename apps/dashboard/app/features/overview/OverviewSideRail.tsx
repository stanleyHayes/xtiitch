import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { Link as RouterLink } from "react-router";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { StoreReadinessPanel } from "./StoreReadinessPanel";
import { TodayFocusPanel } from "./TodayFocusPanel";
import type { Profile } from "../shared/types";
import type { OverviewData } from "./useOverviewData";

// The overview section's right rail: the payout-setup nudge (when the store
// can't receive payments yet), store readiness, and today's focus list.
// Kept here so DashboardSections stays within its line budget.
export function OverviewSideRail({
  profile,
  overview,
  pendingActivation,
}: {
  profile: Profile;
  overview: OverviewData;
  pendingActivation: boolean;
}) {
  return (
    <>
      {!(profile.payout_ready ?? false) ? (
        <Alert
          severity="warning"
          icon={<PaymentsRounded />}
          action={
            <Button
              component={RouterLink}
              to="/dashboard/settings#payouts"
              color="inherit"
              size="small"
              variant="outlined"
            >
              Set up payouts
            </Button>
          }
        >
          <strong>Add your mobile money number to get paid.</strong> Until you
          do, customers can&apos;t check out — payments to your store
          won&apos;t start.
        </Alert>
      ) : null}
      <StoreReadinessPanel
        steps={overview.setupSteps}
        storefrontURL={`https://${profile.handle}.xtiitch.com`}
        verified={profile.verification_status === "verified"}
        pendingActivation={pendingActivation}
      />
      <TodayFocusPanel
        pendingPayments={overview.pendingPayments}
        needsMeasurements={overview.needsMeasurements}
        openHandovers={overview.openHandovers}
        pendingMessages={overview.pendingMessages}
      />
    </>
  );
}
