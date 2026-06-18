export const DEFAULT_API_BASE = "http://localhost:8080";

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

export async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const apiBase = getApiBase();

  try {
    return await fetch(`${apiBase}/v1${path}`, init);
  } catch (error) {
    if (shouldRetryDefaultApi(apiBase)) {
      return fetch(`${DEFAULT_API_BASE}/v1${path}`, init);
    }
    throw error;
  }
}
