import assert from "node:assert/strict";
import test from "node:test";
import type { CustomerOrder } from "./discovery";
import {
  groupOrdersByStore,
  isFinalStage,
  kindLabel,
  splitTabs,
  visibleOrders,
} from "./orders";

function order(overrides: Partial<CustomerOrder>): CustomerOrder {
  return {
    order_id: "o1",
    business_name: "KB Designs",
    business_handle: "kbdesigns",
    store_phone: "0240000000",
    design_title: "Kente gown",
    status: "in_production",
    kind: "standard",
    checkout_group_id: null,
    agreed_total_minor: 50000,
    created_at: "2026-07-01T10:00:00Z",
    received_at: null,
    ...overrides,
  };
}

test("isFinalStage matches the existing completed-status mapping", () => {
  for (const status of ["completed", "delivered", "fulfilled", "handed_over"]) {
    assert.equal(isFinalStage(status), true, status);
    assert.equal(isFinalStage(status.toUpperCase()), true, status);
  }
  for (const status of ["in_production", "draft", "cancelled", "paid"]) {
    assert.equal(isFinalStage(status), false, status);
  }
});

test("visibleOrders drops acknowledged orders everywhere", () => {
  const orders = [
    order({ order_id: "a" }),
    order({ order_id: "b", received_at: "2026-07-10T09:00:00Z" }),
  ];
  assert.deepEqual(
    visibleOrders(orders).map((o) => o.order_id),
    ["a"],
  );
});

test("splitTabs puts active orders in Current and unreceived final-stage in Archived", () => {
  const orders = [
    order({ order_id: "active", status: "in_production" }),
    order({ order_id: "ready", status: "delivered" }),
    order({
      order_id: "done",
      status: "fulfilled",
      received_at: "2026-07-11T12:00:00Z",
    }),
  ];
  const tabs = splitTabs(orders);
  assert.deepEqual(
    tabs.current.map((o) => o.order_id),
    ["active"],
  );
  assert.deepEqual(
    tabs.archived.map((o) => o.order_id),
    ["ready"],
  );
});

test("groupOrdersByStore groups per store with one basket per checkout group", () => {
  const orders = [
    order({ order_id: "a", checkout_group_id: "g1" }),
    order({ order_id: "b", checkout_group_id: "g1" }),
    order({ order_id: "c", checkout_group_id: "g2" }),
    order({ order_id: "d" }), // single checkout: stand-alone basket
    order({
      order_id: "e",
      business_handle: "tdh",
      business_name: "Top Designers Hub",
      store_phone: "0201112223",
    }),
  ];
  const groups = groupOrdersByStore(orders);

  assert.equal(groups.length, 2);
  const kb = groups.find((group) => group.storeHandle === "kbdesigns");
  assert.ok(kb);
  assert.equal(kb.storeName, "KB Designs");
  assert.equal(kb.storePhone, "0240000000");
  assert.deepEqual(
    kb.baskets.map((basket) => [
      basket.groupId,
      basket.orders.map((o) => o.order_id),
    ]),
    [
      ["g1", ["a", "b"]],
      ["g2", ["c"]],
      [null, ["d"]],
    ],
  );

  const tdh = groups.find((group) => group.storeHandle === "tdh");
  assert.ok(tdh);
  assert.equal(tdh.storeName, "Top Designers Hub");
  assert.equal(tdh.baskets.length, 1);
  assert.equal(tdh.baskets[0]?.groupId, null);
});

test("kindLabel renders the API's order kind for the card chip", () => {
  assert.equal(kindLabel("bespoke"), "Bespoke");
  assert.equal(kindLabel("standard"), "Standard");
  assert.equal(kindLabel("made_to_wear"), "Standard");
});
