export * from "./growth-promotions";
export * from "./growth-ads";
export * from "./growth-affiliates";
export * from "./growth-affiliate-applications";
export * from "./growth-affiliate-programmes";
export * from "./growth-referrals";
export * from "./growth-report";

import { promotionsApi } from "./growth-promotions";
import { adsApi } from "./growth-ads";
import { affiliatesApi } from "./growth-affiliates";
import { affiliateApplicationsApi } from "./growth-affiliate-applications";
import { affiliateProgrammesApi } from "./growth-affiliate-programmes";
import { referralsApi } from "./growth-referrals";
import { growthReportApi } from "./growth-report";

export const growthApi = {
  ...promotionsApi,
  ...adsApi,
  ...affiliatesApi,
  ...affiliateApplicationsApi,
  ...affiliateProgrammesApi,
  ...referralsApi,
  ...growthReportApi,
};
