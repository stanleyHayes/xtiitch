// Public catalogue client for the customer surface. Talks only to the Go API's
// unauthenticated `/public/*` endpoints (mounted under the `/v1` prefix), so no
// session handling is needed here. The base URL is resolved by the shared,
// unit-tested helper in surfaces.mjs; point it at the API with
// EXPO_PUBLIC_XTIITCH_API_URL (must include the `/v1` prefix), e.g.
// `http://localhost:8085/v1`.
import { resolveApiBaseUrl } from "./surfaces.mjs";

export type StoreSettings = {
  bespoke_enabled: boolean;
  measurements_enabled: boolean;
  customisation_enabled: boolean;
  collections_enabled: boolean;
  delivery_enabled: boolean;
  dispatch_enabled: boolean;
  brand_color: string;
};

export type StoreSummary = {
  name: string;
  handle: string;
  brand_color: string;
  settings: StoreSettings;
};

export type BandPrice = {
  size_band_id: string;
  label: string;
  price_minor: number;
};

// The store object embedded in a design response carries deposit + measurement
// context rather than the storefront settings block, so it is typed separately
// from StoreSummary.
export type DesignStore = {
  name: string;
  handle: string;
  brand_color: string;
  default_deposit_minor?: number;
};

export type Design = {
  design_id: string;
  collection_id: string | null;
  title: string;
  description: string;
  images: string[];
  customisation_allowed: boolean;
  deposit_override_minor: number | null;
  handle: string;
  status: string;
  sequence: number;
  prices: BandPrice[];
  store?: DesignStore;
};

export type Collection = {
  collection_id: string;
  name: string;
  theme: string;
  handle: string;
  status: string;
  sequence: number;
};

export type StorePage = {
  store: StoreSummary;
  collections: Collection[];
  designs: Design[];
};

export type TrackingStage = {
  name: string;
  colour: string;
  sequence: number;
  is_current: boolean;
  is_complete: boolean;
};

export type Tracking = {
  order_id: string;
  design_title: string;
  store_name: string;
  status: string;
  stage_name: string;
  colour: string;
  stages: TrackingStage[];
};

export type PlaceOrderInput = {
  design_handle: string;
  size_band_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  method: "momo" | "card";
  promo_code?: string;
  affiliate_code?: string;
  affiliate_click_id?: string;
  affiliate_visitor_id?: string;
  referral_code?: string;
};

export type PlaceOrderResult = {
  order_id: string;
  reference: string;
  authorization_url: string;
  amount_minor: number;
  discount_minor?: number;
};

export type SponsoredPlacement = {
  campaign_id: string;
  business_id: string;
  business_name: string;
  business_handle: string;
  placement_type: string;
  target_label: string;
  headline: string;
  description: string;
  store_handle: string;
  design_handle: string;
  image_url: string;
  starts_at: string;
  ends_at: string;
};

export type SponsoredResponse = {
  placements: SponsoredPlacement[];
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export function apiBaseUrl(): string {
  // Direct `process.env.EXPO_PUBLIC_*` access so babel-preset-expo inlines the
  // value at build time on native; the shared helper applies normalisation and
  // the localhost fallback.
  return resolveApiBaseUrl({
    EXPO_PUBLIC_XTIITCH_API_URL: process.env.EXPO_PUBLIC_XTIITCH_API_URL,
    XTIITCH_API_URL: process.env.XTIITCH_API_URL,
  });
}

const enc = encodeURIComponent;

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

export const api = {
  store: (handle: string) => getJSON<StorePage>(`/public/stores/${enc(handle)}`),
  search: (handle: string, query: string) =>
    getJSON<StorePage>(
      `/public/stores/${enc(handle)}/search?q=${enc(query)}`,
    ),
  design: (handle: string) => getJSON<Design>(`/public/designs/${enc(handle)}`),
  sponsored: () => getJSON<SponsoredResponse>(`/public/sponsored`),
  tracking: (orderId: string) =>
    getJSON<Tracking>(`/public/orders/${enc(orderId)}`),
  async placeOrder(
    storeHandle: string,
    input: PlaceOrderInput,
  ): Promise<ApiResult<PlaceOrderResult>> {
    try {
      const response = await fetch(
        `${apiBaseUrl()}/public/stores/${enc(storeHandle)}/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as { error?: string } | null;
        return {
          ok: false,
          status: response.status,
          error: payload?.error ?? "upstream_error",
        };
      }
      return { ok: true, data: (await response.json()) as PlaceOrderResult };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "network_error",
      };
    }
  },
};

// Minor units are pesewas; GHS has 100 pesewas. Format without trailing zeros
// noise but keep two decimals for the cedi amount.
export function formatGHS(minor: number): string {
  return `GH₵${(minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
