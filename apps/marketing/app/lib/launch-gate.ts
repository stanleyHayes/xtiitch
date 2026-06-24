import { redirect } from "react-router";

const API_BASE =
  (typeof process !== "undefined" ? process.env.XTIITCH_API_URL : undefined) ??
  "http://localhost:8080";

type FlagKey = "browse_store" | "discover" | "create_store" | "pricing";

// Server-side gate for pre-launch marketing routes. A loader calls this so a
// flag-gated page can't be reached by direct URL before launch — matching the
// nav-level gating in the header. It reads the live marketing flags from the
// public branding endpoint; on ANY failure the flag is treated as off and the
// visitor is redirected home (fail-safe = hidden), so a network blip can never
// expose a pre-launch page.
export async function requireMarketingFlag(flag: FlagKey): Promise<void> {
  let live = false;
  try {
    const response = await fetch(`${API_BASE}/v1/branding`, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const data = (await response.json()) as {
        marketing_flags?: Record<string, unknown>;
      };
      live = data.marketing_flags?.[flag] === true;
    }
  } catch {
    live = false;
  }
  if (!live) {
    throw redirect("/");
  }
}
