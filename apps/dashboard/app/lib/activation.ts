import { apiFetch } from "./auth";

// Shape of GET /auth/business/subscription/activation. `activated === false`
// means a paid plan is still PENDING its first payment (status "trialing", never
// paid); the API rejects paid mutations with HTTP 402 { error:
// "activation_required" } until it is activated. Free or already-active
// businesses report `activated === true`.
export type ActivationStatus = {
  activated: boolean;
  status: string;
  plan_code: string;
  plan_name: string;
  amount_due_minor: number;
};

// The canonical activation page. Every activation entry point (the banner,
// blocked primary actions, the global 402 handler, the plans flow) routes here
// so there are no dead-ends and callers never need to know the plan code.
export const ACTIVATION_PATH = "/activate";

// Fail OPEN: a transient error must never spam the banner or lock out a
// legitimate free/active owner. The authoritative gate is the API's 402 on paid
// mutations, so defaulting to "activated" here is safe.
const DEFAULT_ACTIVATION: ActivationStatus = {
  activated: true,
  status: "",
  plan_code: "",
  plan_name: "",
  amount_due_minor: 0,
};

function normalizeActivation(body: unknown): ActivationStatus {
  if (typeof body !== "object" || body === null) {
    return DEFAULT_ACTIVATION;
  }
  const record = body as Record<string, unknown>;
  return {
    // Only an explicit `false` counts as pending; anything else fails open.
    activated: record.activated !== false,
    status: typeof record.status === "string" ? record.status : "",
    plan_code: typeof record.plan_code === "string" ? record.plan_code : "",
    plan_name: typeof record.plan_name === "string" ? record.plan_name : "",
    amount_due_minor:
      typeof record.amount_due_minor === "number" ? record.amount_due_minor : 0,
  };
}

// Read the owner's paid-plan activation state. A missing/failed response fails
// open (activated). A missing session propagates apiFetch's redirect to /login.
export async function fetchActivationStatus(
  request: Request,
): Promise<ActivationStatus> {
  const response = await apiFetch(
    request,
    "/auth/business/subscription/activation",
  );
  if (!response.ok) {
    return DEFAULT_ACTIVATION;
  }
  try {
    return normalizeActivation(await response.json());
  } catch {
    return DEFAULT_ACTIVATION;
  }
}

// A readable label for the pending plan, preferring the API's display name and
// falling back to a capitalized plan code (e.g. "growth" -> "Growth").
export function activationPlanLabel(status: {
  plan_name: string;
  plan_code: string;
}): string {
  const name = status.plan_name.trim();
  if (name) {
    return name;
  }
  const code = status.plan_code.trim();
  if (!code) {
    return "paid";
  }
  return code.charAt(0).toUpperCase() + code.slice(1);
}

// The single prompt shown wherever a paid action is blocked pending activation.
export function activationPromptMessage(planLabel: string): string {
  return `Activate your ${planLabel} plan to start using Xtiitch`;
}

// Deep link to the settings "Business verification" panel (Panel id="verification").
export const VERIFICATION_PATH = "/dashboard/settings#verification";

// The public storefront is only live once the business is VERIFIED and (for paid
// plans) its plan is ACTIVATED. Until then, every "view storefront" control is
// locked so owners aren't sent to a not-yet-live (404) page. Verification is
// surfaced first because it's the gate every store — free or paid — must clear;
// a free plan is always `activated`, so for it the gate is purely verification.
export type StorefrontGate = {
  locked: boolean;
  reason: "verify" | "activate" | null;
  // Short copy for tooltips / helper text explaining why it's locked.
  hint: string;
  // Where the owner should go to clear the block (used by CTA buttons).
  href: string;
  // Label for a CTA button that routes to `href`.
  cta: string;
};

export function storefrontGate(
  verified: boolean,
  activated: boolean,
): StorefrontGate {
  if (!verified) {
    return {
      locked: true,
      reason: "verify",
      hint: "Verify your business to open your storefront",
      href: VERIFICATION_PATH,
      cta: "Verify to open storefront",
    };
  }
  if (!activated) {
    return {
      locked: true,
      reason: "activate",
      hint: "Activate your plan to open your storefront",
      href: ACTIVATION_PATH,
      cta: "Activate to open storefront",
    };
  }
  return { locked: false, reason: null, hint: "", href: "", cta: "" };
}
