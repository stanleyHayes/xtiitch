// Server-side client for customer accounts (phone/email OTP) and AI marketplace
// search. Storefront loaders/actions call these; nothing here runs in the
// browser. The access token is attached server-side from the session cookie.
const API_BASE = process.env.XTIITCH_API_URL ?? "http://localhost:8080";

// ── Customer OTP auth (SMS/WhatsApp phone or email) ─────────────────────────

// phoneOtpEnabled reports whether the server can deliver a sign-in code to a
// phone at all — over SMS (Arkesel) OR WhatsApp. The public branding endpoint
// surfaces this (same condition as the API's buildCustomerOTPDelivery). Used as a
// server-side backstop in the account action so a stale/bfcache-restored form
// can't request a phone code that would never be delivered. Defaults false on any
// failure (fail closed — prefer the email channel, which always delivers).
export async function phoneOtpEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/v1/branding`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { phone_otp_enabled?: boolean };
    return data.phone_otp_enabled ?? false;
  } catch {
    return false;
  }
}

// A customer signs in over one of two channels. The "phone" channel delivers the
// code by SMS (or WhatsApp) to the phone number; "email" uses the email address.
// The wire value stays "whatsapp" (the API's phone-OTP channel) for compatibility.
export type OtpChannel = "whatsapp" | "email";

// requestCustomerOtp always reports success (the API returns 202 regardless, to
// avoid leaking which identifiers exist). Pass channel "email" with an email to
// send the code by email instead of by SMS to the phone.
export async function requestCustomerOtp(
  identifier: string,
  channel: OtpChannel = "whatsapp",
): Promise<boolean> {
  try {
    const body =
      channel === "email"
        ? { channel, email: identifier }
        : { channel, phone: identifier };
    const response = await fetch(`${API_BASE}/v1/customer/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.status === 202 || response.ok;
  } catch {
    return false;
  }
}

export type VerifyOtpResult =
  | { ok: true; token: string; phone: string; email: string }
  | { ok: false; status: number; error: string };

export async function verifyCustomerOtp(
  identifier: string,
  code: string,
  channel: OtpChannel = "whatsapp",
): Promise<VerifyOtpResult> {
  const requestBody =
    channel === "email"
      ? { channel, email: identifier, code }
      : { channel, phone: identifier, code };
  const response = await fetch(`${API_BASE}/v1/customer/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: false,
      status: response.status,
      error: payload?.error ?? "verify_failed",
    };
  }
  const body = (await response.json()) as {
    access_token: string;
    phone: string;
    email?: string;
  };
  return {
    ok: true,
    token: body.access_token,
    phone: body.phone,
    email: body.email ?? "",
  };
}

// ── Customer account (orders + profile) ────────────────────────────────────

export type CustomerOrder = {
  order_id: string;
  business_name: string;
  business_handle: string;
  design_title: string;
  status: string;
  agreed_total_minor: number;
  created_at: string;
};

export type CustomerProfile = {
  customer_id: string;
  phone: string;
  display_name: string;
  email: string;
};

export async function fetchCustomerProfile(
  token: string,
): Promise<CustomerProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/v1/customer/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return (await response.json()) as CustomerProfile;
  } catch {
    return null;
  }
}

export async function fetchCustomerOrders(
  token: string,
): Promise<CustomerOrder[]> {
  try {
    const response = await fetch(`${API_BASE}/v1/customer/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { orders?: CustomerOrder[] };
    return body.orders ?? [];
  } catch {
    return [];
  }
}

export async function updateCustomerProfile(
  token: string,
  input: { display_name: string; email: string },
): Promise<CustomerProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/v1/customer/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) return null;
    return (await response.json()) as CustomerProfile;
  } catch {
    return null;
  }
}

// ── AI marketplace search ──────────────────────────────────────────────────

export type AiSearchHit = {
  design_title: string;
  design_handle: string;
  image: string;
  price_minor: number;
  store_name: string;
  store_handle: string;
  score: number;
};

export type AiUnderstood = {
  interpreted: string;
  colors: string[];
  categories: string[];
  occasions: string[];
  price_min_minor: number;
  price_max_minor: number;
};

export type AiQuota = {
  tier: string;
  limit: number;
  used: number;
  remaining: number;
  unlimited: boolean;
};

export type AiSearchResponse =
  | {
      ok: true;
      results: AiSearchHit[];
      understood: AiUnderstood;
      quota: AiQuota;
    }
  | { ok: false; status: number; error: string; quota?: AiQuota };

// aiSearch posts a natural-language query. A customer token (when signed in)
// meters by identity and unlocks the larger allowance. A 402 means the free
// quota is spent — the quota is still returned so the UI can prompt an upgrade.
export async function aiSearch(
  query: string,
  limit: number,
  token?: string,
): Promise<AiSearchResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}/v1/public/ai-search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, limit }),
  });

  const body = (await response.json().catch(() => null)) as
    | (Partial<AiSearchResponse> & {
        results?: AiSearchHit[];
        understood?: AiUnderstood;
        quota?: AiQuota;
        error?: string;
      })
    | null;

  if (response.ok && body) {
    return {
      ok: true,
      results: body.results ?? [],
      understood: body.understood as AiUnderstood,
      quota: body.quota as AiQuota,
    };
  }
  return {
    ok: false,
    status: response.status,
    error: body?.error ?? "search_failed",
    quota: body?.quota,
  };
}
