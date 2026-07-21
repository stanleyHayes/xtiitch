import { redirect } from "react-router";
import type { Route } from "./+types/billing-callback";
import { apiFetch } from "../lib/auth";
import { fetchActivationStatus } from "../lib/activation";
import { billingVerificationIsActive } from "../lib/billing-verification";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Confirming billing · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// Where an abandoned/failed checkout sends the owner: back to the plan checkout
// when the intended plan is recoverable (a paid plan still pending activation),
// otherwise back to the plan picker — always with the "abandoned" flag so the
// destination shows the friendly nothing-was-charged banner with a working pay
// button. Never a dead end, never a hung loader.
async function abandonedCheckoutRedirect(request: Request): Promise<never> {
  if (new URL(request.url).searchParams.get("flow") === "plan-change") {
    throw redirect("/onboarding/billing?change=retry&billing=abandoned");
  }
  const activation = await fetchActivationStatus(request);
  if (!activation.activated && activation.plan_code) {
    throw redirect(
      `/onboarding/billing?plan=${encodeURIComponent(
        activation.plan_code,
      )}&billing=abandoned`,
    );
  }
  throw redirect("/onboarding/billing?billing=abandoned");
}

// Paystack redirects back here with ?reference=/?trxref=. Verify it with the API
// (which flips the subscription to recurring billing) then land in the dashboard.
// No reference (backed out before Paystack created a transaction) or a
// not-success verification (abandoned/failed/pending) goes straight back to
// checkout — the owner is never stranded on a blank pending navigation.
export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  if (!reference) {
    return abandonedCheckoutRedirect(request);
  }
  const response = await apiFetch(
    request,
    "/auth/business/subscription/authorization-verifications",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    },
  );
  // The API intentionally returns a truthful 200 payload for an abandoned,
  // failed, or still-pending Paystack transaction. Only the explicit active
  // state is success; HTTP 200 by itself must never unlock the success route.
  if (await billingVerificationIsActive(response)) {
    throw redirect("/dashboard?billing=active");
  }
  return abandonedCheckoutRedirect(request);
}

// The loader always redirects (success → dashboard, anything else → checkout),
// so this component never renders; it exists only to satisfy the route module.
export default function BillingCallback() {
  return null;
}
