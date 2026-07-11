import { enc, postJSON } from "./core";
import type { PlaceBookingInput, PlaceCustomOrderInput, PlaceOrderResult } from "./types";

export const placeCustomOrder = (
  storeHandle: string,
  input: PlaceCustomOrderInput,
) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/custom-orders`,
    input,
  );

export const placeBooking = (storeHandle: string, input: PlaceBookingInput) =>
  postJSON<PlaceOrderResult>(
    `/public/stores/${enc(storeHandle)}/bookings`,
    input,
  );
