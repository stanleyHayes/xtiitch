// Base origin of the Xtiitch API — WITHOUT the /v1 suffix (the app appends
// /v1 itself), matching the XTIITCH_API_URL convention of the other web apps.
const API_BASE_URL = `${(
  process.env.XTIITCH_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "")}/v1`;

// Status used when the API cannot be reached at all (DNS failure, connection
// refused, socket hang-up). It is not a status the API returned — there was no
// response — but giving it one means every caller can handle "the service is
// unavailable" with the same `error instanceof Response` check it already uses
// for real failures, instead of a raw TypeError escaping into a crash page.
export const API_UNREACHABLE_STATUS = 503;

export type AffiliateAuthResponse = {
  account: {
    account_id: string;
    affiliate_id: string;
    email: string;
    display_name: string;
    code: string;
    status: string;
  };
  access_token: string;
  refresh_token: string;
};

export async function affiliateAPI<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers
      }
    });
  } catch {
    // fetch rejects (rather than resolving non-ok) when the API is down or the
    // connection drops mid-flight. Unhandled, that surfaced as a blank crash
    // page rather than "we can't reach the service right now".
    throw new Response("affiliate_api_unreachable", {
      status: API_UNREACHABLE_STATUS
    });
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Response(body?.error ?? "Affiliate API request failed", {
      status: response.status
    });
  }
  if (response.status === 204) {
    return undefined as T;
  }

  // The success path used to call response.json() unguarded. A 200 carrying a
  // non-JSON body — a proxy's HTML error page, a truncated response — rejected
  // here and took the whole route down. A malformed success is a failed
  // request, so it is reported as one.
  try {
    return (await response.json()) as T;
  } catch {
    throw new Response("affiliate_api_malformed_response", { status: 502 });
  }
}

// For endpoints that stream bytes rather than JSON (the QR png, the CSV
// export). Same unreachable-service guard as affiliateAPI, so a download does
// not crash the route when the API is down.
export async function affiliateRaw(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Response("affiliate_api_unreachable", {
      status: API_UNREACHABLE_STATUS
    });
  }
}

export function authorized(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}
