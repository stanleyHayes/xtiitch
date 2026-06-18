// Business-surface session. Persists the token pair from /auth/business/login,
// attaches the Bearer header to protected calls, and silently refreshes an
// expired access token once via /auth/business/refresh before giving up.
//
// Tokens live in AsyncStorage (localStorage on web). Moving them to
// expo-secure-store on the native targets is a hardening follow-up — kept simple
// here so the same code path works in the web preview.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiBaseUrl } from "./api";

const STORAGE_KEY = "xtiitch.business.session.v1";

export type BusinessSession = {
  business_id: string;
  business_user_id: string;
  business_handle: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

type TokenResponse = {
  business_id: string;
  business_user_id: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

// undefined = not yet read from storage; null = read, no session.
let cached: BusinessSession | null | undefined;

export async function loadSession(): Promise<BusinessSession | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as BusinessSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

async function persist(session: BusinessSession | null): Promise<void> {
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

export type LoginInput = {
  business_handle: string;
  owner_email: string;
  owner_password: string;
};

export type LoginOutcome =
  | { ok: true; session: BusinessSession }
  | { ok: false; error: string };

export async function login(input: LoginInput): Promise<LoginOutcome> {
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/business/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      return { ok: false, error: mapAuthError(response.status, payload?.error) };
    }
    const data = (await response.json()) as TokenResponse;
    const session: BusinessSession = {
      ...data,
      business_handle: input.business_handle.trim().toLowerCase(),
    };
    await persist(session);
    return { ok: true, session };
  } catch {
    return { ok: false, error: "Network error — check your connection and retry." };
  }
}

export async function logout(): Promise<void> {
  const session = cached ?? (await loadSession());
  if (session?.refresh_token) {
    try {
      await fetch(`${apiBaseUrl()}/auth/business/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
    } catch {
      // Logging out locally is enough even if the revoke call fails.
    }
  }
  await persist(null);
}

async function refresh(session: BusinessSession): Promise<BusinessSession | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/business/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as TokenResponse;
    const next: BusinessSession = { ...session, ...data };
    await persist(next);
    return next;
  } catch {
    return null;
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("session_expired");
    this.name = "SessionExpiredError";
  }
}

// authedFetch attaches the Bearer header; on a 401 it refreshes the token once
// and retries, clearing the session and throwing SessionExpiredError if the
// refresh also fails.
export async function authedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  let session = cached ?? (await loadSession());
  if (!session) throw new SessionExpiredError();

  const call = (token: string) =>
    fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

  let response = await call(session.access_token);
  if (response.status === 401) {
    const refreshed = await refresh(session);
    if (!refreshed) {
      await persist(null);
      throw new SessionExpiredError();
    }
    session = refreshed;
    response = await call(session.access_token);
    if (response.status === 401) {
      await persist(null);
      throw new SessionExpiredError();
    }
  }
  return response;
}

function mapAuthError(status: number, code?: string): string {
  if (status === 401 || code === "invalid_credentials") {
    return "Wrong handle, email, or password.";
  }
  if (status === 404 || code === "business_not_found") {
    return "No studio found for that handle.";
  }
  return "Couldn't sign in. Please try again.";
}
