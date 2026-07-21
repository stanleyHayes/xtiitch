import type { Route } from "./+types/billing-onboarding";
import BillingOnboarding from "../features/billing/BillingOnboarding";

export { meta, loader, action } from "../features/billing/BillingOnboarding";

// React Router injects loaderData/actionData props only into a route module's
// LOCALLY-declared default export, not a re-export. Without this wrapper the
// component saw undefined loaderData and silently defaulted (plan=null → wrong
// view).
export default function BillingOnboardingRoute(props: Route.ComponentProps) {
  return <BillingOnboarding {...props} />;
}
