import { createCookieSessionStorage } from "react-router";

// The shopping cart is held in its own signed, httpOnly cookie (separate from the
// auth session) so an account isn't required to add items — the shopper builds a
// cart first and signs in at checkout. The basket is UNIFIED across stores
// (Updates §4): items from several shops coexist, grouped by store_handle. Each
// store settles to its own subaccount, so checkout operates on ONE store's group
// at a time (checkout?store=<handle>) and clears only that store's lines on
// success, leaving the other stores' items in the basket.

export type CartItemKind = "made_to_wear" | "bespoke";
export const MAX_CART_ITEMS_PER_STORE = 50;

export type PendingCartPayment = {
  store_handle: string;
  order_id: string;
  reference: string;
  delivery_zone_id?: string;
};

export type CartItem = {
  // Stable id for one distinct product configuration.
  line_id: string;
  store_handle: string;
  design_handle: string;
  title: string;
  image: string;
  kind: CartItemKind;
  // For made-to-wear: the chosen size band + its price. For bespoke: the deposit.
  size_band_id: string;
  size_label: string;
  amount_minor: number;
  // Bespoke cart lines use self-measure as the cart-compatible custom route and
  // carry the customer's measurements until checkout creates the draft order.
  size_mode?: "self_measure" | "home_visit" | "come_to_shop";
  measurements?: Record<string, string>;
  // Optional free-text note the shopper attaches on the design page; carried to
  // checkout so it reaches the store with the order.
  note?: string;
  // Identical configurations share one cart row. Checkout expands the quantity
  // back into individual order lines because the API creates one order per item.
  quantity: number;
};

type CartData = {
  // The store the cart belongs to; cleared/replaced when adding from another.
  store_handle: string;
  items: CartItem[];
  pending_payments: Record<string, PendingCartPayment>;
};

const storage = createCookieSessionStorage<CartData>({
  cookie: {
    name: "xt_cart",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [
      process.env.SESSION_SECRET ?? "dev-storefront-session-secret-change-me",
    ],
    maxAge: 60 * 60 * 24 * 7,
  },
});

export async function getCart(request: Request): Promise<{
  storeHandle: string;
  items: CartItem[];
  pendingPayments: Record<string, PendingCartPayment>;
}> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return {
    storeHandle: session.get("store_handle") ?? "",
    items: consolidateCartItems(session.get("items") ?? []),
    pendingPayments: session.get("pending_payments") ?? {},
  };
}

function withoutPendingStore(
  pending: Record<string, PendingCartPayment>,
  storeHandle: string,
): Record<string, PendingCartPayment> {
  return Object.fromEntries(
    Object.entries(pending).filter(([handle]) => handle !== storeHandle),
  );
}

export async function setPendingCartPayment(
  request: Request,
  payment: PendingCartPayment,
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const pending = session.get("pending_payments") ?? {};
  session.set("pending_payments", {
    ...pending,
    [payment.store_handle]: payment,
  });
  return storage.commitSession(session);
}

export function cartTotalMinor(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.amount_minor * normalizedQuantity(item.quantity),
    0,
  );
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + normalizedQuantity(item.quantity),
    0,
  );
}

function normalizedQuantity(quantity: number | undefined): number {
  return Number.isSafeInteger(quantity) && quantity && quantity > 0
    ? Math.min(quantity, MAX_CART_ITEMS_PER_STORE)
    : 1;
}

function itemConfigurationKey(item: CartItem): string {
  const measurements = Object.entries(item.measurements ?? {}).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  return JSON.stringify({
    store: item.store_handle,
    design: item.design_handle,
    kind: item.kind,
    sizeBand: item.size_band_id,
    sizeMode: item.size_mode ?? "",
    measurements,
    note: item.note ?? "",
    amount: item.amount_minor,
  });
}

// Consolidate legacy duplicate cookie lines as well as new quantity-aware lines.
export function consolidateCartItems(items: CartItem[]): CartItem[] {
  const consolidated: CartItem[] = [];
  const indexes = new Map<string, number>();
  for (const item of items) {
    const key = itemConfigurationKey(item);
    const existingIndex = indexes.get(key);
    if (existingIndex === undefined) {
      indexes.set(key, consolidated.length);
      consolidated.push({
        ...item,
        quantity: normalizedQuantity(item.quantity),
      });
      continue;
    }
    const existing = consolidated[existingIndex];
    if (existing) {
      existing.quantity = Math.min(
        MAX_CART_ITEMS_PER_STORE,
        existing.quantity + normalizedQuantity(item.quantity),
      );
    }
  }
  return consolidated;
}

// storeHandlesInCart returns the distinct store handles present, in first-seen
// order, so callers can tell a single-store basket from a multi-store one.
export function storeHandlesInCart(items: CartItem[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    if (!seen.includes(item.store_handle)) {
      seen.push(item.store_handle);
    }
  }
  return seen;
}

