import type { BandPrice, Design } from "../../lib/api";
import {
  fetchActivationStatus,
  type ActivationStatus,
} from "../../lib/activation";
import {
  loadCurrentUser,
  loadDashboardJSON,
  readDashboardJSON,
} from "./api";
import {
  parseDashboardSection,
  parseMoneyPeriod,
  parseOrderFilter,
} from "./parsers";
import {
  canManageDashboard,
  stripStaffMoneyDetails,
  uniqueDashboardWarnings,
} from "./utils";
import { defaultMoneySummary, defaultStoreSettings } from "./constants";
import { loadAnalyticsData } from "../analytics/loadAnalytics";
import { defaultAnalyticsData, type AnalyticsData } from "../analytics/types";
import { loadCrmData } from "../crm/loadCrm";
import { defaultCrmData, type CrmData } from "../crm/types";
import type {
  AvailabilityWindow,
  BookingSummary,
  BusinessUser,
  CollectionSummary,
  CurrentUser,
  DashboardSection,
  DeliveryZone,
  HandoverSummary,
  ManualTaking,
  MeasurementField,
  MoneyPayout,
  MoneyPeriod,
  MoneySummary,
  MoneyTransaction,
  NotificationSummary,
  OrderFilter,
  OrderSummary,
  Profile,
  SizeBand,
  Stage,
  StoreSettings,
  WaitlistEntry,
} from "./types";

export type DashboardLoaderData = {
  profile: Profile;
  currentUser: CurrentUser;
  activation: ActivationStatus;
  designs: Design[];
  orders: OrderSummary[];
  stages: Stage[];
  measurementFields: MeasurementField[];
  moneySummary: MoneySummary;
  moneyPeriod: MoneyPeriod;
  moneyTransactions: MoneyTransaction[];
  manualTakings: ManualTaking[];
  payouts: MoneyPayout[];
  bookings: BookingSummary[];
  handovers: HandoverSummary[];
  notifications: NotificationSummary[];
  availabilityWindows: AvailabilityWindow[];
  blackoutDates: string[];
  businessUsers: BusinessUser[];
  storeSettings: StoreSettings;
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  waitlistEntries: WaitlistEntry[];
  deliveryZones: DeliveryZone[];
  // §14/§15: fetched ONLY when the matching section is open (nine analytics
  // endpoints on every page load would be waste) and only as far as the
  // plan's analytics_level / crm_level entitles — the slices default to their
  // empty states on every other section.
  analytics: AnalyticsData;
  crm: CrmData;
  section: DashboardSection;
  orderFilter: OrderFilter;
  dataWarnings: string[];
};

