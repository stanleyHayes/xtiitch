// Server-side client for the Xtiitch public catalogue API. Storefront loaders
// call these; nothing here runs in the browser. The base URL points at the Go
// API and is overridable per environment.
const API_BASE = process.env.XTIITCH_API_URL ?? "http://localhost:8080";

export async function getJSON<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_BASE}/v1${path}`);
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
): Promise<
  { ok: true; result: T } | { ok: false; status: number; error: string }
> {
  const response = await fetch(`${API_BASE}/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
