import type { LoaderFunctionArgs } from "react-router";
import { affiliateRaw } from "../lib/api.server";
import { withAffiliateAuth } from "../lib/auth.server";

// Goes through withAffiliateAuth like the portal does: an affiliate who leaves
// the tab open long enough for the access token to expire should still get
// their QR code, not a broken download.
export async function loader({ request }: LoaderFunctionArgs) {
  const { data, setCookie } = await withAffiliateAuth(
    request,
    async (headers: HeadersInit) => {
      const response = await affiliateRaw("/affiliate/share-links/qr.png", {
        headers
      });
      if (!response.ok) {
        // Rethrown as a Response so a 401 reaches the refresh path rather than
        // being flattened into a generic failure.
        throw new Response("Unable to generate QR code", {
          status: response.status
        });
      }
      return await response.arrayBuffer();
    }
  );

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Content-Disposition": `attachment; filename="xtiitch-affiliate-qr.png"`
  };
  if (setCookie) {
    headers["Set-Cookie"] = setCookie;
  }
  return new Response(data, { headers });
}
