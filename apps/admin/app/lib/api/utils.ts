// Guard `process` so this module is safe if it ends up in the client bundle (it is
// imported for shared values like PLAN_BENEFITS). The actual API_BASE is only used
// server-side; in the browser it resolves to the default and is never fetched with.
export const adminApiBase = (
  (typeof process !== "undefined" ? process.env.XTIITCH_API_URL : undefined) ??
  "http://localhost:8080"
).replace(/\/+$/, "");

const API_BASE = adminApiBase;

export class AdminApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

export async function requestJSON<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AdminApiError(503, "admin_api_unavailable");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AdminApiError(
      response.status,
      payload?.error ?? "admin_api_error",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // Parsing is inside the guard on purpose. A truncated body, or an
  // interstitial page from something in front of the API, throws a raw
  // SyntaxError here — and loadAdminResource deliberately re-throws anything
  // that is not an AdminApiError, so one malformed response reached the root
  // ErrorBoundary and blanked the entire console. Every section has its own
  // fallback; a bad body should cost one of them, not all of them.
  try {
    return (await response.json()) as T;
  } catch {
    throw new AdminApiError(response.status, "invalid_response");
  }
}

export async function requestText(path: string, init: RequestInit): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AdminApiError(503, "admin_api_unavailable");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AdminApiError(
      response.status,
      payload?.error ?? "admin_api_error",
    );
  }

  return response.text();
}
