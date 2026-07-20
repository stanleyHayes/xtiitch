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
  // True when the storefront must carry the "Powered by Xtiitch" badge — i.e.
  // the plan does not grant its removal. Already resolved from the entitlement,
  // so never invert it here and never re-derive it from plan_code.
  show_powered_by_badge?: boolean;
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
  // Where Paystack returns the customer after paying (§5.2: back to the cart
  // to settle the next store basket). https; http allowed on localhost.
  callback_url?: string;
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
  // Where Paystack returns the customer after paying this basket (§5.2: back
  // to the cart, or home when no baskets remain).
  callback_url?: string;
};

// §5.2: no settle-all — the multi-store POST /public/marketplace/orders
// contract was removed from the API, so there are no marketplace-order input
// types here anymore.

// checkout-quote accepts the same shape as cart-orders with the customer
// fields optional (they do not affect pricing).
export type CheckoutQuoteInput = {
  items: CartOrderLine[];
  customer_name?: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_email?: string;
  method?: "momo" | "card";
  delivery_zone_id?: string;
  delivery_address?: string;
};

export type CheckoutQuoteLine = {
  design_handle: string;
  kind: string;
  amount_minor: number;
};

// The §4.5 fee breakdown for a basket, all GHS minor units.
// transaction_fee_minor is the single combined "Transaction fee" line and
// tax_minor the "Tax (VAT)" line; both are 0 when the owner absorbs the fees,
// in which case the checkout renders NO fee lines at all.
export type CheckoutQuote = {
  currency: string;
  lines: CheckoutQuoteLine[];
  delivery_fee_minor: number;
  items_total_minor: number;
  transaction_fee_minor: number;
  tax_minor: number;
  total_minor: number;
};

// The fee breakdown returned on order initiation (orders/cart-orders/
// custom-orders/bookings) — the same numbers the checkout-quote endpoint
// reported, so the UI can render from one source.
export type OrderFees = {
  items_total_minor: number;
  transaction_fee_minor: number;
  tax_minor: number;
  total_minor: number;
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
  // §4.5 breakdown of the charge that was initiated; present on every
  // initiation response and identical to what checkout-quote reported.
  fees?: OrderFees;
};

export type PlaceOrderResponse =
  | { ok: true; result: PlaceOrderResult }
  | { ok: false; status: number; error: string };

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
