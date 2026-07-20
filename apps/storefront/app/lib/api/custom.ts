import { enc, postJSON, type TenantScope } from "./core";
import type {
  PlaceBookingInput,
  PlaceCustomOrderInput,
  PlaceOrderResult,
} from "./types";

export const placeCustomOrder = (
  storeHandle: string,
  input: PlaceCustomOrderInput,
  tenant?: TenantScope,
) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/custom-orders`,
    input,
    tenant,
  );

export const placeBooking = (
  storeHandle: string,
  input: PlaceBookingInput,
  tenant?: TenantScope,
) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/bookings`,
    input,
    tenant,
  );
