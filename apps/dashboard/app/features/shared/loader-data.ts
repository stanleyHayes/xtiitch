import type { Design } from "../../lib/api";
import type { ActivationStatus } from "../../lib/activation";
import type { AnalyticsData } from "../analytics/types";
import type { CrmData } from "../crm/types";
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

// The dashboard loader's full payload. Split out of loader.ts so that module
// stays within the file-size budget; loader.ts re-exports it, so importers keep
// importing DashboardLoaderData from "../shared/loader".
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
  moneyFrom: string;
  moneyTo: string;
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
