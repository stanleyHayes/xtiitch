export * from "./utils";
export * from "./auth";
export * from "./users";
export * from "./settings";
export * from "./operations";
export * from "./verifications";
export * from "./businesses";
export * from "./plans";
export * from "./subscriptions";
export * from "./subscription-billing";
export * from "./subscription-discounts";
export * from "./money";
export * from "./payouts";
export * from "./support";
export * from "./growth";

import { authApi } from "./auth";
import { usersApi } from "./users";
import { settingsApi } from "./settings";
import { operationsApi } from "./operations";
import { verificationsApi } from "./verifications";
import { businessesApi } from "./businesses";
import { plansApi } from "./plans";
import { subscriptionsApi } from "./subscriptions";
import { subscriptionBillingApi } from "./subscription-billing";
import { subscriptionDiscountsApi } from "./subscription-discounts";
import { moneyApi } from "./money";
import { payoutsApi } from "./payouts";
import { supportApi } from "./support";
import { growthApi } from "./growth";

export const adminApi = {
  ...authApi,
  ...usersApi,
  ...settingsApi,
  ...operationsApi,
  ...verificationsApi,
  ...businessesApi,
  ...plansApi,
  ...subscriptionsApi,
  ...subscriptionBillingApi,
  ...subscriptionDiscountsApi,
  ...moneyApi,
  ...payoutsApi,
  ...supportApi,
  ...growthApi,
};
