import type { Route } from "./+types/report-download";
import { apiFetch } from "../lib/auth";

// Resource route: same-origin download proxy for the §14.3 report exports and
// the §15.1 customer-list export. The owner's access token lives server-side
// in the session, so the file is fetched here (with Bearer auth) and streamed
// back with the API's own Content-Type / Content-Disposition — the browser
// only ever sees an authenticated same-origin URL to <a href download>.
//
// Both the report kind and the format are whitelisted: this must never become
// an open proxy to arbitrary API paths. Entitlement (export_not_entitled,
// analytics level for the full suite) is enforced API-side; a refusal comes
// back as a plain error page, not a downloaded file.

const REPORT_PATHS: Record<string, string> = {
  financial: "/reports/financial",
  sales: "/reports/sales",
  full: "/reports/full",
  // §15.1: the CRM customer-list export (CSV at Growth, any format Studio).
  customers: "/crm/customers/export",
};

const FORMATS = new Set(["csv", "pdf", "docx", "xlsx"]);

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const report = url.searchParams.get("report") ?? "";
  const format = url.searchParams.get("format") ?? "";
  const path = REPORT_PATHS[report];
  if (!path || !FORMATS.has(format)) {
    throw new Response("Unknown report or format.", { status: 400 });
  }

  const params = new URLSearchParams({ format });
  // Studio's custom date range passes through when present (the API accepts
  // from/to on reports for Studio-level plans only and 403s otherwise).
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }

  const response = await apiFetch(request, `${path}?${params.toString()}`);
  if (!response.ok) {
    throw new Response(
      response.status === 403
        ? "That export isn't on your plan."
        : "The report could not be generated right now. Try again shortly.",
      { status: response.status === 403 ? 403 : 502 },
    );
  }

  const body = await response.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition":
        response.headers.get("Content-Disposition") ??
        `attachment; filename="xtiitch-${report}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
