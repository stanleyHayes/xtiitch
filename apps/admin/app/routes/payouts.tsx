import type { Route } from "./+types/payouts";
import { AdminApiError, adminApi } from "../lib/api";
import { requireAdminContext } from "../lib/session";

// Resource route backing the §11.5 payouts CRM table. Search and pagination
// are server-side (query/limit/offset) so the table stays truthful as the
// tenant count grows; the admin token never leaves the server session.
// Failures return in-band so the section can render the reason inline.
export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAdminContext(request);
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "");
  const offset = Number(url.searchParams.get("offset") ?? "");

  try {
    const payouts = await adminApi.payouts(accessToken, {
      query: url.searchParams.get("query") ?? undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    return { ok: true as const, payouts, error: null };
  } catch (error) {
    const message =
      error instanceof AdminApiError && error.status === 403
        ? "Your role cannot view payout records."
        : "Payout records could not be loaded right now.";
    return { ok: false as const, payouts: [], error: message };
  }
}
