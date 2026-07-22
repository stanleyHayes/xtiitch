import { redirect, useNavigation } from "react-router";
import type { Route } from "../../routes/+types/billing-onboarding";
import { fetchApi } from "../../lib/api-base";
import { fetchActivationStatus } from "../../lib/activation";
import type { PlanChangeResult, PublicPlan } from "./billing-helpers";
import {
  fetchProfile,
  startBilling,
  submitPlanChange,
} from "./billing-helpers";
import { ChangePlanView } from "./ChangePlanView";
import { PaymentMethodForm } from "./PaymentMethodForm";
import { PlansView } from "./PlansView";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Set up billing · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const searchParams = new URL(request.url).searchParams;
  const planCode = searchParams.get("plan") ?? "";
  const changeCode = searchParams.get("change") ?? "";
  const retryingPlanChange = changeCode === "retry";
  // A paid plan pending activation that reaches the bare plans/management screen
  // (no explicit ?plan target) belongs on the activation page, not the
  // change-plan view — send them there so the plans flow is never a dead-end.
  if (!planCode && !retryingPlanChange) {
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
  const changePlan =
    changeCode && !retryingPlanChange
      ? (plans.find((item) => item.code === changeCode) ?? null)
      : null;
  // Owner is authenticated by the time they reach /onboarding/billing (register
  // sets the session; plan changes come from inside the dashboard), so we can read
  // the profile to learn which plan they are currently on.
  const profile = await fetchProfile(request);
  const currentPlan =
    plans.find((item) => item.code === profile.planCode) ?? null;
  return {
    plan,
    changePlan,
    plans,
    currentPlan,
    // Set by the billing callback when the owner returned from Paystack without
    // completing payment — the views show a friendly "nothing was charged" banner.
    abandoned: searchParams.get("billing") === "abandoned",
  };
}

// Ask the API for a Paystack recurring-authorization link (owner-scoped) and
// redirect the owner out to Paystack; they return to the callback route. Paying
// is never gated — no identity or verification step stands in this path.
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();

  // Plan change (upgrade now / downgrade at renewal) for an already-subscribed
  // business. Upgrades arrive here after the owner chooses a billing cadence;
  // downgrades remain payment-free and use no cadence change.
  if (String(form.get("intent") ?? "") === "change-plan") {
    return submitPlanChange(
      request,
      String(form.get("plan_code") ?? "").trim(),
      String(form.get("billing_cadence") ?? "").trim(),
    );
  }

  return startBilling(request, form);
}

// eslint-disable-next-line complexity -- view switch over plan/management state; refactor in follow-up
export default function BillingOnboarding({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const plan = loaderData?.plan ?? null;
  const changePlan = loaderData?.changePlan ?? null;
  const currentPlan = loaderData?.currentPlan ?? null;
  const plans = loaderData?.plans ?? [];
  const abandoned = loaderData?.abandoned ?? false;
  const result = (actionData ?? {}) as {
    error?: string;
    changeResult?: PlanChangeResult;
  };

  if (
    changePlan &&
    currentPlan &&
    changePlan.monthly_fee_minor > currentPlan.monthly_fee_minor
  ) {
    return (
      <PaymentMethodForm
        plan={changePlan}
        error={result.error}
        abandoned={abandoned}
        isSubmitting={isSubmitting}
        changePlan
      />
    );
  }

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
        abandoned={abandoned}
      />
    );
  }

  // §7.1: no valid plan selected and nothing paid to manage — a Free account
  // hitting Upgrade (or an unknown ?plan=) lands here. The old fall-through
  // rendered PaymentMethodForm with plan=null, which errored out; show the
  // plans list instead so Upgrade always reaches a working plans page.
  if (!plan) {
    return (
      <PlansView
        plans={plans}
        currentPlanCode={currentPlan?.code}
        title="Upgrade your plan"
        subtitle="You're on the Free plan. Pick a package below to unlock more — payment is by Paystack, quarterly or yearly."
        notice={
          abandoned
            ? "Payment wasn't completed — nothing was charged. You can try again whenever you're ready."
            : undefined
        }
        backTo="/dashboard"
      />
    );
  }

  return (
    <PaymentMethodForm
      plan={plan}
      error={result.error}
      abandoned={abandoned}
      isSubmitting={isSubmitting}
    />
  );
}
