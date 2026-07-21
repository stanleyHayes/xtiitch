import { enc, getJSON, postJSON, type TenantScope } from "./core";
import type {
  CheckoutQuote,
  CheckoutQuoteInput,
  DeliveryZonesPage,
  PaymentVerification,
  PlaceCartOrderInput,
  PlaceOrderInput,
  PlaceOrderResult,
} from "./types";

export const placeOrder = (
  storeHandle: string,
  input: PlaceOrderInput,
  tenant?: TenantScope,
) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/orders`,
    input,
    tenant,
  );

export const placeCartOrder = (
  storeHandle: string,
  input: PlaceCartOrderInput,
  tenant?: TenantScope,
) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/cart-orders`,
    input,
    tenant,
  );

// §5.2: there is deliberately no settle-all client — payment happens
// store-basket by store-basket and the API's multi-store
// POST /public/marketplace/orders endpoint is gone (404).

// §4.5: the read-only fee breakdown for a basket. Same payload shape as
// cart-orders (customer fields optional/ignored); the checkout page renders
// these exact lines — combined "Transaction fee" and "Tax (VAT)" lines, both
// 0 when the owner absorbs the fees — so what the customer sees is what the
// charge asks for. POST because a browser fetch cannot body-GET.
export const checkoutQuote = (
  storeHandle: string,
  input: CheckoutQuoteInput,
  tenant?: TenantScope,
) =>
  postJSON<CheckoutQuote>(
    `/public/stores/${enc(storeHandle)}/checkout-quote`,
    input,
    tenant,
  );

export const deliveryZones = (storeHandle: string, tenant?: TenantScope) =>
  getJSON<DeliveryZonesPage>(
    `/public/stores/${enc(storeHandle)}/delivery-zones`,
    tenant,
  );

// Verifies the reference Paystack appended to the callback_url when returning
// the customer. The checkout/account loaders call this before believing any
// "paid" state: only "succeeded" clears a basket or confirms an order —
// ?reference= alone (like the old ?paid= flag) proves nothing.
export const verifyPayment = (
  storeHandle: string,
  reference: string,
  tenant?: TenantScope,
) =>
  postJSON<PaymentVerification>(
    `/public/stores/${enc(storeHandle)}/payments/verify`,
    { reference },
    tenant,
  );
