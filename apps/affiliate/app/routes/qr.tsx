import { redirect, type LoaderFunctionArgs } from "react-router";
import { affiliateRaw } from "../lib/api.server";
import { withAffiliateAuth } from "../lib/auth.server";

// Goes through withAffiliateAuth like the portal does: an affiliate who leaves
// the tab open long enough for the access token to expire should still get
// their QR code, not a broken download.
export async function loader({ request }: LoaderFunctionArgs) {
  // The tab the affiliate was on, so a failure can put them back where they
  // were rather than on the default section.
  const tab = new URL(request.url).searchParams.get("tab") ?? "";

  let png: ArrayBuffer;
  let setCookie: string | undefined;
  try {
    const result = await withAffiliateAuth(
      request,
      async (headers: HeadersInit) => {
        const response = await affiliateRaw("/affiliate/share-links/qr.png", {
          headers
        });
        if (!response.ok) {
          // Rethrown as a Response so a 401 reaches the refresh path rather
          // than being flattened into a generic failure.
          throw new Response("Unable to generate QR code", {
            status: response.status
          });
        }
        return await response.arrayBuffer();
      }
    );
    png = result.data;
    setCookie = result.setCookie;
  } catch (error) {
    // A redirect is a deliberate outcome (a dead session sends the affiliate
    // to sign in), so it has to run.
    if (isRedirect(error)) {
      throw error;
    }
    // Everything else must NOT reach the root error boundary. This route is
    // opened by a plain link, and a browser only stays on the page when the
    // response is a file — the moment this returns an HTML error page, that
    // page REPLACES the portal. A failed download would take the affiliate's
    // whole portal away and drop them on a full-screen "Something went wrong",
    // which is what made a QR failure look like the portal itself breaking.
    // Send them back to the portal with a flag the share card renders inline.
    throw redirect(portalURL(tab));
  }

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Content-Disposition": `attachment; filename="xtiitch-affiliate-qr.png"`
  };
  if (setCookie) {
    headers["Set-Cookie"] = setCookie;
  }
  return new Response(png, { headers });
}

function isRedirect(error: unknown): boolean {
  return (
    error instanceof Response && error.status >= 300 && error.status < 400
  );
}

function portalURL(tab: string): string {
  const params = new URLSearchParams();
  if (tab) {
    params.set("tab", tab);
  }
  params.set("qr", "unavailable");
  return `/portal?${params.toString()}`;
}
