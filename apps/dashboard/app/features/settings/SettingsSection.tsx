import { PayoutSetupPanel } from "./PayoutSetupPanel";
import { BusinessVerificationPanel } from "./BusinessVerificationPanel";
import { StoreSettingsPanel } from "./StoreSettingsPanel";
import { DeliveryZonesPanel } from "./DeliveryZonesPanel";
import { WaitlistEntriesPanel } from "./WaitlistEntriesPanel";
import type { DashboardActionData, DeliveryZone, Profile, StoreSettings, WaitlistEntry } from "../shared/types";

export function SettingsSection({
  profile,
  storeSettings,
  deliveryZones,
  waitlistEntries,
  action,
  pendingActivation,
}: {
  profile: Profile;
  storeSettings: StoreSettings;
  deliveryZones: DeliveryZone[];
  waitlistEntries: WaitlistEntry[];
  action: DashboardActionData;
  pendingActivation: boolean;
}) {
  return (
    <>
      <PayoutSetupPanel
        provisioned={profile.payout_ready ?? false}
        verified={profile.verification_status === "verified"}
        settlementBank={profile.settlement_bank}
        settlementAccount={profile.settlement_account}
        error={action.payoutError}
        success={action.payoutSuccess}
      />
      <BusinessVerificationPanel
        status={profile.verification_status}
        error={action.verificationError}
        success={action.verificationSuccess}
      />
      <StoreSettingsPanel
        settings={storeSettings}
        profile={profile}
        error={action.settingsError}
        pendingActivation={pendingActivation}
      />
      {storeSettings.delivery_enabled ? (
        <DeliveryZonesPanel
          zones={deliveryZones}
          error={action.settingsError}
          success={action.settingsSuccess}
        />
      ) : null}
      {(profile.entitlements ?? {}).design_waitlist ? (
        <WaitlistEntriesPanel entries={waitlistEntries} />
      ) : null}
    </>
  );
}
