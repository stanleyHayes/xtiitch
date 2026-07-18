// Order-placement contracts shared by the made-to-wear, bespoke, booking,
// cart, and waitlist calls. Split from api.ts to keep both files under the
// repo's 400-line budget; api.ts re-exports everything for existing import sites.

export type PlaceOrderInput = {
  design_handle: string;
  size_band_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_whatsapp?: string;
  method: "momo" | "card";
  note?: string;
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

// The three bespoke measurement routes (mirrors the web storefront's
// CustomSizeMode and the API's order.SizeMode custom routes).
export type CustomSizeMode = "self_measure" | "home_visit" | "come_to_shop";

export type AvailabilitySlot = {
  slot_start: string;
  slot_end: string;
};

export type AvailabilityPage = {
  slots: AvailabilitySlot[];
};

export type DeliveryZone = {
  zone_id: string;
  name: string;
  fee_minor: number;
};

export type DeliveryZonesPage = {
  zones: DeliveryZone[];
};

// POST /public/stores/{handle}/custom-orders — bespoke self-measure and
// come-to-shop requests (checkout handler placeCustomOrderBody).
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

// POST /public/stores/{handle}/bookings — bespoke home-visit: pays the deposit
// and reserves one availability slot (checkout handler placeBookingBody).
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

// POST /public/stores/{handle}/cart-orders — the only order route that takes
// delivery details, so a made-to-wear order with delivery goes through it as a
// single-line cart (checkout handler placeCartOrderBody).
export type CartOrderLine = {
  design_handle: string;
  size_band_id?: string;
  kind: "made_to_wear" | "bespoke";
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

// POST /public/stores/{handle}/designs/{design_handle}/waitlist
// (catalogue handler joinWaitlistBody).
export type JoinWaitlistInput = {
  customer_name: string;
  customer_contact: string;
  note?: string;
};
