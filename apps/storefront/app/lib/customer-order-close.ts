import { fetchWithTimeout } from "./server-fetch";

const API_BASE = process.env.XTIITCH_API_URL ?? "http://localhost:8080";

export type CloseAwaitingPaymentResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

// Dismiss a draft from both customer and business order lists. The API closes
// the full checkout basket when the selected order is one cart line.
export async function closeAwaitingPaymentOrder(
  token: string,
  orderID: string,
): Promise<CloseAwaitingPaymentResult> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/v1/customer/orders/${encodeURIComponent(orderID)}/close`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (response.ok) return { ok: true };

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: false,
      status: response.status,
      error: payload?.error ?? "upstream_error",
    };
  } catch {
    return { ok: false, status: 504, error: "upstream_timeout" };
  }
}
