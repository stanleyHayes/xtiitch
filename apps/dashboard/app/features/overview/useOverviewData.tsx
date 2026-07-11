import { useMemo } from "react";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import {
  canAdvanceHandover,
  canManageBooking,
  percentage,
  railBadge,
} from "../shared/utils";
import { buildFollowUps, buildRevenueBuckets, buildStageMetrics } from "../money/utils";
import {
  countOrders,
  fulfilledOrdersWithoutOpenHandover,
  measurementSourceFor,
} from "../orders/utils";
import { enabledStoreSettings } from "../settings/utils";
import type {
  AvailabilityWindow,
  BookingSummary,
  BusinessPromotion,
  BusinessUser,
  CollectionSummary,
  Design,
  HandoverSummary,
  ManualTaking,
  MeasurementField,
  MoneySummary,
  NotificationSummary,
  OrderSummary,
  OverviewRoom,
  SetupStep,
  SizeBand,
  StoreSettings,
} from "../shared/types";
import {
  AccountBalanceWalletRounded,
  CalendarMonthRounded,
  DesignServicesRounded,
  LocalOfferRounded,
  LocalShippingRounded,
  PaymentsRounded,
  PeopleAltRounded,
  PriceCheckRounded,
  QueryStatsRounded,
  SettingsRounded,
  StraightenRounded,
  TimelineRounded,
  VerifiedUserRounded,
} from "@mui/icons-material";

export type OverviewData = {
  setupSteps: SetupStep[];
  overviewRooms: OverviewRoom[];
  liveOrders: OrderSummary[];
  pendingPayments: number;
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  pendingMessages: number;
  readyForHandover: number;
  revenueBuckets: ReturnType<typeof buildRevenueBuckets>;
  sevenDayRevenueMinor: number;
  completionRate: number;
  collectionRate: number;
  stageMetrics: ReturnType<typeof buildStageMetrics>;
  followUps: ReturnType<typeof buildFollowUps>;
  activeDesigns: number;
  activePromotions: number;
  promoRedeemedMinor: number;
  activeTeamUsers: number;
  publishedCollections: number;
  activeStoreSettings: number;
  cataloguePriceCount: number;
  railBadges: Partial<Record<string, string | undefined>>;
};

