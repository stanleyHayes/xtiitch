// Server-side client for the Xtiitch public catalogue API. Storefront loaders
// call these; nothing here runs in the browser. The base URL points at the Go
// API and is overridable per environment.
const API_BASE = process.env.XTIITCH_API_URL ?? "http://localhost:8080";

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
  const response = await fetch(`${API_BASE}/v1${path}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Response("Storefront upstream error", { status: 502 });
  }
  return (await response.json()) as T;
}

const enc = encodeURIComponent;

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
};
