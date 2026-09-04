import { redirect, type LoaderFunctionArgs } from "react-router";
import { affiliateRaw } from "../lib/api.server";
import { withAffiliateAuth } from "../lib/auth.server";

// Same treatment as the QR route: refresh-aware, so an export started after
// the access token expired still downloads instead of failing.
export async function loader({ request }: LoaderFunctionArgs) {
  const query = new URL(request.url).search;

  let csv: string;
  let setCookie: string | undefined;
  try {
    const result = await withAffiliateAuth(
      request,
      async (headers: HeadersInit) => {
        const response = await affiliateRaw(
          `/affiliate/reports/conversions.csv${query}`,
          { headers }
        );
        if (!response.ok) {
          throw new Response("Unable to export report", {
            status: response.status
          });
        }
        return await response.text();
      }
    );
    csv = result.data;
    setCookie = result.setCookie;
  } catch (error) {
    // A redirect (dead session -> sign in) is a deliberate outcome.
    if (isRedirect(error)) {
      throw error;
    }
    // This route is opened by a plain download link, so an HTML error response
    // REPLACES the whole portal with a full-screen error page — a failed CSV
    // export should not cost the affiliate their page. Same reasoning, and the
    // same remedy, as routes/qr.tsx.
    throw redirect("/portal?tab=earnings&export=unavailable");
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="affiliate-conversions.csv"`
  };
  if (setCookie) {
    headers["Set-Cookie"] = setCookie;
  }
  return new Response(csv, { headers });
}

function isRedirect(error: unknown): boolean {
  return (
    error instanceof Response && error.status >= 300 && error.status < 400
  );
}