export function useOverviewData({
  profile,
  orders,
  bookings,
  handovers,
  notifications,
  manualTakings,
  moneySummary,
  measurementFields,
  availabilityWindows,
  businessUsers,
  storeSettings,
  collections,
  sizeBands,
  promotions,
  designs,
  canManage,
}: {
  profile: { verification_status: string; payout_ready?: boolean; plan: string };
  orders: OrderSummary[];
  bookings: BookingSummary[];
  handovers: HandoverSummary[];
  notifications: NotificationSummary[];
  manualTakings: ManualTaking[];
  moneySummary: MoneySummary;
  measurementFields: MeasurementField[];
  availabilityWindows: AvailabilityWindow[];
  businessUsers: BusinessUser[];
  storeSettings: StoreSettings;
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  promotions: BusinessPromotion[];
  designs: Design[];
  canManage: boolean;
}): OverviewData {
  return useMemo(() => {
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
    const activeDesigns = designs.filter(
      (design) => design.status === "active",
    ).length;
    const activePromotions = promotions.filter(
      (promotion) => promotion.status === "active",
    ).length;
    const promoRedeemedMinor = promotions.reduce(
      (total, promotion) => total + promotion.discount_redeemed_minor,
      0,
    );
    const activeTeamUsers = businessUsers.filter((user) => user.is_active).length;
    const publishedCollections = collections.filter(
      (collection) => collection.status === "active",
    ).length;
    const activeStoreSettings = enabledStoreSettings(storeSettings);
    const cataloguePriceCount = designs.reduce(
      (total, design) => total + design.prices.length,
      0,
    );
    const verified = profile.verification_status === "verified";
    const setupSteps: SetupStep[] = [
      {
        label: "Business verified",
        helper: verified
          ? "Store can operate with the verified business profile."
          : "Verification is still pending before customers can fully trust checkout.",
        href: "/dashboard/settings",
        done: verified,
        icon: <VerifiedUserRounded fontSize="small" />,
      },
      {
        label: "Payouts set up",
        helper: (profile.payout_ready ?? false)
          ? "Your mobile money is linked — customers can pay and money reaches you."
          : "Add your mobile money number so customers can check out and pay you.",
        href: "/dashboard/settings#payouts",
        done: profile.payout_ready ?? false,
        icon: <PaymentsRounded fontSize="small" />,
      },
      {
        label: "Catalogue live",
        helper:
          activeDesigns > 0
            ? `${activeDesigns} active storefront pieces are available.`
            : "Add at least one active design with imagery.",
        href: "/dashboard/catalogue",
        done: activeDesigns > 0,
        icon: <DesignServicesRounded fontSize="small" />,
      },
      {
        label: "Checkout pricing",
        helper:
          cataloguePriceCount > 0
            ? `${cataloguePriceCount} design prices are configured.`
            : "Add size bands and prices before standard checkout feels complete.",
        href: "/dashboard/catalogue",
        done: sizeBands.length > 0 && cataloguePriceCount > 0,
        icon: <PriceCheckRounded fontSize="small" />,
      },
      {
        label: "Request paths",
        helper:
          activeStoreSettings > 0
            ? `${activeStoreSettings} storefront switches are enabled.`
            : "Turn on the customer request paths this business accepts.",
        href: "/dashboard/settings",
        done: activeStoreSettings > 0,
        icon: <SettingsRounded fontSize="small" />,
      },
      {
        label: "Measurements",
        helper:
          measurementFields.length > 0
            ? `${measurementFields.length} measurement fields are ready for staff.`
            : "Define the fitting fields staff record on orders.",
        href: "/dashboard/measurements",
        done:
          !storeSettings.measurements_enabled || measurementFields.length > 0,
        icon: <StraightenRounded fontSize="small" />,
      },
      {
        label: "Visit availability",
        helper:
          availabilityWindows.length > 0
            ? `${availabilityWindows.length} visit windows are configured.`
            : "Add appointment windows for home visit and fitting work.",
        href: "/dashboard/availability",
        done: availabilityWindows.length > 0,
        icon: <CalendarMonthRounded fontSize="small" />,
      },
      {
        label: "Team access",
        helper:
          activeTeamUsers > 1
            ? `${activeTeamUsers} active users can operate the workspace.`
            : "Invite at least one admin or staff account for daily operations.",
        href: "/dashboard/team",
        done: activeTeamUsers > 1,
        icon: <PeopleAltRounded fontSize="small" />,
      },
    ];
    const overviewRooms: OverviewRoom[] = [
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
        title: "Promotions",
        helper: "Promo codes for store, collection, and design campaigns.",
        href: "/dashboard/promotions",
        value: `${activePromotions} active`,
        actionLabel: "Open promotions",
        icon: <LocalOfferRounded />,
        tone: tokens.gold,
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
    const railBadges = canManage
      ? {
          overview: railBadge(followUps.length),
          reports: railBadge(followUps.length),
          orders: railBadge(liveOrders.length),
          money: railBadge(pendingPayments),
          visits: railBadge(activeBookings),
          handovers: railBadge(openHandovers),
          catalogue: railBadge(activeDesigns),
          promotions: railBadge(activePromotions),
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

    return {
      setupSteps,
      overviewRooms,
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
      activeDesigns,
      activePromotions,
      promoRedeemedMinor,
      activeTeamUsers,
      publishedCollections,
      activeStoreSettings,
      cataloguePriceCount,
      railBadges,
    };
  }, [
    profile,
    orders,
    bookings,
    handovers,
    notifications,
    manualTakings,
    moneySummary,
    measurementFields,
    availabilityWindows,
    businessUsers,
    storeSettings,
    collections,
    sizeBands,
    promotions,
    designs,
    canManage,
  ]);
}

