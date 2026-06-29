import type { LoaderFunctionArgs } from "react-router";
import { fetchApi } from "../lib/api-base";

// Resource route backing the signup form's real-time store-handle availability
// check. The Go API base is configured server-side and is not reachable from
// the browser, so the form fetches this same-origin route (GET /handle-check?
// handle=...) and we forward to the public API endpoint server-side.
//
// Response shape mirrors the API: { handle, available, reason }, where reason is
// one of "" | "invalid" | "reserved" | "taken" (or "error" on a network fault).
// There is no component export — this is a pure resource route.

type HandleAvailability = {
  handle: string;
  available: boolean;
  reason: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const handle = new URL(request.url).searchParams.get("handle")?.trim() ?? "";
  if (!handle) {
    return Response.json({ handle: "", available: false, reason: "invalid" });
  }

  try {
    const response = await fetchApi(
      `/auth/business/handle-availability?handle=${encodeURIComponent(handle)}`,
      { method: "GET" },
    );
    if (!response.ok) {
      return Response.json({ handle, available: false, reason: "error" });
    }
    const body = (await response.json()) as HandleAvailability;
    return Response.json(body);
  } catch {
    return Response.json({ handle, available: false, reason: "error" });
  }
}
