// Marketplace directory client for the customer surface. Self-contained
// counterpart to src/api.ts: it only borrows the resolved base URL and talks to
// the Go API's unauthenticated `GET /public/shops` endpoint (mounted under the
// `/v1` prefix). The endpoint accepts no query params — the web marketplace
// (apps/storefront/app/features/marketplace/marketplace.tsx) filters, sorts,
// and tabs client-side, and the native screen mirrors that behaviour.
import { apiBaseUrl } from "./api";

// Mirrors the API's publicShopDesignResponse (catalogue/public.go).
export type ShopDesign = {
  title: string;
  handle: string;
  image: string;
  price_minor: number;
};

// Mirrors the API's publicShopResponse (catalogue/public.go).
export type Shop = {
  business_id: string;
  name: string;
  handle: string;
  brand_color: string;
  // Merchant's storefront banner (empty when unset). The card falls back to a
  // brand swatch, matching how the store page hero treats an unset banner.
  banner_url: string;
  design_count: number;
  designs: ShopDesign[];
};

export type ShopsPage = {
  shops: Shop[];
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

async function getJSON<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: response.status === 404 ? "not_found" : "upstream_error",
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "network_error",
    };
  }
}

export const marketplaceApi = {
  shops: () => getJSON<ShopsPage>(`/public/shops`),
};
