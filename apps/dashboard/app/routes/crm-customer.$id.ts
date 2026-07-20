import type { Route } from "./+types/crm-customer.$id";
import { apiFetch } from "../lib/auth";

// Resource route: same-origin proxy for the §15.1 customer profile the CRM
// drawer loads on demand (GET /v1/crm/customers/{id}). The list page must not
// eager-load every profile, so the drawer fetches one record as it opens.
// Tenant scoping is enforced by the API — a cross-tenant id 404s and the
// drawer shows its "unavailable" state (§15.3).
export async function loader({ request, params }: Route.LoaderArgs) {
  const id = params.id ?? "";
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    throw new Response("Customer not found.", { status: 404 });
  }

  const response = await apiFetch(
    request,
    `/crm/customers/${encodeURIComponent(id)}`,
  );
  if (!response.ok) {
    throw new Response("This customer's record could not be loaded.", {
      status: response.status === 404 ? 404 : 502,
    });
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
