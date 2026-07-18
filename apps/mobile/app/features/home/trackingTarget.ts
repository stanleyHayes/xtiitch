// Parses a pasted tracking reference into a bare order id. Ports the web
// storefront's track-lookup logic (apps/storefront/app/routes/track-lookup.tsx):
// a pasted tracking URL yields the id after `/track/`; anything else is treated
// as a plain id with an optional `#` prefix.
export function trackingTarget(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }

  const link = /^[a-z][a-z0-9+.-]*:\/\/[^/]+\/track\/([^/?#]+)/i.exec(value);
  if (link) {
    try {
      return decodeURIComponent(link[1]).trim();
    } catch {
      return link[1].trim();
    }
  }

  return value.replace(/^#/, "").trim();
}
