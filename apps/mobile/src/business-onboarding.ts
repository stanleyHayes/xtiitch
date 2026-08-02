import { apiBaseUrl } from "./api-base";
import { persistSession, type BusinessSession } from "./auth";

export type SignupPlan = {
  code: string;
  name: string;
  monthly_fee_minor: number;
  commission_bps: number;
};

export type RegisterBusinessInput = {
  business_name: string;
  business_handle: string;
  owner_display_name: string;
  owner_email: string;
  owner_password: string;
  plan_code: string;
  affiliate_code: string;
};

export async function signupPlans(): Promise<SignupPlan[]> {
  try {
    const response = await fetch(`${apiBaseUrl()}/plans`);
    return response.ok ? ((await response.json()) as SignupPlan[]) : [];
  } catch {
    return [];
  }
}

export async function storeHandleAvailable(handle: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/auth/business/handle-availability?handle=${encodeURIComponent(handle)}`,
    );
    if (!response.ok) return false;
    return Boolean(
      ((await response.json()) as { available?: boolean }).available,
    );
  } catch {
    return false;
  }
}

export async function registerBusiness(
  input: RegisterBusinessInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/business/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const code = (
        (await response.json().catch(() => null)) as { error?: string } | null
      )?.error;
      if (code === "handle_taken")
        return { ok: false, error: "That store handle is already taken." };
      if (code === "email_taken")
        return {
          ok: false,
          error: "An account with that email already exists.",
        };
      return {
        ok: false,
        error: "We couldn't create your store. Check the details and retry.",
      };
    }
    const data = (await response.json()) as Omit<
      BusinessSession,
      "business_handle"
    >;
    await persistSession({ ...data, business_handle: input.business_handle });
    return { ok: true };
  } catch {
    return { ok: false, error: "Check your connection and try again." };
  }
}

export async function requestBusinessPasswordReset(
  email: string,
): Promise<void> {
  await fetch(`${apiBaseUrl()}/auth/business/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  }).catch(() => undefined);
}

export async function confirmBusinessPasswordReset(
  email: string,
  code: string,
  password: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/auth/business/password-reset/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          new_password: password,
        }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
