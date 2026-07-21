import { formatGHS } from "../../../lib/format";
import { tokens } from "../../../theme";
import type {
  BookingSummary,
  FollowUpItem,
  HandoverSummary,
  ManualTaking,
  NotificationSummary,
  OrderSummary,
  OverviewRoom,
  RevenueBucket,
  StageMetric,
} from "../../shared/types";
import {
  AccountBalanceWalletRounded,
  CalendarMonthRounded,
  DesignServicesRounded,
  LocalShippingRounded,
  PeopleAltRounded,
  QueryStatsRounded,
  SettingsRounded,
  TimelineRounded,
} from "@mui/icons-material";
import {
  buildFollowUps,
  buildRevenueBuckets,
  buildStageMetrics,
} from "../../money/utils";
import {
  canAdvanceHandover,
  canManageBooking,
  percentage,
  railBadge,
} from "../../shared/utils";
import {
  countOrders,
  fulfilledOrdersWithoutOpenHandover,
  measurementSourceFor,
} from "../../orders/utils";
import { buildSetupSteps } from "./setup-steps";

export type OverviewMetrics = {
  liveOrders: OrderSummary[];
  pendingPayments: number;
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  pendingMessages: number;
  readyForHandover: number;
  revenueBuckets: RevenueBucket[];
  sevenDayRevenueMinor: number;
  completionRate: number;
  collectionRate: number;
  stageMetrics: StageMetric[];
  followUps: FollowUpItem[];
};

export function computeMetrics({
  orders,
  bookings,
  handovers,
  notifications,
  manualTakings,
}: {
  orders: OrderSummary[];
  bookings: BookingSummary[];
  handovers: HandoverSummary[];
  notifications: NotificationSummary[];
  manualTakings: ManualTaking[];
}): OverviewMetrics {
  const liveOrders = orders.filter(
    (order) => order.status !== "fulfilled" && order.status !== "cancelled",
  );
  const pendingPayments = countOrders(orders, "draft");
  const needsMeasurements = orders.filter((order) =>
    Boolean(measurementSourceFor(order)),
  ).length;
  const activeBookings = bookings.filter((booking) =>
    canManageBooking(booking.status),
  ).length;
  const openHandovers = handovers.filter((handover) =>
    canAdvanceHandover(handover.status),
  ).length;
  const pendingMessages = notifications.filter((notification) =>
    ["pending", "sending"].includes(notification.status),
  ).length;
  const readyForHandover = fulfilledOrdersWithoutOpenHandover(
    orders,
    handovers,
  ).length;
  const revenueBuckets = buildRevenueBuckets(orders, manualTakings);
  const sevenDayRevenueMinor = revenueBuckets.reduce(
    (sum, bucket) => sum + bucket.total_minor,
    0,
  );
  const knownOrderValueMinor = orders.reduce((sum, order) => {
    const target =
      order.agreed_total_minor ?? order.payment_amount_minor ?? 0;
    return sum + target;
  }, 0);
  const settledOrderValueMinor = orders.reduce(
    (sum, order) => sum + order.settled_minor,
    0,
  );
  const completionRate = percentage(
    countOrders(orders, "fulfilled"),
    orders.length,
  );
  const collectionRate = percentage(
    settledOrderValueMinor,
    knownOrderValueMinor,
  );
  const stageMetrics = buildStageMetrics(orders, readyForHandover);
  const followUps = buildFollowUps({
    orders,
    bookings,
    handovers,
    notifications,
  });

  return {
    liveOrders,
    pendingPayments,
    needsMeasurements,
    activeBookings,
    openHandovers,
    pendingMessages,
    readyForHandover,
    revenueBuckets,
    sevenDayRevenueMinor,
    completionRate,
    collectionRate,
    stageMetrics,
    followUps,
  };
}

export { buildSetupSteps };

