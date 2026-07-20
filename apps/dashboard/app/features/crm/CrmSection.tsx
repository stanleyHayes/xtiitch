import { useEffect, useState } from "react";
import GroupRounded from "@mui/icons-material/GroupRounded";
import { crmLevel } from "../../lib/entitlements";
import { UpgradeNudge } from "../../components/ui/UpgradeNudge";
import type { DashboardActionData, Profile } from "../shared/types";
import type { CrmCustomerRow, CrmData } from "./types";
import { InsightsStrip } from "./InsightsStrip";
import { CustomerListPanel } from "./CustomerListPanel";
import { CustomerProfileDrawer } from "./CustomerProfileDrawer";

// §15 Customer CRM — the whole level-laddered section. Every plan gets the
// auto-built list and the full profile; Starter adds search, spend/counts and
// notes; Growth adds tags, filters, the insights strip and export; Studio
// exports any format. Tenant scoping is enforced by the API (§15.3) — the
// dashboard simply never requests another store's data.
export function CrmSection({
  profile,
  data,
  action,
}: {
  profile: Profile;
  data: CrmData;
  action: DashboardActionData;
}) {
  const level = crmLevel(profile.entitlement_limits);
  const [openCustomer, setOpenCustomer] = useState<CrmCustomerRow | null>(null);
  // Bumped when a note/tag save succeeds so the open drawer refetches its
  // profile (§1.2: the interface refreshes itself after a successful submit).
  const [saveTick, setSaveTick] = useState("");
  useEffect(() => {
    if (action.crmSuccess) {
      setSaveTick(`${Date.now()}`);
    }
  }, [action]);

  return (
    <>
      {level >= 2 && data.insights ? (
        <InsightsStrip insights={data.insights} />
      ) : null}
      {level === 1 ? (
        <UpgradeNudge
          icon={<GroupRounded />}
          title="Tags, segments and win-back insights"
          description="Growth organises the list: tags like VIP or wholesale, filters by spend and last order, new-vs-returning and lapsed-customer insights, and CSV export."
          requiredPlan="Growth"
        />
      ) : null}
      <CustomerListPanel
        profile={profile}
        level={level}
        data={data}
        onOpenCustomer={setOpenCustomer}
      />
      <CustomerProfileDrawer
        customer={openCustomer}
        onClose={() => setOpenCustomer(null)}
        saveTick={saveTick}
        error={action.crmError}
      />
    </>
  );
}
