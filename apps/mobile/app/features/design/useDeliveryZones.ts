import { useEffect, useState } from "react";
import { api, type DeliveryZone, type StoreSummary } from "../../../src/api";
import type { DeliveryValues } from "./DesignDeliveryFields";

export type DeliveryZonesState = {
  offered: boolean;
  zones: DeliveryZone[] | null;
};

// Fetches the store's delivery zones when delivery is on offer, and defaults
// the selection to the first zone so the fee is visible as soon as the
// shopper picks "Deliver to me".
export function useDeliveryZones(
  store: StoreSummary,
  delivery: DeliveryValues,
  onChange: (field: keyof DeliveryValues, next: string) => void,
): DeliveryZonesState {
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const offered = store.settings.delivery_enabled === true;

  useEffect(() => {
    if (!offered) return;
    let cancelled = false;
    void api.deliveryZones(store.handle).then((result) => {
      if (!cancelled && result.ok) {
        setZones(result.data.zones);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [offered, store.handle]);

  useEffect(() => {
    if (
      delivery.fulfilment === "delivery" &&
      !delivery.zoneId &&
      zones &&
      zones.length > 0
    ) {
      onChange("zoneId", zones[0].zone_id);
    }
  }, [delivery.fulfilment, delivery.zoneId, zones, onChange]);

  return { offered, zones };
}
