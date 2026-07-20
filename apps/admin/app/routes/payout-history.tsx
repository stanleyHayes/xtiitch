import type { Route } from "./+types/payout-history";
import { AdminApiError, adminApi } from "../lib/api";
import { requireAdminContext } from "../lib/session";

// Resource route backing the §11.5 payout-history drawer (every payout made to
// one store — amount, date, status — from Paystack's records). The admin token
// stays server-side; failures return in-band for inline display.
export async function loader({ request, params }: Route.LoaderArgs) {
  const { accessToken } = await requireAdminContext(request);
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "");
  const offset = Number(url.searchParams.get("offset") ?? "");

  try {
    const payouts = await adminApi.payoutHistory(accessToken, params.businessId, {
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    return { ok: true as const, payouts, error: null };
  } catch (error) {
    const message =
      error instanceof AdminApiError && error.status === 403
        ? "Your role cannot view payout history."
        : "Payout history could not be loaded right now.";
    return { ok: false as const, payouts: [], error: message };
  }
}
