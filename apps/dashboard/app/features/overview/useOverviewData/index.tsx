import { useMemo } from "react";
import type {
  AvailabilityWindow,
  BookingSummary,
  BusinessUser,
  CollectionSummary,
  Design,
  HandoverSummary,
  ManualTaking,
  MeasurementField,
  MoneySummary,
  NotificationSummary,
  OrderSummary,
  SizeBand,
  StoreSettings,
} from "../../shared/types";
import {
  buildFollowUps,
  buildRevenueBuckets,
  buildStageMetrics,
} from "../../money/utils";
import { enabledStoreSettings } from "../../settings/utils";
import {
  buildOverviewRooms,
  buildRailBadges,
  buildSetupSteps,
  computeMetrics,
} from "./helpers";

export type OverviewData = {
  setupSteps: ReturnType<typeof buildSetupSteps>;
  overviewRooms: ReturnType<typeof buildOverviewRooms>;
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
  designs: Design[];
  canManage: boolean;
}): OverviewData {
  return useMemo(() => {
    const {
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
    } = computeMetrics({ orders, bookings, handovers, notifications, manualTakings });

    const activeDesigns = designs.filter(
      (design) => design.status === "active",
    ).length;
    const activeTeamUsers = businessUsers.filter((user) => user.is_active).length;
    const publishedCollections = collections.filter(
      (collection) => collection.status === "active",
    ).length;
    const activeStoreSettings = enabledStoreSettings(storeSettings);
    const cataloguePriceCount = designs.reduce(
      (total, design) => total + design.prices.length,
      0,
    );

    const setupSteps = buildSetupSteps({
      profile,
      activeDesigns,
      cataloguePriceCount,
      activeStoreSettings,
      measurementFields,
      availabilityWindows,
      activeTeamUsers,
      sizeBands,
      storeSettings,
    });
    const overviewRooms = buildOverviewRooms({
      followUps,
      liveOrders,
      moneySummary,
      activeBookings,
      openHandovers,
      activeDesigns,
      activeStoreSettings,
      activeTeamUsers,
    });
    const railBadges = buildRailBadges({
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
    });

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
    designs,
    canManage,
  ]);
}
