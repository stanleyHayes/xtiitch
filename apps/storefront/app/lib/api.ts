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
  // Plan-gated customizations (empty/"standard" when not set or not entitled).
  logo_url?: string;
  banner_url?: string;
  layout_variant?: string;
};

export type MeasurementField = {
  field_id: string;
  label: string;
  unit: "cm" | "in";
  sequence: number;
};

export type StoreSummary = {
  name: string;
  handle: string;
  brand_color: string;
  default_deposit_minor: number;
  measurement_fields: MeasurementField[];
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

export type AvailabilitySlot = {
  slot_start: string;
  slot_end: string;
};

export type AvailabilityPage = {
  slots: AvailabilitySlot[];
};

export type PublicShopDesign = {
  title: string;
  handle: string;
  image: string;
  price_minor: number;
};

export type PublicShop = {
  business_id: string;
  name: string;
  handle: string;
  brand_color: string;
  design_count: number;
  designs: PublicShopDesign[];
};

export type PublicShopsPage = {
  shops: PublicShop[];
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

export type CustomSizeMode = "self_measure" | "home_visit" | "come_to_shop";

export type PlaceCustomOrderInput = {
  design_handle: string;
  size_mode: CustomSizeMode;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  method?: "momo" | "card";
  promo_code?: string;
  affiliate_code?: string;
  affiliate_click_id?: string;
  affiliate_visitor_id?: string;
  referral_code?: string;
  measurements?: Record<string, string>;
};

export type PlaceBookingInput = {
  design_handle: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  method: "momo" | "card";
  affiliate_code?: string;
  affiliate_click_id?: string;
  affiliate_visitor_id?: string;
  referral_code?: string;
  slot_start: string;
  address: string;
};

export type PlaceOrderResult = {
  order_id: string;
  reference: string;
  authorization_url: string;
  amount_minor: number;
  discount_minor: number;
};

export type PlaceOrderResponse =
  | { ok: true; result: PlaceOrderResult }
  | { ok: false; status: number; error: string };

async function postJSON<T>(
  path: string,
  body: unknown,
): Promise<
  { ok: true; result: T } | { ok: false; status: number; error: string }
> {
  const response = await fetch(`${API_BASE}/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: false,
      status: response.status,
      error: payload?.error ?? "upstream_error",
    };
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

export type ReferralCode = {
  referral_code_id: string;
  referral_programme_id: string;
  business_id?: string | null;
  owner_type: string;
  code: string;
  title: string;
  audience: string;
  referrer_reward_kind: string;
  referee_reward_kind: string;
  reward_type: string;
  reward_value: number;
  max_reward_minor?: number | null;
  qualifying_order_min_minor: number;
  reward_hold_days: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
};

export type AffiliateClickInput = {
  visitor_id: string;
  landing_url: string;
  referrer_url: string;
};

export type AffiliateClick = {
  click_id: string;
  affiliate_id: string;
  code: string;
  clicked_at: string;
};

export const api = {
  store: (handle: string) =>
    getJSON<StorePage>(`/public/stores/${enc(handle)}`),
  tracking: (orderId: string) =>
    getJSON<Tracking>(`/public/orders/${enc(orderId)}`),
  search: (handle: string, query: string) =>
    getJSON<SearchPage>(`/public/stores/${enc(handle)}/search?q=${enc(query)}`),
  design: (handle: string) => getJSON<Design>(`/public/designs/${enc(handle)}`),
  collection: (handle: string) =>
    getJSON<CollectionPage>(`/public/collections/${enc(handle)}`),
  referral: (code: string) =>
    getJSON<ReferralCode>(`/public/referrals/${enc(code)}`),
  availability: (handle: string) =>
    getJSON<AvailabilityPage>(`/public/stores/${enc(handle)}/availability`),
  shops: () => getJSON<PublicShopsPage>(`/public/shops`),
  recordAffiliateClick: (code: string, input: AffiliateClickInput) =>
    postJSON<AffiliateClick>(`/public/affiliates/${enc(code)}/clicks`, input),
  placeOrder: (storeHandle: string, input: PlaceOrderInput) =>
    postJSON<PlaceOrderResult>(
      `/public/stores/${enc(storeHandle)}/orders`,
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
};
