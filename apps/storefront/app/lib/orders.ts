import type { CustomerOrder } from "./discovery";

// §5.3 customer-account order shaping, kept pure (no fetch/React) so the
// grouping and tab rules are unit-testable.

// Final-stage statuses (§5.3.2): when the store owner moves an order here in
// their dashboard, it leaves "Current orders" for the "Archived orders" tab,
// where it carries a "Received" button. Mirrors the completed set in
// features/account/utils orderStatus.
const FINAL_STAGE_STATUSES = new Set([
  "completed",
  "delivered",
  "fulfilled",
  "handed_over",
]);

export function isFinalStage(status: string): boolean {
  return FINAL_STAGE_STATUSES.has(status.toLowerCase());
}

// visibleOrders drops acknowledged orders — a received_at stamp means the
// customer has the piece in hand and the order disappears everywhere (§5.3.2).
export function visibleOrders(orders: CustomerOrder[]): CustomerOrder[] {
  return orders.filter((order) => !order.received_at);
}

// One store basket: the lines of a single checkout to that store. groupId is
// the checkout_group_id for basket checkouts; single checkouts (null group)
// each stand alone as their own one-design basket.
export type OrderBasket = {
  groupId: string | null;
  orders: CustomerOrder[];
};

export type StoreOrderGroup = {
  storeHandle: string;
  storeName: string;
  // §5.3.3: the store's phone, attached to every order so the customer can
  // call about it. Kept at group level too for the header.
  storePhone: string;
  baskets: OrderBasket[];
};

// groupOrdersByStore shapes orders the way they were bought (§5.3.1): one
// group per store (first-seen order), and inside it one basket per
// checkout_group_id; single orders group under the store as stand-alone
// one-design baskets.
export function groupOrdersByStore(orders: CustomerOrder[]): StoreOrderGroup[] {
  const groups: StoreOrderGroup[] = [];
  const byHandle = new Map<string, StoreOrderGroup>();
  const basketIndex = new Map<string, OrderBasket>();

  for (const order of orders) {
    let group = byHandle.get(order.business_handle);
    if (!group) {
      group = {
        storeHandle: order.business_handle,
        storeName: order.business_name,
        storePhone: order.store_phone,
        baskets: [],
      };
      byHandle.set(order.business_handle, group);
      groups.push(group);
    }
    if (order.checkout_group_id) {
      let basket = basketIndex.get(order.checkout_group_id);
      if (!basket) {
        basket = { groupId: order.checkout_group_id, orders: [] };
        basketIndex.set(order.checkout_group_id, basket);
        group.baskets.push(basket);
      }
      basket.orders.push(order);
    } else {
      group.baskets.push({ groupId: null, orders: [order] });
    }
  }
  return groups;
}

export type OrderTabs = {
  current: CustomerOrder[];
  archived: CustomerOrder[];
};

// splitTabs segments visible orders into the two account tabs (§5.3.2):
// "Current orders" holds everything still active; "Archived orders" holds
// final-stage orders not yet acknowledged (received_at null — already
// guaranteed by visibleOrders, but kept explicit for clarity).
export function splitTabs(orders: CustomerOrder[]): OrderTabs {
  const visible = visibleOrders(orders);
  return {
    current: visible.filter((order) => !isFinalStage(order.status)),
    archived: visible.filter((order) => isFinalStage(order.status)),
  };
}

// kindLabel renders the API's standard|bespoke order kind for the card chip.
export function kindLabel(kind: string): string {
  const value = kind.toLowerCase();
  if (value === "bespoke") {
    return "Bespoke";
  }
  if (value === "standard" || value === "made_to_wear") {
    return "Standard";
  }
  return kind;
}
