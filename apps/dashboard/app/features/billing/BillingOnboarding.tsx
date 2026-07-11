import { redirect, useNavigation } from "react-router";
import type { Route } from "../../routes/+types/billing-onboarding";
import { fetchApi } from "../../lib/api-base";
import { fetchActivationStatus } from "../../lib/activation";
import type { PlanChangeResult, PublicPlan } from "./billing-helpers";
import {
  fetchProfile,
  isIdentityOnFile,
  submitPlanChange,
  verifyIdentityAndStartBilling,
} from "./billing-helpers";
import { ChangePlanView } from "./ChangePlanView";
import { PaymentMethodForm } from "./PaymentMethodForm";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Set up billing · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const planCode = new URL(request.url).searchParams.get("plan") ?? "";
  // A paid plan pending activation that reaches the bare plans/management screen
  // (no explicit ?plan target) belongs on the activation page, not the
  // change-plan view — send them there so the plans flow is never a dead-end.
  if (!planCode) {
    const activation = await fetchActivationStatus(request);
    if (!activation.activated) {
      throw redirect("/activate");
    }
  }
  // Fetch the catalogue once: it drives both the activation target (?plan=) and the
  // plan-change control (comparing each plan to the one the business is on).
  let plans: PublicPlan[] = [];
  try {
    const response = await fetchApi("/plans", { method: "GET" });
    if (response.ok) {
      plans = (await response.json()) as PublicPlan[];
    }
  } catch {
    plans = [];
  }
  const plan = planCode
    ? (plans.find((item) => item.code === planCode) ?? null)
    : null;
  // Owner is authenticated by the time they reach /onboarding/billing (register
  // sets the session; plan changes come from inside the dashboard), so we can read
  // the profile to decide whether the Ghana Card is still needed and which plan
  // they are currently on.
  const profile = await fetchProfile(request);
  const currentPlan =
    plans.find((item) => item.code === profile.planCode) ?? null;
  return {
    plan,
    plans,
    currentPlan,
    verificationStatus: profile.verificationStatus,
    identityOnFile: isIdentityOnFile(profile.verificationStatus),
  };
}

// Collect the owner's Ghana Card (unless already on file), then ask the API for
// a Paystack recurring-authorization link (owner-scoped) and redirect the owner
// out to Paystack; they return to the callback route.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  // Plan change (upgrade now / downgrade at renewal) for an already-subscribed
  // business. Distinct from the activation flow below; no Ghana Card or cadence
  // step — the API classifies and prorates server-side.
  if (String(form.get("intent") ?? "") === "change-plan") {
    return submitPlanChange(
      request,
      String(form.get("plan_code") ?? "").trim(),
    );
  }

  return verifyIdentityAndStartBilling(request, form);
}

export default function BillingOnboarding({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const plan = loaderData?.plan ?? null;
  const currentPlan = loaderData?.currentPlan ?? null;
  const plans = loaderData?.plans ?? [];
  const identityOnFile = loaderData?.identityOnFile ?? false;
  const verified = loaderData?.verificationStatus === "verified";
  const result = (actionData ?? {}) as {
    error?: string;
    changeResult?: PlanChangeResult;
  };

  // Management mode: no activation target in the URL and the business is already on
  // a paid plan → show the self-serve plan-change control instead of the activation
  // flow.
  const managementMode =
    !plan && currentPlan !== null && currentPlan.monthly_fee_minor > 0;
  if (managementMode) {
    return (
      <ChangePlanView
        currentPlan={currentPlan}
        plans={plans}
        result={result}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <PaymentMethodForm
      plan={plan}
      identityOnFile={identityOnFile}
      verified={verified}
      error={result.error}
      isSubmitting={isSubmitting}
    />
  );
}