export async function loadDashboardData({ // eslint-disable-line complexity, max-lines-per-function -- large function with conditional branches; refactor in follow-up
  request,
  params,
}: {
  request: Request;
  params: { section?: string };
}): Promise<DashboardLoaderData> {
  const url = new URL(request.url);
  const orderFilter = parseOrderFilter(url.searchParams.get("orders"));
  const [profile, currentUser, activation] = await Promise.all([
    readDashboardJSON<Profile>(
      request,
      "/businesses/me",
      "The business dashboard API is unavailable. Start the API and refresh this dashboard.",
    ),
    loadCurrentUser(request),
    // Drives the persistent activation banner and the paid-action gating; fails
    // open (activated) so a hiccup never blocks the dashboard.
    fetchActivationStatus(request),
  ]);
  const canManage = canManageDashboard(currentUser.role);
  const section = parseDashboardSection(params.section, canManage);
  const moneyPeriod = parseMoneyPeriod(
    url.searchParams.get("money") ?? (section === "money" ? "today" : "all_time"),
  );
  const dataWarnings: string[] = [];
  const readResult = <T,>(result: { data: T; warning: string | null }): T => {
    if (result.warning) {
      dataWarnings.push(result.warning);
    }
    return result.data;
  };

  const [
    ordersResult,
    stagesResult,
    fieldsResult,
    bookingsResult,
    handoversResult,
    notificationsResult,
  ] = await Promise.all([
    loadDashboardJSON<{ orders: OrderSummary[] }>(
      request,
      "/orders",
      { orders: [] },
      "Orders could not be loaded right now.",
    ),
    loadDashboardJSON<{ stages: Stage[] }>(
      request,
      "/stages",
      { stages: [] },
      "Production stages could not be loaded right now.",
    ),
    loadDashboardJSON<{ fields: MeasurementField[] }>(
      request,
      "/measurement-fields",
      { fields: [] },
      "Measurement fields could not be loaded right now.",
    ),
    loadDashboardJSON<{ bookings: BookingSummary[] }>(
      request,
      "/bookings",
      { bookings: [] },
      "Visit bookings could not be loaded right now.",
    ),
    loadDashboardJSON<{ handovers: HandoverSummary[] }>(
      request,
      "/handovers",
      { handovers: [] },
      "Handovers could not be loaded right now.",
    ),
    loadDashboardJSON<{ notifications: NotificationSummary[] }>(
      request,
      "/notifications",
      { notifications: [] },
      "Dashboard messages could not be loaded right now.",
    ),
  ]);
  const ordersData = readResult(ordersResult);
  const stagesData = readResult(stagesResult);
  const fieldsData = readResult(fieldsResult);
  const bookingsData = readResult(bookingsResult);
  const handoversData = readResult(handoversResult);
  const notificationsData = readResult(notificationsResult);

  let designs: Design[] = [];
  let moneySummary: MoneySummary = defaultMoneySummary;
  let moneyTransactions: MoneyTransaction[] = [];
  let manualTakings: ManualTaking[] = [];
  let payouts: MoneyPayout[] = [];
  let availabilityWindows: AvailabilityWindow[] = [];
  let blackoutDates: string[] = [];
  let businessUsers: BusinessUser[] = [];
  let storeSettings = defaultStoreSettings as StoreSettings;
  let collections: CollectionSummary[] = [];
  let sizeBands: SizeBand[] = [];
  let waitlistEntries: WaitlistEntry[] = [];
  let deliveryZones: DeliveryZone[] = [];
  const orders = ordersData.orders ?? [];

  if (canManage) {
    const blackoutFrom = new Date();
    const blackoutTo = new Date(
      blackoutFrom.getTime() + 120 * 24 * 60 * 60 * 1000,
    );
    const [
      designsResult,
      moneySummaryResult,
      moneyTransactionsResult,
      takingsResult,
      payoutsResult,
      availabilityResult,
      blackoutsResult,
      businessUsersResult,
      settingsResult,
      collectionsResult,
      sizeBandsResult,
      waitlistResult,
      deliveryZonesResult,
    ] = await Promise.all([
      loadDashboardJSON<{ designs: Design[] }>(
        request,
        "/designs",
        { designs: [] },
        "Catalogue designs could not be loaded right now.",
      ),
      loadDashboardJSON<MoneySummary>(
        request,
        `/money/summary?period=${encodeURIComponent(moneyPeriod)}`,
        defaultMoneySummary,
        "Money summary could not be loaded right now.",
      ),
      loadDashboardJSON<{ transactions: MoneyTransaction[] }>(
        request,
        `/money/transactions?period=${encodeURIComponent(moneyPeriod)}&limit=100&offset=0`,
        { transactions: [] },
        "Today's transactions could not be loaded right now.",
      ),
      loadDashboardJSON<{ takings: ManualTaking[] }>(
        request,
        "/money/takings",
        { takings: [] },
        "Manual takings could not be loaded right now.",
      ),
      // §3.3: the payout history table. The first page (50) is loaded and the
      // table pages client-side, the same treatment as manual takings.
      loadDashboardJSON<{ payouts: MoneyPayout[] }>(
        request,
        `/money/payouts?period=${encodeURIComponent(moneyPeriod)}&limit=100&offset=0`,
        { payouts: [] },
        "Payout history could not be loaded right now.",
      ),
      loadDashboardJSON<{ windows: AvailabilityWindow[] }>(
        request,
        "/availability",
        { windows: [] },
        "Availability windows could not be loaded right now.",
      ),
      loadDashboardJSON<{ dates: string[] }>(
        request,
        `/availability/blackouts?from=${encodeURIComponent(
          blackoutFrom.toISOString(),
        )}&to=${encodeURIComponent(blackoutTo.toISOString())}`,
        { dates: [] },
        "Blocked-out days could not be loaded right now.",
      ),
      loadDashboardJSON<{ users: BusinessUser[] }>(
        request,
        "/auth/business/users",
        { users: [] },
        "Team access could not be loaded right now.",
      ),
      loadDashboardJSON<StoreSettings>(
        request,
        "/store-settings",
        defaultStoreSettings as StoreSettings,
        "Store settings could not be loaded right now.",
      ),
      loadDashboardJSON<{ collections: CollectionSummary[] }>(
        request,
        "/collections",
        { collections: [] },
        "Collections could not be loaded right now.",
      ),
      loadDashboardJSON<{ size_bands: SizeBand[] }>(
        request,
        "/size-bands",
        { size_bands: [] },
        "Size bands could not be loaded right now.",
      ),
      loadDashboardJSON<{ entries: WaitlistEntry[] }>(
        request,
        "/waitlist-entries",
        { entries: [] },
        "Design waiting lists could not be loaded right now.",
      ),
      loadDashboardJSON<{ zones: DeliveryZone[] }>(
        request,
        "/delivery-zones",
        { zones: [] },
        "Delivery zones could not be loaded right now.",
      ),
    ]);
    const designsData = readResult(designsResult);
    const moneySummaryData = readResult(moneySummaryResult);
    const moneyTransactionsData = readResult(moneyTransactionsResult);
    const takingsData = readResult(takingsResult);
    const payoutsData = readResult(payoutsResult);
    const availabilityData = readResult(availabilityResult);
    const blackoutsData = readResult(blackoutsResult);
    const businessUsersData = readResult(businessUsersResult);
    const settingsData = readResult(settingsResult);
    const collectionsData = readResult(collectionsResult);
    const sizeBandsData = readResult(sizeBandsResult);
    const waitlistData = readResult(waitlistResult);
    const deliveryZonesData = readResult(deliveryZonesResult);

    const listedDesigns = designsData.designs ?? [];
    let designPriceWarning = false;
    designs = await Promise.all(
      listedDesigns.map(async (design) => {
        const pricesResult = await loadDashboardJSON<{ prices: BandPrice[] }>(
          request,
          `/designs/${encodeURIComponent(design.design_id)}/prices`,
          { prices: [] },
          "Some design prices could not be loaded right now.",
        );
        if (pricesResult.warning) {
          designPriceWarning = true;
        }
        const pricesData = pricesResult.data;
        return { ...design, prices: pricesData.prices ?? [] };
      }),
    );
    if (designPriceWarning) {
      dataWarnings.push("Some design prices could not be loaded right now.");
    }
    moneySummary = {
      through_platform_minor: moneySummaryData.through_platform_minor ?? 0,
      paystack_fee_minor: moneySummaryData.paystack_fee_minor ?? 0,
      xtiitch_fee_minor: moneySummaryData.xtiitch_fee_minor ?? 0,
      xtiitch_tax_minor: moneySummaryData.xtiitch_tax_minor ?? 0,
      commission_minor: moneySummaryData.commission_minor ?? 0,
      settled_payouts_minor: moneySummaryData.settled_payouts_minor ?? 0,
      manual_takings_minor: moneySummaryData.manual_takings_minor ?? 0,
      offline_commission_due_minor:
        moneySummaryData.offline_commission_due_minor ?? 0,
      all_time_income_minor: moneySummaryData.all_time_income_minor ?? 0,
      net_income_minor: moneySummaryData.net_income_minor ?? 0,
    };
    moneyTransactions = moneyTransactionsData.transactions ?? [];
    manualTakings = takingsData.takings ?? [];
    payouts = payoutsData.payouts ?? [];
    availabilityWindows = availabilityData.windows ?? [];
    blackoutDates = blackoutsData.dates ?? [];
    businessUsers = businessUsersData.users ?? [];
    storeSettings = settingsData;
    collections = collectionsData.collections ?? [];
    sizeBands = sizeBandsData.size_bands ?? [];
    waitlistEntries = waitlistData.entries ?? [];
    deliveryZones = deliveryZonesData.zones ?? [];
  }

  // §14/§15 section data, level-laddered inside the feature loaders.
  let analytics = defaultAnalyticsData;
  let crm = defaultCrmData;
  if (canManage && section === "analytics") {
    const result = await loadAnalyticsData({
      request,
      profile,
      searchParams: url.searchParams,
    });
    analytics = result.data;
    dataWarnings.push(...result.warnings);
  }
  if (canManage && section === "customers") {
    const result = await loadCrmData({
      request,
      profile,
      searchParams: url.searchParams,
    });
    crm = result.data;
    dataWarnings.push(...result.warnings);
  }

  return {
    profile,
    currentUser,
    activation,
    designs,
    orders: canManage ? orders : stripStaffMoneyDetails(orders),
    stages: stagesData.stages ?? [],
    measurementFields: fieldsData.fields ?? [],
    moneySummary,
    moneyPeriod,
    moneyTransactions,
    manualTakings,
    payouts,
    bookings: bookingsData.bookings ?? [],
    handovers: handoversData.handovers ?? [],
    notifications: notificationsData.notifications ?? [],
    availabilityWindows,
    blackoutDates,
    businessUsers,
    storeSettings,
    collections,
    sizeBands,
    waitlistEntries,
    deliveryZones,
    analytics,
    crm,
    section,
    orderFilter,
    dataWarnings: uniqueDashboardWarnings(dataWarnings),
  };
}
