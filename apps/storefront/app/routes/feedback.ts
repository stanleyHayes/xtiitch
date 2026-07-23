import type { ActionFunctionArgs } from "react-router";
import { postJSON } from "../lib/api";
import { requestTenant } from "../lib/tenant";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await postJSON<{ feedback_report_id: string }>(
    "/public/feedback",
    {
      ...(body ?? {}),
      surface: "storefront",
      reporter_type: body?.reporter_type ?? "customer",
      store_handle: body?.store_handle ?? requestTenant(request) ?? "",
    },
    requestTenant(request),
  );
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.json(result.result, { status: 201 });
}
