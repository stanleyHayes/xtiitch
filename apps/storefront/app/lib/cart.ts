import { createCookieSessionStorage } from "react-router";

// The shopping cart is held in its own signed, httpOnly cookie (separate from the
// auth session) so an account isn't required to add items — the shopper builds a
// cart first and only creates a mini-account at checkout. Items are scoped to a
// single store (a cart belongs to one shop); adding from a different store
// replaces the cart, since checkout settles to one business's subaccount.

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

// addToCart appends a line. A cart belongs to one store; adding an item from a
// different store starts a fresh cart for that store.
export async function addToCart(
  request: Request,
  item: Omit<CartItem, "line_id">,
): Promise<string> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const currentStore = session.get("store_handle") ?? "";
  let items = session.get("items") ?? [];
  if (currentStore !== item.store_handle) {
    items = [];
  }
  const lineID = `${item.design_handle}:${item.size_band_id}:${crypto.randomUUID()}`;
  items.push({ ...item, line_id: lineID });
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
