import { tokens } from "../../theme";
import { OrderSummary, ManualTaking, RevenueBucket, StageMetric, BookingSummary, HandoverSummary, NotificationSummary, FollowUpItem } from "../shared/types";
import {
  startOfLocalDay,
  dayKey,
  parseDate,
  ageLabel,
  canAdvanceHandover,
  canManageBooking,
  messageKindLabel,
  notificationTone,
} from "../shared/utils";
import { dayMs } from "../shared/constants";
import { countOrders } from "../orders/utils";

export function formatMethod(value: string): string {
  switch (value) {
    case "momo":
      return "Mobile money";
    case "cash":
      return "Cash";
    case "other":
      return "Other";
    case "pickup":
      return "Pickup";
    case "delivery":
      return "Delivery";
    default:
      return value;
  }
}

export function formatCommissionStatus(value: string): string {
  switch (value) {
    case "due":
      return "due";
    case "invoiced":
      return "invoiced";
    case "settled":
      return "settled";
    case "waived":
      return "waived";
    case "not_applicable":
      return "no offline fee";
    default:
      return value || "not tracked";
  }
}

export function buildRevenueBuckets(
  orders: OrderSummary[],
  takings: ManualTaking[],
  now = new Date(),
): RevenueBucket[] {
  const today = startOfLocalDay(now);
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * dayMs);
    return {
      key: dayKey(date),
      label: new Intl.DateTimeFormat("en-GH", {
        weekday: "short",
        day: "numeric",
      }).format(date),
      platform_minor: 0,
      manual_minor: 0,
      total_minor: 0,
      entries: 0,
    };
  });
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  orders.forEach((order) => {
    if (order.settled_minor <= 0) {
      return;
    }
    const date = parseDate(order.created_at);
    if (!date) {
      return;
    }
    const bucket = bucketByKey.get(dayKey(startOfLocalDay(date)));
    if (!bucket) {
      return;
    }
    bucket.platform_minor += order.settled_minor;
    bucket.total_minor += order.settled_minor;
    bucket.entries += 1;
  });

  takings.forEach((taking) => {
    const date = parseDate(taking.taken_at);
    if (!date) {
      return;
    }
    const bucket = bucketByKey.get(dayKey(startOfLocalDay(date)));
    if (!bucket) {
      return;
    }
    bucket.manual_minor += taking.amount_minor;
    bucket.total_minor += taking.amount_minor;
    bucket.entries += 1;
  });

  return buckets;
}

export function buildStageMetrics(
  orders: OrderSummary[],
  readyForHandover: number,
): StageMetric[] {
  return [
    {
      label: "Awaiting payment",
      helper: "Draft orders needing checkout or staff follow-up",
      count: countOrders(orders, "draft"),
      tone: tokens.warning,
    },
    {
      label: "In studio",
      helper: "Confirmed garments moving through production",
      count: countOrders(orders, "confirmed"),
      tone: tokens.info,
    },
    {
      label: "Ready to hand over",
      helper: "Fulfilled orders without an open pickup or delivery",
      count: readyForHandover,
      tone: tokens.burgundy,
    },
    {
      label: "Fulfilled",
      helper: "Orders that completed the production stage flow",
      count: countOrders(orders, "fulfilled"),
      tone: tokens.success,
    },
  ];
}

export function buildFollowUps({
  orders,
  bookings,
  handovers,
  notifications,
  now = new Date(),
}: {
  orders: OrderSummary[];
  bookings: BookingSummary[];
  handovers: HandoverSummary[];
  notifications: NotificationSummary[];
  now?: Date;
}): FollowUpItem[] {
  const followUps: FollowUpItem[] = [];
  const openOrderIDs = new Set(
    handovers
      .filter((handover) => canAdvanceHandover(handover.status))
      .map((handover) => handover.order_id),
  );

  bookings
    .filter((booking) => canManageBooking(booking.status))
    .forEach((booking) => {
      const slotStart = parseDate(booking.slot_start);
      if (slotStart && slotStart.getTime() < now.getTime()) {
        followUps.push({
          id: `booking-${booking.booking_id}`,
          title: booking.customer_name || "Visit customer",
          helper: `Home visit for ${booking.design_title}`,
          meta: `${ageLabel(booking.slot_start, now)} overdue`,
          tone: tokens.danger,
          href: "/dashboard/visits",
        });
      }
    });

  orders
    .filter(
      (order) =>
        order.status === "fulfilled" && !openOrderIDs.has(order.order_id),
    )
    .forEach((order) => {
      followUps.push({
        id: `handover-ready-${order.order_id}`,
        title: order.customer_name || "Fulfilled order",
        helper: `${order.design_title} needs pickup or delivery`,
        meta: `${ageLabel(order.created_at, now)} since order`,
        tone: tokens.warning,
        href: "/dashboard/handovers",
      });
    });

  handovers
    .filter((handover) => canAdvanceHandover(handover.status))
    .forEach((handover) => {
      const days = ageLabel(handover.created_at, now);
      followUps.push({
        id: `handover-${handover.handover_id}`,
        title: handover.customer_name || "Open handover",
        helper: `${formatMethod(handover.method)} for ${handover.design_title}`,
        meta: `${handover.status} · ${days}`,
        tone: handover.status === "dispatched" ? tokens.info : tokens.warning,
        href: "/dashboard/handovers",
      });
    });

  notifications
    .filter((message) => ["pending", "dead"].includes(message.status))
    .forEach((message) => {
      followUps.push({
        id: `message-${message.message_id}`,
        title: messageKindLabel(message.kind),
        helper: `${message.channel.toUpperCase()} to ${message.recipient}`,
        meta: `${message.status} · ${message.attempts} attempts`,
        tone: notificationTone(message.status),
        href: "/dashboard/messages",
      });
    });

  return followUps.slice(0, 8);
}