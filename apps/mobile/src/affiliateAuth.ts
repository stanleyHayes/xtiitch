import { apiBaseUrl } from "./api-base";
import {
  deleteSessionValue,
  getSessionValue,
  setSessionValue,
} from "./session-storage";

const STORAGE_KEY = "xtiitch.affiliate.session.v1";

export type AffiliateAccount = {
  account_id: string;
  affiliate_id: string;
  email: string;
  display_name: string;
  code: string;
  status: string;
};

export type AffiliateSession = {
  account: AffiliateAccount;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

type AffiliateResult<T> =
  | { ok: true; data: T }
  | { ok: false; expired: boolean; error: string };

let cached: AffiliateSession | null | undefined;
let refreshing: Promise<AffiliateSession | null> | null = null;

export async function loadAffiliateSession(): Promise<AffiliateSession | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await getSessionValue(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as AffiliateSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

async function persist(session: AffiliateSession | null): Promise<void> {
  cached = session;
  try {
    if (session) await setSessionValue(STORAGE_KEY, JSON.stringify(session));
    else await deleteSessionValue(STORAGE_KEY);
  } catch {
    // The in-memory session remains usable when persistence is unavailable.
  }
}

export async function affiliateLogin(
  email: string,
  password: string,
): Promise<AffiliateResult<AffiliateSession>> {
  try {
    const response = await fetch(`${apiBaseUrl()}/affiliate/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (!response.ok) {
      return {
        ok: false,
        expired: false,
        error:
          response.status === 401
            ? "That email and password do not match an affiliate account."
            : "We couldn't sign you in right now.",
      };
    }
    const session = (await response.json()) as AffiliateSession;
    await persist(session);
    return { ok: true, data: session };
  } catch {
    return {
      ok: false,
      expired: false,
      error: "Check your connection and try again.",
    };
  }
}

export async function requestAffiliateRecovery(email: string): Promise<void> {
  await fetch(`${apiBaseUrl()}/affiliate/auth/recovery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  }).catch(() => undefined);
}

export async function resetAffiliatePassword(
  token: string,
  password: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${apiBaseUrl()}/affiliate/auth/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function refresh(
  session: AffiliateSession,
): Promise<AffiliateSession | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/affiliate/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) return null;
    const next = (await response.json()) as AffiliateSession;
    await persist(next);
    return next;
  } catch {
    return null;
  }
}

async function refreshOnce(session: AffiliateSession) {
  if (cached && cached.refresh_token !== session.refresh_token) return cached;
  refreshing ??= refresh(session).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function affiliateRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<AffiliateResult<T>> {
  let session = cached ?? (await loadAffiliateSession());
  if (!session) return { ok: false, expired: true, error: "session_expired" };

  const call = (token: string) =>
    fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

  try {
    let response = await call(session.access_token);
    if (response.status === 401) {
      const next = await refreshOnce(session);
      if (!next) {
        await persist(null);
        return { ok: false, expired: true, error: "session_expired" };
      }
      session = next;
      response = await call(session.access_token);
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        expired: response.status === 401,
        error: payload?.error ?? `upstream_${response.status}`,
      };
    }
    if (response.status === 204) return { ok: true, data: undefined as T };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, expired: false, error: "network_error" };
  }
}

export async function affiliateLogout(): Promise<void> {
  const session = cached ?? (await loadAffiliateSession());
  if (session) {
    try {
      await fetch(`${apiBaseUrl()}/affiliate/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
    } catch {
      // Local sign-out must still succeed offline.
    }
  }
  await persist(null);
}
