// Platform subdomains and system words that are never a business store handle.
// Kept in sync with the API's reserved-handle list so these labels can route to
// their own surfaces (www/app/admin/api) instead of resolving a store.
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "store",
  "stores",
  "dashboard",
]);

// storeHandleFromHost resolves the business handle a request targets from its
// Host header. A store is reached at <handle>.xtiitch.com (in development,
// <handle>.localhost:<port>); the apex, www, and the reserved platform labels
// carry no store and return null so the storefront shows its generic landing.
export function storeHandleFromHost(host: string | null | undefined): string | null {
  if (!host) {
    return null;
  }
  const hostname = (host.split(":")[0] ?? "").trim().toLowerCase();
  if (!hostname || hostname === "localhost") {
    return null;
  }
  const labels = hostname.split(".");
  // The root is the last label for localhost, or the last two for a real domain
  // (e.g. xtiitch.com). A store needs at least one label in front of the root.
  const rootLabelCount = labels[labels.length - 1] === "localhost" ? 1 : 2;
  if (labels.length <= rootLabelCount) {
    return null;
  }
  const candidate = labels[0];
  if (!candidate || RESERVED_SUBDOMAINS.has(candidate)) {
    return null;
  }
  return candidate;
}
