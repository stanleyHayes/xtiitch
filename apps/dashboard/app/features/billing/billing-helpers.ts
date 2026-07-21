import { redirect } from "react-router";
import { apiFetch } from "../../lib/auth";

export type PublicPlan = {
  code: string;
  name: string;
  monthly_fee_minor: number;
  // Key limits surfaced on the plans list (§7.1): the Xtiitch fee per sale and
  // the active-design cap (null = unlimited).
  commission_bps: number;
  design_limit: number | null;
  // Pricing Book cadence figures (minor units): first cycle vs renewal.
  quarterly_first_minor: number;
  quarterly_renewal_minor: number;
  yearly_first_minor: number;
  yearly_renewal_minor: number;
  // VAT applied to subscription charges (Pricing Book tax decision flag). Same
  // policy for every plan/cadence: 0 = no VAT; vat_inclusive=false means VAT is
  // added on top of the figures above at checkout, true means they include it.
  vat_rate_bps: number;
  vat_inclusive: boolean;
};

export type BillingCadence = "quarterly" | "yearly";

type BusinessProfile = {
  plan?: string;
};

export type Profile = {
  planCode: string;
};

// Read the owner's business profile for the plan they are currently on (to render
// the plan-change control for an already-subscribed business). Paying is never
// gated, so verification status is intentionally NOT read here — it only gates
// selling (dashboard → settings).
export async function fetchProfile(request: Request): Promise<Profile> {
  try {
    const response = await apiFetch(request, "/businesses/me", {
      method: "GET",
    });
    if (!response.ok) {
      return { planCode: "" };
    }
    const body = (await response.json()) as BusinessProfile;
    return {
      planCode: typeof body.plan === "string" ? body.plan : "",
    };
  } catch {
    return { planCode: "" };
  }
}

// Friendly copy for the discount-code rejection codes the API returns, so a bad
// code is surfaced clearly (never silently ignored) rather than shown as a generic
// billing failure.
const DISCOUNT_ERROR_MESSAGES: Record<string, string> = {
  invalid_discount_code:
    "That discount code isn't valid. Check it and try again, or continue without one.",
  discount_code_expired: "That discount code has expired or isn't active yet.",
  discount_code_ineligible:
    "That discount code doesn't apply to this plan or billing cycle.",
  discount_code_exhausted:
    "That discount code has already been fully redeemed.",
};

export async function startPaystackBilling(
  request: Request,
  origin: string,
  cadence: BillingCadence,
  code: string,
  planCode: string,
): Promise<Response | { error: string }> {
  const response = await apiFetch(
    request,
    "/auth/business/subscription/authorization-link",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_url: `${origin}/onboarding/billing/callback`,
        billing_cadence: cadence,
        // The target plan being activated/upgraded to. Sending it lets a store on
        // the free plan switch to the chosen paid plan as billing starts (otherwise
        // the free-fee subscription fails the API's fee gate and can never upgrade).
        ...(planCode ? { plan_code: planCode } : {}),
        // Only send a code when the owner entered one; the API treats it as
        // optional and applies the discount at checkout when valid.
        ...(code ? { code } : {}),
      }),
    },
  );
  if (!response.ok) {
    // Surface a precise discount-code message when the owner supplied a code and
    // the API rejected it; otherwise a generic retry-later message.
    if (code) {
      try {
        const body = (await response.json()) as { error?: string };
        const message = body.error
          ? DISCOUNT_ERROR_MESSAGES[body.error]
          : undefined;
        if (message) {
          return { error: message };
        }
      } catch {
        // fall through to the generic message below
      }
    }
    return {
      error:
        "We couldn't start billing setup right now. You can finish this later from your dashboard.",
    };
  }
  const body = (await response.json()) as {
    redirect_url?: string;
    activated?: boolean;
  };
  // A free-period / full (100%) discount collects nothing and a period already paid
  // needs nothing, so the API activates immediately with no Paystack checkout. Land
  // the owner on the same success page the paid-checkout callback redirects to.
  if (body.activated) {
    return redirect("/dashboard?billing=active");
  }
  if (!body.redirect_url) {
    return {
      error: "Billing setup is not available yet. You can finish this later.",
    };
  }
  return redirect(body.redirect_url);
}

// Friendly copy for the plan-change rejection codes the API returns, so a refused
// change is explained precisely rather than as a generic failure.
const PLAN_CHANGE_ERROR_MESSAGES: Record<string, string> = {
  plan_change_same_plan: "You're already on that plan.",
  billing_not_active:
    "Set up billing first — activate your subscription, then you can upgrade.",
  upgrade_charge_failed:
    "We couldn't take the prorated upgrade payment. Check your payment method and try again.",
  not_found: "That plan is no longer available.",
  invalid_input: "That plan change isn't available for your subscription.",
  forbidden: "Only the business owner or an admin can change the plan.",
};

export type PlanChangeResult = {
  plan_code: string;
  // true = upgrade applied now; false = downgrade scheduled at the next renewal.
  immediate: boolean;
  // amount charged now for the remainder of the current period (upgrade), pesewas.
  prorated_charge_minor: number;
  // RFC3339 timestamp the new plan takes effect.
  effective_at: string;
  authorization_url?: string;
};

// Ask the API to change the plan. The API classifies upgrade vs downgrade and
// prorates server-side; we surface whether it applied immediately (upgrade) or was
// scheduled for the next renewal (downgrade).
export async function submitPlanChange(
  request: Request,
  planCode: string,
): Promise<Response | { error: string } | { changeResult: PlanChangeResult }> {
  if (!planCode) {
    return { error: "Choose a plan to switch to." };
  }
  const response = await apiFetch(
    request,
    "/auth/business/subscription/change-plan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_code: planCode,
        callback_url: `${new URL(request.url).origin}/onboarding/billing/callback?flow=plan-change`,
      }),
    },
  );
  if (!response.ok) {
    let code: string;
    try {
      const body = (await response.json()) as { error?: string };
      code = body.error ?? "";
    } catch {
      code = "";
    }
    return {
      error:
        PLAN_CHANGE_ERROR_MESSAGES[code] ??
        "We couldn't change your plan right now. Please try again later.",
    };
  }
  const changeResult = (await response.json()) as PlanChangeResult;
  if (changeResult.authorization_url) {
    return redirect(changeResult.authorization_url);
  }
  return { changeResult };
}

// Start billing for the chosen plan. Paying is never gated — no identity
// capture, no extra step: read the cadence, discount code, and target plan
// (?plan=, so a free store activates the chosen paid plan) and go straight to
// Paystack.
export async function startBilling(
  request: Request,
  form: FormData,
): Promise<Response | { error: string }> {
  const origin = new URL(request.url).origin;

  const cadence: BillingCadence =
    String(form.get("billing_cadence") ?? "") === "quarterly"
      ? "quarterly"
      : "yearly";
  const discountCode = String(form.get("discount_code") ?? "").trim();

  const targetPlan = new URL(request.url).searchParams.get("plan") ?? "";
  return startPaystackBilling(
    request,
    origin,
    cadence,
    discountCode,
    targetPlan.trim(),
  );
}
