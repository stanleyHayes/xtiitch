import { loadDashboardJSON } from "../shared/api";
import {
  defaultBusinessAffiliateData,
  type BusinessAffiliate,
  type BusinessAffiliateAttribution,
  type BusinessAffiliateData,
  type BusinessAffiliateProgramme,
} from "./types";

export async function loadBusinessAffiliateData(
  request: Request,
): Promise<{ data: BusinessAffiliateData; warnings: string[] }> {
  const [programmesResult, affiliatesResult, attributionResult] =
    await Promise.all([
      loadDashboardJSON<{ programmes: BusinessAffiliateProgramme[] }>(
        request,
        "/business/affiliate-programmes",
        { programmes: [] },
        "Affiliate programmes could not be loaded right now.",
      ),
      loadDashboardJSON<{ affiliates: BusinessAffiliate[] }>(
        request,
        "/business/affiliates",
        { affiliates: [] },
        "Affiliate roster could not be loaded right now.",
      ),
      loadDashboardJSON<{ attribution: BusinessAffiliateAttribution[] }>(
        request,
        "/business/affiliate-attribution",
        { attribution: [] },
        "Affiliate performance could not be loaded right now.",
      ),
    ]);
  const warnings = [
    programmesResult.warning,
    affiliatesResult.warning,
    attributionResult.warning,
  ].filter((warning): warning is string => Boolean(warning));
  return {
    data: {
      ...defaultBusinessAffiliateData,
      programmes: programmesResult.data.programmes ?? [],
      affiliates: affiliatesResult.data.affiliates ?? [],
      attribution: attributionResult.data.attribution ?? [],
    },
    warnings,
  };
}
