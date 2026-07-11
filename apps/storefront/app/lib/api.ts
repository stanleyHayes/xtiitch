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
  // True when the store's plan grants the design_waitlist benefit.
  waitlist_enabled?: boolean;
  // True when the store's plan grants the online_ordering benefit. When false the
  // storefront is a catalogue only and checkout is refused server-side.
  online_ordering_enabled?: boolean;
  // The store's current plan code (e.g. "free", "starter", "growth", "studio").
  // The "Discover other studios" strip only shows for free-plan stores.
  plan_code?: string;
};

export type SizeChartItem = {
  name: string;
  value: string;
  unit: string;
};

export type BandPrice = {
  size_band_id: string;
  label: string;
  price_minor: number;
  // The size band's measurement chart, shown to customers under the size option.
  chart?: SizeChartItem[];
};

// A colour (or fabric) variation of a design. Shares the design's price and
// order flow; only the images shown in the gallery differ. The default design's
// own photos are the first swatch, so `variations` holds the alternates.
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
  // Colour variations for the swatch picker. Absent/empty means the design has
  // only its default images.
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
  // Merchant's storefront banner (empty when unset). The discovery card uses it
  // so its cover matches the store page hero, which renders the same banner.
  banner_url: string;
  design_count: number;
  designs: PublicShopDesign[];
};

export type PublicShopsPage = {
  shops: PublicShop[];
};

// A paid placement on the marketplace (a featured studio or design). Surfaced in
// the "Featured" row; clicking opens the shop/design.
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

export type SponsoredPage = {
  placements: SponsoredPlacement[];
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
  customer_whatsapp?: string;
  customer_email: string;
  method: "momo" | "card";
  promo_code?: string;
  affiliate_code?: string;
  affiliate_click_id?: string;
  affiliate_visitor_id?: string;
  referral_code?: string;
  note?: string;
};

export type CartOrderLine = {
  design_handle: string;
  size_band_id: string;
  kind?: "made_to_wear" | "bespoke";
  size_mode?: CustomSizeMode;
  measurements?: Record<string, string>;
  note?: string;
};

export type PlaceCartOrderInput = {
  items: CartOrderLine[];
  customer_name: string;
  customer_phone: string;
  customer_whatsapp?: string;
  customer_email: string;
  method: "momo" | "card";
  delivery_zone_id?: string;
  delivery_address?: string;
};

// A unified marketplace basket paid in one split charge (§4 "pay once"): each
// store's lines settle to that store's own subaccount. Pickup only.
export type MarketplaceOrderStore = {
  store_handle: string;
  items: CartOrderLine[];
};

export type PlaceMarketplaceOrderInput = {
  stores: MarketplaceOrderStore[];
  customer_name: string;
  customer_phone: string;
  customer_whatsapp?: string;
  customer_email: string;
  method: "momo" | "card";
};

export type DeliveryZone = {
  zone_id: string;
  name: string;
  fee_minor: number;
};

export type DeliveryZonesPage = {
  zones: DeliveryZone[];
};

export type CustomSizeMode = "self_measure" | "home_visit" | "come_to_shop";

export type PlaceCustomOrderInput = {
  design_handle: string;
  size_mode: CustomSizeMode;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp?: string;
  customer_email: string;
  method?: "momo" | "card";
  promo_code?: string;
  affiliate_code?: string;
  affiliate_click_id?: string;
  affiliate_visitor_id?: string;
  referral_code?: string;
  measurements?: Record<string, string>;
  note?: string;
};

export type PlaceBookingInput = {
  design_handle: string;
  customer_name: string;
  customer_phone: string;
  customer_whatsapp?: string;
  customer_email: string;
  method: "momo" | "card";
  affiliate_code?: string;
  affiliate_click_id?: string;
  affiliate_visitor_id?: string;
  referral_code?: string;
  slot_start: string;
  address: string;
  note?: string;
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
  availability: (handle: string, range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) {
      params.set("from", range.from);
    }
    if (range?.to) {
      params.set("to", range.to);
    }
    const query = params.toString();
    return getJSON<AvailabilityPage>(
      `/public/stores/${enc(handle)}/availability${query ? `?${query}` : ""}`,
    );
  },
  shops: () => getJSON<PublicShopsPage>(`/public/shops`),
  sponsored: (limit = 8) =>
    getJSON<SponsoredPage>(`/public/sponsored?limit=${limit}`),
  recordAffiliateClick: (code: string, input: AffiliateClickInput) =>
    postJSON<AffiliateClick>(`/public/affiliates/${enc(code)}/clicks`, input),
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
  placeMarketplaceOrder: (input: PlaceMarketplaceOrderInput) =>
    postJSON<PlaceOrderResult>(`/public/marketplace/orders`, input),
  deliveryZones: (storeHandle: string) =>
    getJSON<DeliveryZonesPage>(
      `/public/stores/${enc(storeHandle)}/delivery-zones`,
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
    input: { customer_name: string; customer_contact: string; note: string },
  ) =>
    postJSON<{ status: string }>(
      `/public/stores/${enc(storeHandle)}/designs/${enc(designHandle)}/waitlist`,
      input,
    ),
};
