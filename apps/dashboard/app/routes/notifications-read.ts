import type { ActionFunctionArgs } from "react-router";
import { apiFetch } from "../lib/auth";

// Clears this operator's new-order badge.
//
// A resource route rather than part of the messages page's own action: the
// dashboard's API tokens live in an httpOnly cookie and never reach the
// browser, so the badge-clearing fetch has to go through the server. Called
// once, from the client, when the owner actually opens the Messages view —
// deliberately NOT on load of the dashboard, or the badge would clear itself
// before she ever saw it.
export async function action({ request }: ActionFunctionArgs) {
  const response = await apiFetch(request, "/notifications/read", {
    method: "POST",
  });
  // Failing to clear a badge is not worth an error page. The next successful
  // visit clears it, and the count is only ever an over-report.
  return Response.json({ ok: response.ok }, { status: 200 });
}
