import { redirect } from "react-router";
import { apiFetch } from "../../lib/auth";
import { uploadImage } from "../../lib/media";

export type PublicPlan = {
  code: string;
  name: string;
  monthly_fee_minor: number;
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
  verification_status?: string;
  plan?: string;
};

export type Profile = {
  verificationStatus: string;
  planCode: string;
};

// The Ghana Card is considered "on file" once it has been submitted (pending
// review) or approved (verified) — in either case we skip re-collection here.
export function isIdentityOnFile(status: string): boolean {
  return status === "verified" || status === "pending";
}

// Read the owner's business profile: verification status (to decide whether the
// Ghana Card section is still needed) and the plan they are currently on (to render
// the plan-change control for an already-subscribed business). Used by the loader
// and re-checked in the action so a stale form cannot bypass identity capture.
export async function fetchProfile(request: Request): Promise<Profile> {
  try {
    const response = await apiFetch(request, "/businesses/me", {
      method: "GET",
    });
    if (!response.ok) {
      return { verificationStatus: "", planCode: "" };
    }
    const body = (await response.json()) as BusinessProfile;
    return {
      verificationStatus:
        typeof body.verification_status === "string"
          ? body.verification_status
          : "",
      planCode: typeof body.plan === "string" ? body.plan : "",
    };
  } catch {
    return { verificationStatus: "", planCode: "" };
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
};

// Ask the API to change the plan. The API classifies upgrade vs downgrade and
// prorates server-side; we surface whether it applied immediately (upgrade) or was
// scheduled for the next renewal (downgrade).
export async function submitPlanChange(
  request: Request,
  planCode: string,
): Promise<{ error: string } | { changeResult: PlanChangeResult }> {
  if (!planCode) {
    return { error: "Choose a plan to switch to." };
  }
  const response = await apiFetch(
    request,
    "/auth/business/subscription/change-plan",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_code: planCode }),
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
  return { changeResult: (await response.json()) as PlanChangeResult };
}

export async function verifyIdentityAndStartBilling(
  request: Request,
  form: FormData,
): Promise<Response | { error: string }> {
  const origin = new URL(request.url).origin;

  const cadence: BillingCadence =
    String(form.get("billing_cadence") ?? "") === "quarterly"
      ? "quarterly"
      : "yearly";
  const discountCode = String(form.get("discount_code") ?? "").trim();

  // Re-check server-side rather than trusting the rendered form: if the Ghana
  // Card is not yet on file we must capture it before starting billing.
  const status = (await fetchProfile(request)).verificationStatus;
  if (!isIdentityOnFile(status)) {
    const cardNumber = String(form.get("card_number") ?? "").trim();
    if (!cardNumber) {
      return {
        error: "Enter your Ghana Card number (e.g. GHA-123456789-0).",
      };
    }

    let photoURL = "";
    const photoFile = form.get("id_photo_file");
    if (photoFile instanceof File && photoFile.size > 0) {
      photoURL = (await uploadImage(request, photoFile)) ?? "";
    }
    if (!photoURL) {
      return {
        error: "Upload a clear photo of the front of your Ghana Card.",
      };
    }

    const identityResponse = await apiFetch(
      request,
      "/auth/business/identity-verification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cardNumber,
          id_photo_url: photoURL,
        }),
      },
    );
    if (!identityResponse.ok) {
      // Stay on the page (do NOT proceed to payment) so the owner can fix it.
      return {
        error:
          "We couldn't verify that Ghana Card. Check the number (format GHA-123456789-0) and photo, then try again.",
      };
    }
  }

  // Identity is on file (already or just submitted) — start Paystack billing,
  // carrying the target plan (?plan=) so a free store activates the chosen paid
  // plan, plus any discount code for the API to apply at checkout.
  const targetPlan = new URL(request.url).searchParams.get("plan") ?? "";
  return startPaystackBilling(
    request,
    origin,
    cadence,
    discountCode,
    targetPlan.trim(),
  );
}
