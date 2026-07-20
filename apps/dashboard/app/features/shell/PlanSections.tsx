import { AnalyticsSection } from "../analytics/AnalyticsSection";
import { CrmSection } from "../crm/CrmSection";
import type { DashboardActionData, Profile } from "../shared/types";
import type { AnalyticsData } from "../analytics/types";
import type { CrmData } from "../crm/types";

export type PlanSectionData = {
  analytics: AnalyticsData;
  crm: CrmData;
};

// The §14/§15 plan-laddered sections, kept out of DashboardSections (which is
// at its size budget). Both are management-only: parseDashboardSection
// redirects staff away before this ever renders, so no canManage guard here.
export function PlanSections({
  section,
  profile,
  data,
  action,
}: {
  section: string;
  profile: Profile;
  data: PlanSectionData;
  action: DashboardActionData;
}) {
  if (section === "analytics") {
    return (
      <AnalyticsSection
        profile={profile}
        data={data.analytics}
        scheduleError={action.analyticsError}
      />
    );
  }
  if (section === "customers") {
    return <CrmSection profile={profile} data={data.crm} action={action} />;
  }
  return null;
}
