import type { Route } from "./+types/customer-export";
import { requireAdminContext } from "../lib/session";
import { adminApiBase } from "../lib/api";

// Resource route: proxies the API's Data Protection Act (Act 843) subject-access
// export and streams it back as a downloadable JSON file. The admin access token
// lives server-side (in the session), so the download is authorised here rather
// than from the browser.
export async function loader({ request, params }: Route.LoaderArgs) {
  const { accessToken } = await requireAdminContext(request);
  const id = params.id;

  const response = await fetch(
    `${adminApiBase}/v1/admin/customers/${encodeURIComponent(id)}/export`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    throw new Response("Unable to export this customer's data.", {
      status: response.status === 404 ? 404 : 502,
    });
  }

  const data = await response.json();
  const body = JSON.stringify(data, null, 2);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="xtiitch-customer-${id}-export.json"`,
      "Cache-Control": "no-store",
    },
  });
}
