import assert from "node:assert/strict";
import test from "node:test";
import {
  addToCart,
  cartItemCount,
  cartTotalMinor,
  consolidateCartItems,
  getCart,
  setPendingCartPayment,
  type CartItem,
} from "./cart";

function request(cookie = ""): Request {
  return new Request("https://store.xtiitch.com/cart", {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function cookieHeader(setCookie: string): string {
  return setCookie.split(";", 1)[0] ?? "";
}

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    line_id: "line-1",
    store_handle: "kwadwo",
    design_handle: "party-dress",
    title: "Party dress",
    image: "dress.webp",
    kind: "made_to_wear",
    size_band_id: "xl",
    size_label: "XL",
    amount_minor: 100,
    quantity: 1,
    ...overrides,
  };
}

test("identical cart configurations consolidate into one quantity line", () => {
  const result = consolidateCartItems([
    item(),
    item({ line_id: "line-2", quantity: 2 }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.quantity, 3);
  assert.equal(cartItemCount(result), 3);
  assert.equal(cartTotalMinor(result), 300);
});

test("different sizes, notes, and measurements remain separate", () => {
  const result = consolidateCartItems([
    item(),
    item({ line_id: "line-2", size_band_id: "large", size_label: "L" }),
    item({ line_id: "line-3", note: "Longer hem" }),
    item({
      line_id: "line-4",
      kind: "bespoke",
      measurements: { waist: "30" },
    }),
  ]);

  assert.equal(result.length, 4);
});

test("legacy cart lines without quantity default to one", () => {
  const legacy = item();
  delete (legacy as Partial<CartItem>).quantity;

  const result = consolidateCartItems([legacy]);
  assert.equal(result[0]?.quantity, 1);
});

test("pending checkout references survive navigation and clear when the cart changes", async () => {
  const pendingCookie = await setPendingCartPayment(request(), {
    store_handle: "kwadwo",
    order_id: "order-1",
    reference: "xt_ref-1",
  });
  const pendingRequest = request(cookieHeader(pendingCookie));
  const pendingCart = await getCart(pendingRequest);
  assert.equal(pendingCart.pendingPayments.kwadwo?.order_id, "order-1");

  const changedCookie = await addToCart(pendingRequest, {
    store_handle: "kwadwo",
    design_handle: "party-dress",
    title: "Party dress",
    image: "dress.webp",
    kind: "made_to_wear",
    size_band_id: "xl",
    size_label: "XL",
    amount_minor: 100,
  });
  const changedCart = await getCart(request(cookieHeader(changedCookie)));
  assert.equal(changedCart.pendingPayments.kwadwo, undefined);
});
