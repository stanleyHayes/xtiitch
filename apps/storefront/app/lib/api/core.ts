import { fetchWithTimeout } from "../server-fetch";

// Server-side client for the Xtiitch public catalogue API. Storefront loaders
// call these; nothing here runs in the browser. The base URL points at the Go
// API and is overridable per environment.
const API_BASE = process.env.XTIITCH_API_URL ?? "http://localhost:8080";

// The tenant header the API's §6 isolation middleware enforces: when present,
// /v1/public/* is scoped to that one store (cross-store endpoints 404, another
// store's data 403s). Loaders resolve it from the request host via
// storeHandleFromHost and thread it through every public call below, so a
// tenant store (business-name.xtiitch.com) can never read another store's data
// no matter what the client asks for.
export const TENANT_HEADER = "X-Xtiitch-Tenant";

export type TenantScope = string | null | undefined;

function tenantHeaders(tenant: TenantScope): Record<string, string> {
  return tenant ? { [TENANT_HEADER]: tenant } : {};
}

export async function getJSON<T>(
  path: string,
  tenant?: TenantScope,
): Promise<T | null> {
  const response = await fetchWithTimeout(`${API_BASE}/v1${path}`, {
    headers: tenantHeaders(tenant),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Response("Storefront upstream error", { status: 502 });
  }
  return (await response.json()) as T;
}

export const enc = encodeURIComponent;

export async function postJSON<T>(
  path: string,
  body: unknown,
  tenant?: TenantScope,
): Promise<
  { ok: true; result: T } | { ok: false; status: number; error: string }
> {
  const response = await fetchWithTimeout(`${API_BASE}/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...tenantHeaders(tenant),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: false,
      status: response.status,
      error: payload?.error ?? "upstream_error",
    };
  }
  return { ok: true, result: (await response.json()) as T };
}
