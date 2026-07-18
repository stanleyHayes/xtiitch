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
  logo_url: string;
  banner_url: string;
  layout_variant: string;
};

export type MeasurementField = {
  field_id: string;
  label: string;
  unit: string;
  sequence: number;
};

// Mirrors the API's storeSummary (catalogue/public.go) — the same shape serves
// the storefront page and the store embedded in a design response.
export type StoreSummary = {
  name: string;
  handle: string;
  brand_color: string;
  default_deposit_minor: number;
  measurement_fields: MeasurementField[];
  settings: StoreSettings;
  waitlist_enabled: boolean;
  online_ordering_enabled: boolean;
  // Already resolved server-side from the plan entitlement: render the badge
  // unless this is explicitly false (an older payload defaults to showing it —
  // attribution is the safe failure).
  show_powered_by_badge?: boolean;
  plan_code: string;
};

export type BandPrice = {
  size_band_id: string;
  label: string;
  price_minor: number;
  chart?: SizeChartItem[];
};

export type SizeChartItem = {
  name: string;
  value: string;
  unit: string;
};

export type DesignVariation = {
  variation_id: string;
  name: string;
  images: string[];
  is_default: boolean;
  sequence: number;
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
  variations?: DesignVariation[];
  store?: StoreSummary;
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

export type TrackingHandover = {
  method: string;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  courier: string;
  note: string;
  updated_at: string;
};

export type Tracking = {
  order_id: string;
  design_title: string;
  store_name: string;
  status: string;
  stage_name: string;
  colour: string;
  stages: TrackingStage[];
  handover?: TrackingHandover;
};

// Order-placement contracts live in orderContracts.ts (split for the file-size
// budget); re-exported so existing imports from "./api" keep working. The
// client below consumes them directly, so they are imported as well.
import type {
  AvailabilityPage,
  DeliveryZonesPage,
  JoinWaitlistInput,
  PlaceBookingInput,
  PlaceCartOrderInput,
  PlaceCustomOrderInput,
  PlaceOrderInput,
  PlaceOrderResult,
} from "./orderContracts";
export * from "./orderContracts";

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

async function postJSON<T>(path: string, input: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    });
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
  availability: (handle: string, range: { from: string; to: string }) =>
    getJSON<AvailabilityPage>(
      `/public/stores/${enc(handle)}/availability?from=${enc(range.from)}&to=${enc(range.to)}`,
    ),
  deliveryZones: (handle: string) =>
    getJSON<DeliveryZonesPage>(`/public/stores/${enc(handle)}/delivery-zones`),
  placeOrder: (storeHandle: string, input: PlaceOrderInput) =>
    postJSON<PlaceOrderResult>(
      `/public/stores/${enc(storeHandle)}/orders`,
      input,
    ),
  placeCartOrder: (storeHandle: string, input: PlaceCartOrderInput) =>
    postJSON<PlaceOrderResult>(
      `/public/stores/${enc(storeHandle)}/cart-orders`,
      input,
    ),
  placeCustomOrder: (storeHandle: string, input: PlaceCustomOrderInput) =>
    postJSON<PlaceOrderResult>(
      `/public/stores/${enc(storeHandle)}/custom-orders`,
      input,
    ),
  placeBooking: (storeHandle: string, input: PlaceBookingInput) =>
    postJSON<PlaceOrderResult>(
      `/public/stores/${enc(storeHandle)}/bookings`,
      input,
    ),
  joinWaitlist: (
    storeHandle: string,
    designHandle: string,
    input: JoinWaitlistInput,
  ) =>
    postJSON<{ status: string }>(
      `/public/stores/${enc(storeHandle)}/designs/${enc(designHandle)}/waitlist`,
      input,
    ),
};

// Order-placement error codes → customer-friendly copy. Ports the web
// storefront mapping (apps/storefront/app/features/design/utils.ts) and extends
// it for the codes only the order route emits, so a failed checkout never shows
// a raw code like `online_ordering_unavailable`.
export function orderErrorMessage(code: string): string {
  switch (code) {
    case "store_not_verified":
      return "This store needs to finish payment verification before it can take deposit payments.";
    case "store_cannot_take_order":
      return "This store has not enabled this order route yet.";
    case "online_ordering_unavailable":
      return "This store isn't taking online orders right now — reach out to the store directly to order.";
    case "promotion_unavailable":
      return "That promo code is not available for this order. Check the code, remove it, or try a different reward.";
    case "delivery_unavailable":
      return "Delivery isn't available for this order — contact the store to arrange handover.";
    case "slot_unavailable":
      return "That slot is no longer available. Please try again.";
    case "invalid_order":
      return "Check the size, contact details, and codes, then try again.";
    case "not_found":
      return "This piece is not available to order right now.";
    default:
      return "The order could not be placed. Please try again shortly.";
  }
}

// Minor units are pesewas; GHS has 100 pesewas. Format without trailing zeros
// noise but keep two decimals for the cedi amount.
export function formatGHS(minor: number): string {
  return `GH₵${(minor / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
