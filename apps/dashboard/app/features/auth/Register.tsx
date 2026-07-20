import { redirect } from "react-router";
import { useNavigation } from "react-router";
import type { Route } from "../../routes/+types/register";
import { fetchApi } from "../../lib/api-base";
import { commitSession, getSession } from "../../lib/session";
import { RegisterForm } from "./RegisterForm";

type PublicPlan = {
  code: string;
  name: string;
  monthly_fee_minor: number;
  yearly_fee_minor: number;
  commission_bps: number;
  design_limit?: number | null;
};

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Create your store · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

// Active plan catalogue for the picker; failures degrade to a free-only signup.
export async function loader() {
  let plans: PublicPlan[] = [];
  try {
    const response = await fetchApi("/plans", { method: "GET" });
    if (response.ok) {
      plans = (await response.json()) as PublicPlan[];
    }
  } catch {
    plans = [];
  }
  return { plans };
}

export async function action({ request }: Route.ActionArgs) { // eslint-disable-line complexity -- route action/loader with many conditional branches; refactor in follow-up
  const form = await request.formData();
  const session = await getSession(request.headers.get("Cookie"));

  const payload = {
    business_name: String(form.get("business_name") ?? "").trim(),
    business_handle: String(form.get("business_handle") ?? "")
      .trim()
      .toLowerCase(),
    owner_display_name: String(form.get("owner_display_name") ?? "").trim(),
    owner_email: String(form.get("owner_email") ?? "").trim(),
    owner_password: String(form.get("owner_password") ?? ""),
    owner_phone: String(form.get("owner_phone") ?? "").trim(),
    // The phone is the number we SMS, so it is the one proven at signup.
    // WhatsApp is chat-only and carries no code.
    owner_phone_code: String(form.get("owner_phone_code") ?? "").trim(),
    whatsapp_number: String(form.get("whatsapp_number") ?? "").trim(),
    plan_code: String(form.get("plan_code") ?? "free"),
  };

  if (payload.owner_password.length < 8) {
    return { error: "Choose a password with at least 8 characters." };
  }

  let response: Response;
  try {
    response = await fetchApi("/auth/business/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { error: "Dashboard API is unavailable. Try again after a moment." };
  }

  if (!response.ok) {
    let code: string;
    try {
      code = ((await response.json()) as { error?: string }).error ?? "";
    } catch {
      code = "";
    }
    if (code === "handle_taken") {
      return { error: "That store handle is already taken — try another." };
    }
    if (code === "email_taken") {
      return {
        error: "An account with that email already exists. Try signing in.",
      };
    }
    // Phone-code expired or wrong server-side (the code is only valid ~5
    // minutes). Rare under §8 — the code is verified up front on the account
    // step — but a stale challenge can still reach here when the form was left
    // open. Show the real reason so the owner knows to re-verify.
    if (code === "code_expired" || code === "invalid_token") {
      return {
        error:
          "Your phone verification code expired or was incorrect. Go back to “Your account”, tap “Resend code”, and enter the new code.",
      };
    }
    return {
      error: "We couldn't create your store. Please check your details and try again.",
    };
  }

  // Registration auto-issues a session; store it and drop straight into the
  // dashboard. Paid plans land with ?welcome=plan so onboarding can prompt for
  // billing setup.
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  session.set("access", body.access_token ?? "");
  session.set("refresh", body.refresh_token ?? "");
  const destination =
    payload.plan_code && payload.plan_code !== "free"
      ? `/onboarding/billing?plan=${encodeURIComponent(payload.plan_code)}`
      : "/dashboard?welcome=1";
  return redirect(destination, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export function formatPlanPrice(minor: number): string {
  if (minor <= 0) {
    return "Free";
  }
  const amount = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
  return `${amount}/mo`;
}

export const STEP_LABELS = ["Your store", "Your account", "Choose a plan"];

export default function Register({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const plans = loaderData?.plans ?? [];
  const result = (actionData ?? {}) as { error?: string };

  return (
    <RegisterForm
      plans={plans}
      isSubmitting={isSubmitting}
      result={result}
    />
  );
}
