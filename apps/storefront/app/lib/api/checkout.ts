import { enc, getJSON, postJSON } from "./core";
import type {
  DeliveryZonesPage,
  PlaceCartOrderInput,
  PlaceMarketplaceOrderInput,
  PlaceOrderInput,
  PlaceOrderResult,
} from "./types";

export const placeOrder = (storeHandle: string, input: PlaceOrderInput) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/orders`,
    input,
  );

export const placeCartOrder = (
  storeHandle: string,
  input: PlaceCartOrderInput,
) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/cart-orders`,
    input,
  );

export const placeMarketplaceOrder = (input: PlaceMarketplaceOrderInput) =>
  postJSON<PlaceOrderResult>(`/public/marketplace/orders`, input);

export const deliveryZones = (storeHandle: string) =>
  getJSON<DeliveryZonesPage>(`/public/stores/${enc(storeHandle)}/delivery-zones`);
