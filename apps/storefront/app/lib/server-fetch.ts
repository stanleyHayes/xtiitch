// Storefront loaders run on the server and must never wait forever for the API.
// This is especially important on a Paystack return: an unbounded verification
// request leaves React Router in its loading state with no way for the shopper
// to retry. Keep the timeout above the API's 15-second Paystack client timeout
// so provider verification gets a fair chance to finish first.
export const UPSTREAM_TIMEOUT_MS = 20_000;

export function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = UPSTREAM_TIMEOUT_MS,
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}
