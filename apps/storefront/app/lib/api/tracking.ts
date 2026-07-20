import { enc, getJSON, type TenantScope } from "./core";
import type { Tracking } from "./types";

export const tracking = (orderId: string, tenant?: TenantScope) =>
  getJSON<Tracking>(`/public/orders/${enc(orderId)}`, tenant);