export function buildOverviewRooms({
  followUps,
  liveOrders,
  moneySummary,
  activeBookings,
  openHandovers,
  activeDesigns,
  activeStoreSettings,
  activeTeamUsers,
}: {
  followUps: FollowUpItem[];
  liveOrders: OrderSummary[];
  moneySummary: { net_income_minor: number };
  activeBookings: number;
  openHandovers: number;
  activeDesigns: number;
  activeStoreSettings: number;
  activeTeamUsers: number;
}): OverviewRoom[] {
  return [
    {
      title: "Reports",
      helper: "Revenue, collection, production, and follow-up signals.",
      href: "/dashboard/reports",
      value: `${followUps.length} signals`,
      actionLabel: "Open reports",
      icon: <QueryStatsRounded />,
      tone: tokens.info,
    },
    {
      title: "Orders",
      helper: "Live production work, measurements, and stage movement.",
      href: "/dashboard/orders",
      value: `${liveOrders.length} live`,
      actionLabel: "Open orders",
      icon: <TimelineRounded />,
      tone: tokens.burgundy,
    },
    {
      title: "Money",
      helper: "Tracked takings, net income, and payment follow-ups.",
      href: "/dashboard/money",
      value: formatGHS(moneySummary.net_income_minor),
      actionLabel: "Open money",
      icon: <AccountBalanceWalletRounded />,
      tone: tokens.success,
    },
    {
      title: "Visits",
      helper: "Held and booked appointments that need studio attention.",
      href: "/dashboard/visits",
      value: `${activeBookings} active`,
      actionLabel: "Open visits",
      icon: <CalendarMonthRounded />,
      tone: tokens.info,
    },
    {
      title: "Handovers",
      helper: "Pickup and delivery work for finished garments.",
      href: "/dashboard/handovers",
      value: `${openHandovers} open`,
      actionLabel: "Open handovers",
      icon: <LocalShippingRounded />,
      tone: tokens.warning,
    },
    {
      title: "Catalogue",
      helper: "Published designs and storefront product upkeep.",
      href: "/dashboard/catalogue",
      value: `${activeDesigns} active`,
      actionLabel: "Open catalogue",
      icon: <DesignServicesRounded />,
      tone: tokens.burgundy,
    },
    {
      title: "Settings",
      helper: "Storefront switches, brand colour, and request controls.",
      href: "/dashboard/settings",
      value: `${activeStoreSettings} on`,
      actionLabel: "Open settings",
      icon: <SettingsRounded />,
      tone: tokens.gold,
    },
    {
      title: "Team",
      helper: "Admin and staff access for the studio workspace.",
      href: "/dashboard/team",
      value: `${activeTeamUsers} active`,
      actionLabel: "Open team",
      icon: <PeopleAltRounded />,
      tone: tokens.info,
    },
  ];
}

export function buildRailBadges({
  canManage,
  followUps,
  liveOrders,
  pendingPayments,
  activeBookings,
  openHandovers,
  activeDesigns,
  needsMeasurements,
  availabilityWindows,
  activeStoreSettings,
  activeTeamUsers,
  pendingMessages,
}: {
  canManage: boolean;
  followUps: FollowUpItem[];
  liveOrders: OrderSummary[];
  pendingPayments: number;
  activeBookings: number;
  openHandovers: number;
  activeDesigns: number;
  needsMeasurements: number;
  availabilityWindows: import("../../shared/types").AvailabilityWindow[];
  activeStoreSettings: number;
  activeTeamUsers: number;
  pendingMessages: number;
}): Partial<Record<string, string | undefined>> {
  return canManage
    ? {
        overview: railBadge(followUps.length),
        reports: railBadge(followUps.length),
        orders: railBadge(liveOrders.length),
        money: railBadge(pendingPayments),
        visits: railBadge(activeBookings),
        handovers: railBadge(openHandovers),
        catalogue: railBadge(activeDesigns),
        measurements: railBadge(needsMeasurements),
        availability: railBadge(availabilityWindows.length),
        settings: railBadge(activeStoreSettings),
        team: railBadge(activeTeamUsers),
        messages: railBadge(pendingMessages),
      }
    : {
        tasks: railBadge(followUps.length),
        orders: railBadge(liveOrders.length),
        visits: railBadge(activeBookings),
        handovers: railBadge(openHandovers),
        messages: railBadge(pendingMessages),
      };
}
