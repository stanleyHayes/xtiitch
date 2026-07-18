// Customer-surface session (shopper accounts, phone/email OTP). Self-contained
// sibling of src/auth.ts — that module is the business lane and stays untouched.
// Persists the access token from /customer/auth/verify-otp in AsyncStorage under
// its own key, attaches it as a Bearer header to /customer/* calls, and clears
// itself on expiry or a 401 — the API issues no customer refresh token, so an
// expired session simply signs in again with a fresh code.
//
// Contract verified against
// apps/api/internal/adapters/inbound/http/customerauth/handler.go:
//   POST /v1/customer/auth/request-otp  { channel, phone?, email? } → 202 always
//   POST /v1/customer/auth/verify-otp   { channel, phone?, email?, code } →
//     200 { customer_id, phone, email, access_token, expires_at }
//   GET  /v1/customer/me                Bearer → profile
//   GET  /v1/customer/orders            Bearer → { orders: [...] }
// (paths carry the /v1 prefix via apiBaseUrl(), same as src/api.ts.)
import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiBaseUrl } from "./api";

const STORAGE_KEY = "xtiitch.customer.session.v1";

// A customer signs in over one of two channels: "whatsapp" delivers the code
// by SMS/WhatsApp to the phone number, "email" sends it to the email address.
// The wire value stays "whatsapp" for the phone channel, matching the API and
// the web storefront (app/lib/discovery.ts).
export type OtpChannel = "whatsapp" | "email";

export type CustomerSession = {
  customer_id: string;
  phone: string;
  email: string;
  access_token: string;
  expires_at: string;
};

export type CustomerProfile = {
  customer_id: string;
  phone: string;
  display_name: string;
  email: string;
  whatsapp_phone: string;
};

export type CustomerOrder = {
  order_id: string;
  business_name: string;
  business_handle: string;
  design_title: string;
  status: string;
  agreed_total_minor: number;
  created_at: string;
};

// undefined = not yet read from storage; null = read, no session.
let cached: CustomerSession | null | undefined;

function isExpired(session: CustomerSession): boolean {
  const expiry = Date.parse(session.expires_at);
  return Number.isNaN(expiry) || expiry <= Date.now();
}

export async function loadSession(): Promise<CustomerSession | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CustomerSession) : null;
    cached = parsed && !isExpired(parsed) ? parsed : null;
  } catch {
    cached = null;
  }
  return cached;
}

async function persist(session: CustomerSession | null): Promise<void> {
  cached = session;
  try {
    if (session) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Best effort — an unwritable store still keeps the in-memory session.
  }
}

export type OtpOutcome = { ok: true } | { ok: false; error: string };

// The API answers 202 for any identifier (never reveals which exist), so a
// failure here is a genuine send failure — surface it instead of advancing to
// a code screen where nothing will arrive (mirrors the web account action).
export async function requestOtp(
  identifier: string,
  channel: OtpChannel,
): Promise<OtpOutcome> {
  try {
    const body =
      channel === "email"
        ? { channel, email: identifier }
        : { channel, phone: identifier };
    const response = await fetch(`${apiBaseUrl()}/customer/auth/request-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.status === 202 || response.ok) return { ok: true };
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { ok: false, error: mapRequestError(payload?.error) };
  } catch {
    return {
      ok: false,
      error: "Network error — check your connection and retry.",
    };
  }
}

// Codes from the API's customerAuthError mapping for the request route:
// invalid_phone / invalid_email (400 — fix the input), delivery_failed (502 —
// provider error; generic retry copy).
function mapRequestError(code?: string): string {
  if (code === "invalid_phone") return "Enter a valid phone number.";
  if (code === "invalid_email") return "Enter a valid email address.";
  return "We couldn't send your code right now. Please try again in a moment.";
}

export type VerifyOutcome =
  | { ok: true; session: CustomerSession }
  | { ok: false; error: string };

export async function verifyOtp(
  identifier: string,
  code: string,
  channel: OtpChannel,
): Promise<VerifyOutcome> {
  try {
    const body =
      channel === "email"
        ? { channel, email: identifier, code }
        : { channel, phone: identifier, code };
    const response = await fetch(`${apiBaseUrl()}/customer/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return { ok: false, error: mapVerifyError(response.status, payload?.error) };
    }
    const session = (await response.json()) as CustomerSession;
    await persist(session);
    return { ok: true, session };
  } catch {
    return {
      ok: false,
      error: "Network error — check your connection and retry.",
    };
  }
}

// Codes from the API's customerAuthError mapping for the verify route:
// invalid_code / code_expired (401 — retry), too_many_attempts (429 — back off
// and request a fresh code). Copy mirrors the web account action.
function mapVerifyError(status: number, code?: string): string {
  if (code === "too_many_attempts" || status === 429) {
    return "Too many attempts — request a fresh code.";
  }
  if (status === 401) {
    return "That code is incorrect or has expired.";
  }
  return "We couldn't verify that code. Please try again.";
}

export class CustomerSessionExpiredError extends Error {
  constructor() {
    super("customer_session_expired");
    this.name = "CustomerSessionExpiredError";
  }
}

// authedFetch attaches the Bearer token; there is no customer refresh route,
// so an expired token or a 401 clears the session and throws
// CustomerSessionExpiredError — the caller drops back to the sign-in flow.
export async function authedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const session = cached ?? (await loadSession());
  if (!session || isExpired(session)) {
    await persist(null);
    throw new CustomerSessionExpiredError();
  }
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
    },
  });
  if (response.status === 401) {
    await persist(null);
    throw new CustomerSessionExpiredError();
  }
  return response;
}

export async function fetchCustomerProfile(): Promise<CustomerProfile | null> {
  const response = await authedFetch("/customer/me");
  if (!response.ok) return null;
  return (await response.json()) as CustomerProfile;
}

export async function fetchCustomerOrders(): Promise<CustomerOrder[]> {
  const response = await authedFetch("/customer/orders");
  if (!response.ok) return [];
  const body = (await response.json()) as { orders?: CustomerOrder[] };
  return body.orders ?? [];
}

// No server-side revoke exists for customer tokens — signing out is local,
// exactly like the web storefront destroying its session cookie.
export async function logout(): Promise<void> {
  await persist(null);
}

// Reports whether the API can deliver a code to a phone at all (SMS or
// WhatsApp), from the public /branding phone_otp_enabled flag — the same
// condition the web storefront checks before offering the phone tab. Fails
// closed to false so the email channel (which always delivers) is used instead
// of minting a phone code that would never arrive.
export async function phoneOtpEnabled(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl()}/branding`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { phone_otp_enabled?: boolean };
    return data.phone_otp_enabled ?? false;
  } catch {
    return false;
  }
}
