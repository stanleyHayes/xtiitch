import { redirect } from "react-router";
import { handleAuthAction } from "./auth";
import { handleUsersAction } from "./users";
import { handleSettingsAction } from "./settings";
import { handleVerificationsAction } from "./verifications";
import { handleBusinessesAction } from "./businesses";
import { handleMoneyAction } from "./money";
import { handleSubscriptionsAction } from "./subscriptions";
import { handlePromotionsAction } from "./promotions";
import { handleAdsAction } from "./ads";
import { handleAffiliatesAction } from "./affiliates";
import { handleReferralsAction } from "./referrals";
import { handleRiskAction } from "./risk";
import { handleSupportAction } from "./support";

export async function handleAdminAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}) {
  const result =
    (await handleAuthAction({ request, intent, form })) ??
    (await handleUsersAction({ request, intent, form })) ??
    (await handleSettingsAction({ request, intent, form })) ??
    (await handleVerificationsAction({ request, intent, form })) ??
    (await handleBusinessesAction({ request, intent, form })) ??
    (await handleMoneyAction({ request, intent, form })) ??
    (await handleSubscriptionsAction({ request, intent, form })) ??
    (await handlePromotionsAction({ request, intent, form })) ??
    (await handleAdsAction({ request, intent, form })) ??
    (await handleAffiliatesAction({ request, intent, form })) ??
    (await handleReferralsAction({ request, intent, form })) ??
    (await handleRiskAction({ request, intent, form })) ??
    (await handleSupportAction({ request, intent, form }));

  return result ?? redirect("/admin");
}
