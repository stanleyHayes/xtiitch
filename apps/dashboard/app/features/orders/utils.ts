import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import { OrderSummary, OrderFilter, HandoverSummary } from "../shared/types";
import { ORDER_STAGE_RANK } from "../shared/constants";

export function filterOrders(
  orders: OrderSummary[],
  filter: OrderFilter,
): OrderSummary[] {
  if (filter === "all") {
    return orders;
  }
  if (filter === "standard" || filter === "custom") {
    return orders.filter((order) => order.order_type === filter);
  }
  return orders.filter((order) => order.status === filter);
}

export function countOrders(orders: OrderSummary[], filter: OrderFilter): number {
  return filterOrders(orders, filter).length;
}

export function stageColor(colour: string): string {
  switch (colour) {
    case "green":
      return tokens.success;
    case "yellow":
      return tokens.warning;
    default:
      return tokens.burgundy;
  }
}

export function orderRouteLabel(order: OrderSummary): string {
  switch (order.size_mode) {
    case "self_measure":
      return "Self-measure";
    case "home_visit":
      return "Home visit";
    case "come_to_shop":
      return "Come to shop";
    default:
      return "Size band";
  }
}

export function measurementSourceFor(order: OrderSummary): "visit" | "shop" | null {
  if (order.order_type !== "custom" || order.status !== "confirmed") {
    return null;
  }
  if (order.size_mode === "home_visit") {
    return "visit";
  }
  if (order.size_mode === "come_to_shop") {
    return "shop";
  }
  return null;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Awaiting payment";
    case "confirmed":
      return "In studio";
    case "fulfilled":
      return "Fulfilled";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function paymentLabel(order: OrderSummary): string {
  if (order.payment_status === "none") {
    return order.channel === "walk_in" || order.size_mode === "come_to_shop"
      ? "Offline arrangement"
      : "No payment";
  }
  switch (order.payment_status) {
    case "succeeded":
      return order.payment_purpose === "deposit" ? "Deposit paid" : "Paid";
    case "initiated":
      return "Payment pending";
    case "failed":
      return "Payment failed";
    case "reversed":
      return "Reversed";
    default:
      return order.payment_status;
  }
}

export function paymentTone(order: OrderSummary): string {
  switch (order.payment_status) {
    case "succeeded":
      return tokens.success;
    case "initiated":
      return tokens.warning;
    case "failed":
    case "reversed":
      return tokens.danger;
    default:
      return tokens.info;
  }
}

export function moneyProgress(order: OrderSummary): string {
  const target = order.agreed_total_minor ?? order.payment_amount_minor;
  if (!target) {
    return order.settled_minor > 0
      ? formatGHS(order.settled_minor)
      : "No total set";
  }
  return `${formatGHS(order.settled_minor)} / ${formatGHS(target)}`;
}

export function moneyInputValue(value: number | null | undefined): string {
  if (!value || value <= 0) {
    return "";
  }
  return String(value / 100);
}

export function orderTargetMinor(order: OrderSummary): number | null {
  return order.agreed_total_minor ?? order.payment_amount_minor ?? null;
}

export function orderBalanceDueMinor(order: OrderSummary): number {
  const target = orderTargetMinor(order);
  if (!target) {
    return 0;
  }
  return Math.max(0, target - order.settled_minor);
}

export function orderBoardKey(order: OrderSummary): string {
  if (order.status === "confirmed") {
    return order.stage_name || "In production";
  }
  return statusLabel(order.status);
}

export function orderBoardRank(order: OrderSummary): number {
  switch (order.status) {
    case "draft":
      return 0;
    case "awaiting_deposit":
      return 1;
    case "confirmed":
      return ORDER_STAGE_RANK[order.stage_name] ?? 25;
    case "fulfilled":
      return 90;
    case "cancelled":
      return 95;
    default:
      return 50;
  }
}

export function orderFlow(order: OrderSummary): string {
  return order.order_type === "custom" ? "bespoke" : "ready_made";
}

export function fulfilledOrdersWithoutOpenHandover(
  orders: OrderSummary[],
  handovers: HandoverSummary[],
): OrderSummary[] {
  const openOrderIDs = new Set(
    handovers
      .filter((handover) => ["pending", "dispatched"].includes(handover.status))
      .map((handover) => handover.order_id),
  );
  return orders.filter(
    (order) =>
      order.status === "fulfilled" && !openOrderIDs.has(order.order_id),
  );
}