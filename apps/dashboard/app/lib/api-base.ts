export const DEFAULT_API_BASE = "http://localhost:8080";
export const DASHBOARD_API_TIMEOUT_MS = 20_000;

export function getApiBase(): string {
  return (process.env.XTIITCH_API_URL ?? DEFAULT_API_BASE).replace(/\/+$/, "");
}

function isLocalDevApiBase(apiBase: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const url = new URL(apiBase);
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function shouldRetryDefaultApi(apiBase: string): boolean {
  return apiBase !== DEFAULT_API_BASE && isLocalDevApiBase(apiBase);
}

export async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const apiBase = getApiBase();
  const boundedInit = {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(DASHBOARD_API_TIMEOUT_MS),
  };

  try {
    return await fetch(`${apiBase}/v1${path}`, boundedInit);
  } catch (error) {
    if (shouldRetryDefaultApi(apiBase)) {
      return fetch(`${DEFAULT_API_BASE}/v1${path}`, boundedInit);
    }
    throw error;
  }
}
