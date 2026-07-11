import { enc, getJSON } from "./core";
import type { Tracking } from "./types";

export const tracking = (orderId: string) =>
  getJSON<Tracking>(`/public/orders/${enc(orderId)}`);
