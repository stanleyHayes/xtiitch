import type { Route } from "./+types/growth-report-export";
import { requireAdminContext } from "../lib/session";
import { adminApiBase } from "../lib/api";

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAdminContext(request);
  const query = new URL(request.url).search;
  const response = await fetch(
    `${adminApiBase}/v1/admin/growth-report.csv${query}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Response("Unable to export growth reporting.", { status: 502 });
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="growth-report.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
