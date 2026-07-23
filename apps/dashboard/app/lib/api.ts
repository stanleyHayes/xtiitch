// Server-side client for the Xtiitch public catalogue API. Storefront loaders
// call these; nothing here runs in the browser. The base URL points at the Go
// API and is overridable per environment.
import { fetchApi } from "./api-base";

export type StoreSettings = {
  bespoke_enabled: boolean;
  measurements_enabled: boolean;
  customisation_enabled: boolean;
  collections_enabled: boolean;
  delivery_enabled: boolean;
  dispatch_enabled: boolean;
  brand_color: string;
  logo_url?: string;
  banner_url?: string;
  layout_variant?: string;
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
  style_category?: string;
  images: string[];
  customisation_allowed: boolean;
  deposit_override_minor: number | null;
  // Indicative "from" price shown for a bespoke/customisation design (minor
  // units / pesewas), distinct from the deposit. 0 when not set.
  bespoke_display_minor?: number;
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

export type SearchPage = {
  store: StoreSummary;
  designs: Design[];
};

export type CollectionPage = {
  collection: Collection;
  designs: Design[];
};

async function getJSON<T>(path: string): Promise<T | null> {
  const response = await fetchApi(path);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Response("Storefront upstream error", { status: 502 });
  }
  return (await response.json()) as T;
}

const enc = encodeURIComponent;

export type PlaceOrderInput = {
  design_handle: string;
  size_band_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  method: "momo" | "card";
};

export type PlaceOrderResult = {
  order_id: string;
  reference: string;
  authorization_url: string;
  amount_minor: number;
};

export type PlaceOrderResponse =
  | { ok: true; result: PlaceOrderResult }
  | { ok: false; status: number; error: string };

async function postJSON<T>(path: string, body: unknown): Promise<{ ok: true; result: T } | { ok: false; status: number; error: string }> {
  const response = await fetchApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, status: response.status, error: payload?.error ?? "upstream_error" };
  }
  return { ok: true, result: (await response.json()) as T };
}

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

export const api = {
  store: (handle: string) => getJSON<StorePage>(`/public/stores/${enc(handle)}`),
  tracking: (orderId: string) => getJSON<Tracking>(`/public/orders/${enc(orderId)}`),
  search: (handle: string, query: string) =>
    getJSON<SearchPage>(`/public/stores/${enc(handle)}/search?q=${enc(query)}`),
  design: (handle: string) => getJSON<Design>(`/public/designs/${enc(handle)}`),
  collection: (handle: string) => getJSON<CollectionPage>(`/public/collections/${enc(handle)}`),
  placeOrder: (storeHandle: string, input: PlaceOrderInput) =>
    postJSON<PlaceOrderResult>(`/public/stores/${enc(storeHandle)}/orders`, input),
};
