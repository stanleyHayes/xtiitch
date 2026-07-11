import { createCookieSessionStorage } from "react-router";

// The shopping cart is held in its own signed, httpOnly cookie (separate from the
// auth session) so an account isn't required to add items — the shopper builds a
// cart first and signs in at checkout. The basket is UNIFIED across stores
// (Updates §4): items from several shops coexist, grouped by store_handle. Each
// store settles to its own subaccount, so checkout operates on ONE store's group
// at a time (checkout?store=<handle>) and clears only that store's lines on
// success, leaving the other stores' items in the basket.

export type CartItemKind = "made_to_wear" | "bespoke";

export type CartItem = {
  // Stable line id (so duplicate design+size lines can be removed individually).
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
};

type CartData = {
  // The store the cart belongs to; cleared/replaced when adding from another.
  store_handle: string;
  items: CartItem[];
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

export async function getCart(
  request: Request,
): Promise<{ storeHandle: string; items: CartItem[] }> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return {
    storeHandle: session.get("store_handle") ?? "",
    items: session.get("items") ?? [],
  };
}

export function cartTotalMinor(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.amount_minor, 0);
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
  item: Omit<CartItem, "line_id">,
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const items = session.get("items") ?? [];
  const lineID = `${item.design_handle}:${item.size_band_id}:${crypto.randomUUID()}`;
  items.push({ ...item, line_id: lineID });
  // store_handle tracks the most recently added store (used for "continue
  // shopping" back-links); the basket itself is multi-store via item.store_handle.
  session.set("store_handle", item.store_handle);
  session.set("items", items);
  return storage.commitSession(session);
}

export async function removeFromCart(
  request: Request,
  lineID: string,
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const items = (session.get("items") ?? []).filter(
    (item) => item.line_id !== lineID,
  );
  session.set("items", items);
  if (items.length === 0) {
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
  if (items.length === 0) {
    session.unset("store_handle");
  }
  return storage.commitSession(session);
}