// itemsForStore filters the basket to one store's lines (the unit a single
// Paystack charge settles).
export function itemsForStore(
  items: CartItem[],
  storeHandle: string,
): CartItem[] {
  return items.filter((item) => item.store_handle === storeHandle);
}

// addToCart appends a line to the unified basket. Items from different stores
// coexist (grouped by store_handle); nothing is wiped when adding across stores.
export async function addToCart(
  request: Request,
  item: Omit<CartItem, "line_id" | "quantity"> & { quantity?: number },
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const items = consolidateCartItems(session.get("items") ?? []);
  const lineID = `${item.design_handle}:${item.size_band_id}:${crypto.randomUUID()}`;
  const incoming: CartItem = {
    ...item,
    line_id: lineID,
    quantity: normalizedQuantity(item.quantity),
  };
  const matching = items.find(
    (existing) =>
      itemConfigurationKey(existing) === itemConfigurationKey(incoming),
  );
  const storeItemCount = cartItemCount(
    items.filter((existing) => existing.store_handle === item.store_handle),
  );
  const available = Math.max(0, MAX_CART_ITEMS_PER_STORE - storeItemCount);
  if (matching) {
    matching.quantity = Math.min(
      matching.quantity + available,
      matching.quantity + incoming.quantity,
    );
  } else if (available > 0) {
    incoming.quantity = Math.min(incoming.quantity, available);
    items.push(incoming);
  }
  // store_handle tracks the most recently added store (used for "continue
  // shopping" back-links); the basket itself is multi-store via item.store_handle.
  session.set("store_handle", item.store_handle);
  session.set("items", items);
  session.set(
    "pending_payments",
    withoutPendingStore(
      session.get("pending_payments") ?? {},
      item.store_handle,
    ),
  );
  return storage.commitSession(session);
}

export async function removeFromCart(
  request: Request,
  lineID: string,
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const current = consolidateCartItems(session.get("items") ?? []);
  const removed = current.find((item) => item.line_id === lineID);
  const items = current.filter((item) => item.line_id !== lineID);
  session.set("items", items);
  if (removed) {
    session.set(
      "pending_payments",
      withoutPendingStore(
        session.get("pending_payments") ?? {},
        removed.store_handle,
      ),
    );
  }
  if (items.length === 0) {
    session.unset("store_handle");
  }
  return storage.commitSession(session);
}

export async function updateCartItemQuantity(
  request: Request,
  lineID: string,
  quantity: number,
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const items = consolidateCartItems(session.get("items") ?? []);
  const target = items.find((item) => item.line_id === lineID);
  const otherStoreItems = target
    ? cartItemCount(
        items.filter(
          (item) =>
            item.store_handle === target.store_handle &&
            item.line_id !== lineID,
        ),
      )
    : 0;
  const requested = Number.isFinite(quantity) ? Math.trunc(quantity) : 1;
  const nextQuantity = Math.max(
    0,
    Math.min(MAX_CART_ITEMS_PER_STORE - otherStoreItems, requested),
  );
  const updated = items
    .map((item) =>
      item.line_id === lineID ? { ...item, quantity: nextQuantity } : item,
    )
    .filter((item) => item.quantity > 0);
  session.set("items", updated);
  if (target) {
    session.set(
      "pending_payments",
      withoutPendingStore(
        session.get("pending_payments") ?? {},
        target.store_handle,
      ),
    );
  }
  if (updated.length === 0) {
    session.unset("store_handle");
  }
  return storage.commitSession(session);
}

// keepOnlyStore drops every OTHER store's lines (§6: a tenant store's cart may
// only hold that store's designs — foreign items can't legitimately exist on a
// tenant host, but a cookie written before isolation went live could still
// carry them). Returns null when nothing changed so callers skip the cookie.
export async function keepOnlyStore(
  request: Request,
  storeHandle: string,
): Promise<string | null> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const items = consolidateCartItems(session.get("items") ?? []);
  const kept = items.filter((item) => item.store_handle === storeHandle);
  if (kept.length === items.length) {
    return null;
  }
  session.set("items", kept);
  const pending = session.get("pending_payments") ?? {};
  session.set(
    "pending_payments",
    pending[storeHandle] ? { [storeHandle]: pending[storeHandle] } : {},
  );
  if (kept.length === 0) {
    session.unset("store_handle");
  }
  return storage.commitSession(session);
}

export async function clearCart(request: Request): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return storage.destroySession(session);
}

// clearStoreItems removes one store's lines after that store's checkout, leaving
// any other stores' items in the basket. When it empties the basket the store
// pointer is cleared too.
export async function clearStoreItems(
  request: Request,
  storeHandle: string,
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const items = (session.get("items") ?? []).filter(
    (item) => item.store_handle !== storeHandle,
  );
  session.set("items", items);
  session.set(
    "pending_payments",
    withoutPendingStore(session.get("pending_payments") ?? {}, storeHandle),
  );
  if (items.length === 0) {
    session.unset("store_handle");
  }
  return storage.commitSession(session);
}
