import type { Route } from "./+types/business-activity";
import { AdminApiError, adminApi } from "../lib/api";
import { requireAdminContext } from "../lib/session";

// Resource route backing the §11.3 business activity feed. The admin access
// token lives server-side (in the session), so the drawer's client-side
// fetcher calls this route and we proxy the API with the token attached.
// Failures come back as `{ ok: false }` in-band (rather than a thrown
// Response) so the panel can show the reason inline instead of tripping an
// error boundary for what is a routine permission/connectivity hiccup —
// including sparse unverified tenants whose related rows may be incomplete.
export async function loader({ request, params }: Route.LoaderArgs) {
  const businessId = params.id?.trim();
  if (!businessId) {
    return {
      ok: false as const,
      activity: [],
      error: "Business id is missing from the activity request.",
    };
  }

  const { accessToken } = await requireAdminContext(request);
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "");
  const offset = Number(url.searchParams.get("offset") ?? "");

  try {
    const page = await adminApi.businessActivity(accessToken, businessId, {
      type: url.searchParams.get("type") ?? undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    return {
      ok: true as const,
      activity: Array.isArray(page.activity) ? page.activity : [],
      error: null,
    };
  } catch (error) {
    if (error instanceof AdminApiError) {
      if (error.status === 403) {
        return {
          ok: false as const,
          activity: [],
          error: "Your role cannot view this business's activity.",
        };
      }
      if (error.status === 404) {
        return {
          ok: false as const,
          activity: [],
          error: "That business could not be found for activity history.",
        };
      }
      if (error.status === 400) {
        return {
          ok: false as const,
          activity: [],
          error: "Activity filters look invalid. Try All events again.",
        };
      }
    }
    return {
      ok: false as const,
      activity: [],
      error: "Activity could not be loaded right now.",
    };
  }
}
