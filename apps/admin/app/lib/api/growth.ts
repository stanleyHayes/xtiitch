export * from "./growth-promotions";
export * from "./growth-ads";
export * from "./growth-affiliates";
export * from "./growth-referrals";

import { promotionsApi } from "./growth-promotions";
import { adsApi } from "./growth-ads";
import { affiliatesApi } from "./growth-affiliates";
import { referralsApi } from "./growth-referrals";

export const growthApi = {
  ...promotionsApi,
  ...adsApi,
  ...affiliatesApi,
  ...referralsApi,
};
