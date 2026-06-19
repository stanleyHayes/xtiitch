import { Form, Link as RouterLink, redirect } from "react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, styled, type SxProps, type Theme } from "@mui/material/styles";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRounded from "@mui/icons-material/KeyboardArrowRightRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import LockResetRounded from "@mui/icons-material/LockResetRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import PaletteRounded from "@mui/icons-material/PaletteRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import PriceCheckRounded from "@mui/icons-material/PriceCheckRounded";
import QueryStatsRounded from "@mui/icons-material/QueryStatsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import type { Route } from "./+types/dashboard";
import { apiFetch, logOut } from "../lib/auth";
import TextField from "../components/form-text-field";
import type { BandPrice, Design } from "../lib/api";
import { formatGHS } from "../lib/format";
import { tokens } from "../theme";
import { useThemeMode } from "../theme-mode";

type Profile = {
  name: string;
  handle: string;
  verification_status: string;
  plan: string;
};

type UserRole = "owner" | "admin" | "staff";

type CurrentUser = {
  business_id: string;
  user_id: string;
  role: UserRole | string;
};

type BusinessUser = {
  business_user_id: string;
  business_id: string;
  email: string;
  display_name: string;
  role: UserRole | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StoreSettings = {
  bespoke_enabled: boolean;
  measurements_enabled: boolean;
  customisation_enabled: boolean;
  collections_enabled: boolean;
  delivery_enabled: boolean;
  dispatch_enabled: boolean;
  brand_color: string;
};

type CollectionSummary = {
  collection_id: string;
  name: string;
  theme: string;
  handle: string;
  status: string;
  sequence: number;
};

type SizeBand = {
  size_band_id: string;
  label: string;
  sequence: number;
};

type BusinessPromotion = {
  promotion_id: string;
  business_id: string;
  code: string;
  title: string;
  description: string;
  discount_type: "percentage" | "fixed" | string;
  discount_value: number;
  max_discount_minor: number | null;
  min_spend_minor: number;
  usage_limit_global: number | null;
  usage_limit_per_customer: number | null;
  funding_source: string;
  scope: "store" | "collection" | "design" | string;
  target_collection_id: string | null;
  target_design_id: string | null;
  status: "active" | "paused" | "archived" | string;
  starts_at: string | null;
  ends_at: string | null;
  redemption_count: number;
  discount_redeemed_minor: number;
  created_at: string;
  updated_at: string;
};

type OrderSummary = {
  order_id: string;
  design_title: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  order_type: string;
  size_mode: string;
  channel: string;
  stage_name: string;
  colour: string;
  agreed_total_minor: number | null;
  settled_minor: number;
  payment_status: string;
  payment_purpose: string;
  payment_amount_minor: number | null;
  created_at: string;
};

type MeasurementField = {
  field_id: string;
  label: string;
  unit: "cm" | "in";
  sequence: number;
  created_at: string;
  updated_at: string;
};

type MoneySummary = {
  through_platform_minor: number;
  commission_minor: number;
  manual_takings_minor: number;
  net_income_minor: number;
};

type ManualTaking = {
  taking_id: string;
  amount_minor: number;
  method: string;
  what_for: string;
  taken_at: string;
};

type BookingSummary = {
  booking_id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  design_title: string;
  slot_start: string;
  slot_end: string;
  status: string;
  address: string;
};

type HandoverSummary = {
  handover_id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  design_title: string;
  method: "pickup" | "delivery" | string;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  courier: string;
  note: string;
  created_at: string;
};

type NotificationSummary = {
  message_id: string;
  channel: string;
  kind: string;
  recipient: string;
  status: string;
  attempts: number;
  created_at: string;
};

type AvailabilityWindow = {
  weekday: number;
  start_minute: number;
  end_minute: number;
  slot_minutes: number;
};

type RevenueBucket = {
  key: string;
  label: string;
  platform_minor: number;
  manual_minor: number;
  total_minor: number;
  entries: number;
};

type StageMetric = {
  label: string;
  helper: string;
  count: number;
  tone: string;
};

type FollowUpItem = {
  id: string;
  title: string;
  helper: string;
  meta: string;
  tone: string;
  href: string;
};

type DashboardSection =
  | "overview"
  | "tasks"
  | "reports"
  | "orders"
  | "money"
  | "visits"
  | "handovers"
  | "catalogue"
  | "promotions"
  | "measurements"
  | "availability"
  | "settings"
  | "team"
  | "messages";

type WorkspaceNavItem = {
  href: string;
  section: DashboardSection;
  label: string;
  helper: string;
  icon: ReactNode;
};

type WorkspaceNavGroup = {
  id: string;
  label: string;
  icon: ReactNode;
  items: WorkspaceNavItem[];
};

type OrderFilter =
  | "all"
  | "standard"
  | "custom"
  | "draft"
  | "confirmed"
  | "fulfilled";

type DashboardActionData = {
  permissionError?: string;
  orderError?: string;
  designError?: string;
  mediaError?: string;
  fieldError?: string;
  measurementError?: string;
  moneyError?: string;
  bookingError?: string;
  handoverError?: string;
  availabilityError?: string;
  teamError?: string;
  settingsError?: string;
  collectionError?: string;
  sizeBandError?: string;
  priceError?: string;
  promotionError?: string;
  walkInError?: string;
};

type DashboardPageMeta = {
  eyebrow: string;
  title: string;
  helper: string;
  icon: ReactNode;
  tone: string;
};

type DashboardJSONResult<T> = {
  data: T;
  warning: string | null;
};

type OverviewRoom = {
  title: string;
  helper: string;
  href: string;
  value: string;
  actionLabel: string;
  tone: string;
  icon: ReactNode;
};

type PriorityRibbonItem = {
  label: string;
  value: number;
  href: string;
  icon: ReactElement;
  tone: string;
};

type SetupStep = {
  label: string;
  helper: string;
  href: string;
  done: boolean;
  icon: ReactElement;
};

type UploadSignature = {
  signature: string;
  timestamp: number;
  cloud_name: string;
  api_key: string;
  folder: string;
};

type CloudinaryUploadResult = {
  secure_url?: string;
  url?: string;
};

const dashboardRailWidth = 304;
const dashboardRailCollapsedWidth = 88;

const dashboardFallbackDesignImages = [
  "/images/dashboard-atelier-review.webp",
  "/images/dashboard-fitting.webp",
  "/images/dashboard-atelier-hero.webp",
];

const defaultStoreSettings: StoreSettings = {
  bespoke_enabled: false,
  measurements_enabled: false,
  customisation_enabled: false,
  collections_enabled: false,
  delivery_enabled: false,
  dispatch_enabled: false,
  brand_color: tokens.burgundy,
};

const defaultMoneySummary: MoneySummary = {
  through_platform_minor: 0,
  commission_minor: 0,
  manual_takings_minor: 0,
  net_income_minor: 0,
};

const orderFilters: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
  { value: "draft", label: "Awaiting pay" },
  { value: "confirmed", label: "In studio" },
  { value: "fulfilled", label: "Fulfilled" },
];

const managementWorkspaceNav: WorkspaceNavItem[] = [
  {
    href: "/dashboard",
    section: "overview",
    label: "Overview",
    helper: "Studio pulse",
    icon: <TuneRounded />,
  },
  {
    href: "/dashboard/reports",
    section: "reports",
    label: "Reports",
    helper: "Revenue signals",
    icon: <QueryStatsRounded />,
  },
  {
    href: "/dashboard/orders",
    section: "orders",
    label: "Orders",
    helper: "Production board",
    icon: <TimelineRounded />,
  },
  {
    href: "/dashboard/money",
    section: "money",
    label: "Money",
    helper: "Tracked income",
    icon: <AccountBalanceWalletRounded />,
  },
  {
    href: "/dashboard/visits",
    section: "visits",
    label: "Visits",
    helper: "Fitting queue",
    icon: <CalendarMonthRounded />,
  },
  {
    href: "/dashboard/handovers",
    section: "handovers",
    label: "Handovers",
    helper: "Pickup delivery",
    icon: <LocalShippingRounded />,
  },
  {
    href: "/dashboard/catalogue",
    section: "catalogue",
    label: "Catalogue",
    helper: "Storefront pieces",
    icon: <DesignServicesRounded />,
  },
  {
    href: "/dashboard/promotions",
    section: "promotions",
    label: "Promotions",
    helper: "Promo codes",
    icon: <LocalOfferRounded />,
  },
  {
    href: "/dashboard/measurements",
    section: "measurements",
    label: "Measurements",
    helper: "Fitting setup",
    icon: <StraightenRounded />,
  },
  {
    href: "/dashboard/availability",
    section: "availability",
    label: "Availability",
    helper: "Visit hours",
    icon: <ScheduleRounded />,
  },
  {
    href: "/dashboard/settings",
    section: "settings",
    label: "Settings",
    helper: "Store switches",
    icon: <SettingsRounded />,
  },
  {
    href: "/dashboard/team",
    section: "team",
    label: "Team",
    helper: "Access roles",
    icon: <PeopleAltRounded />,
  },
  {
    href: "/dashboard/messages",
    section: "messages",
    label: "Messages",
    helper: "Customer outbox",
    icon: <NotificationsRounded />,
  },
];

const staffWorkspaceNav: WorkspaceNavItem[] = [
  {
    href: "/dashboard",
    section: "tasks",
    label: "Tasks",
    helper: "Shift queue",
    icon: <TuneRounded />,
  },
  {
    href: "/dashboard/orders",
    section: "orders",
    label: "Orders",
    helper: "Stage movement",
    icon: <TimelineRounded />,
  },
  {
    href: "/dashboard/visits",
    section: "visits",
    label: "Visits",
    helper: "Fitting queue",
    icon: <CalendarMonthRounded />,
  },
  {
    href: "/dashboard/handovers",
    section: "handovers",
    label: "Handovers",
    helper: "Pickup delivery",
    icon: <LocalShippingRounded />,
  },
  {
    href: "/dashboard/messages",
    section: "messages",
    label: "Messages",
    helper: "Customer outbox",
    icon: <NotificationsRounded />,
  },
];

function workspaceNavItem(
  items: WorkspaceNavItem[],
  section: DashboardSection,
): WorkspaceNavItem {
  const item = items.find((candidate) => candidate.section === section);
  if (!item) {
    throw new Error(`Missing dashboard nav item: ${section}`);
  }
  return item;
}

function workspaceNavItems(
  items: WorkspaceNavItem[],
  sections: DashboardSection[],
): WorkspaceNavItem[] {
  return sections.map((section) => workspaceNavItem(items, section));
}

// Overview stands alone at the top of the rail (rendered solo — no group
// header). Command is no longer pinned to the bottom: it simply flows last.
const managementWorkspaceGroups: WorkspaceNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <TuneRounded />,
    items: workspaceNavItems(managementWorkspaceNav, ["overview"]),
  },
  {
    id: "operations",
    label: "Operations",
    icon: <TimelineRounded />,
    items: workspaceNavItems(managementWorkspaceNav, [
      "orders",
      "money",
      "visits",
      "handovers",
      "messages",
    ]),
  },
  {
    id: "storefront",
    label: "Storefront",
    icon: <StorefrontRounded />,
    items: workspaceNavItems(managementWorkspaceNav, [
      "catalogue",
      "promotions",
    ]),
  },
  {
    id: "setup",
    label: "Setup",
    icon: <SettingsRounded />,
    items: workspaceNavItems(managementWorkspaceNav, [
      "measurements",
      "availability",
      "settings",
      "team",
    ]),
  },
  {
    id: "command",
    label: "Command",
    icon: <TuneRounded />,
    items: workspaceNavItems(managementWorkspaceNav, ["reports"]),
  },
];

const staffWorkspaceGroups: WorkspaceNavGroup[] = [
  {
    id: "shift",
    label: "Shift work",
    icon: <TuneRounded />,
    items: workspaceNavItems(staffWorkspaceNav, ["tasks", "orders"]),
  },
  {
    id: "customers",
    label: "Customer flow",
    icon: <PeopleAltRounded />,
    items: workspaceNavItems(staffWorkspaceNav, [
      "visits",
      "handovers",
      "messages",
    ]),
  },
];

const staffAllowedIntents = new Set([
  "advance",
  "record_measurements",
  "cancel_booking",
  "reschedule_booking",
  "arrange_handover",
  "advance_handover",
  "cancel_handover",
]);

const dashboardActionIntents = new Set([
  "advance",
  "record_measurements",
  "create_walk_in_order",
  "set_agreed_total",
  "collect_balance",
  "log_taking",
  "cancel_booking",
  "reschedule_booking",
  "arrange_handover",
  "advance_handover",
  "cancel_handover",
  "save_availability",
  "create_measurement_field",
  "update_measurement_field",
  "delete_measurement_field",
  "create_business_user",
  "update_business_user",
  "save_store_settings",
  "create_collection",
  "retire_collection",
  "restore_collection",
  "delete_collection",
  "create_size_band",
  "set_design_price",
  "create_promotion",
  "update_promotion",
  "archive_promotion",
  "upload_design_image",
  "update_design",
  "delete_design",
  "create",
  "retire",
  "restore",
]);

const fieldUnits = [
  { value: "in", label: "in" },
  { value: "cm", label: "cm" },
];

const manualTakingMethods = [
  { value: "cash", label: "Cash" },
  { value: "momo", label: "Mobile money" },
  { value: "other", label: "Other" },
];

const businessUserRoleOptions = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
];

const handoverMethods = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
];

const weekdays = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const dayMs = 24 * 60 * 60 * 1000;

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Dashboard · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

function dashboardUpstreamStatus(status: number): number {
  return status >= 500 || status === 0 ? 503 : status;
}

function isRedirectResponse(error: unknown): error is Response {
  return error instanceof Response && error.status >= 300 && error.status < 400;
}

async function readDashboardJSON<T>(
  request: Request,
  path: string,
  failureMessage: string,
): Promise<T> {
  const response = await apiFetch(request, path);

  if (!response.ok) {
    throw new Response(failureMessage, {
      status: dashboardUpstreamStatus(response.status),
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Response(failureMessage, { status: 502 });
  }
}

async function loadDashboardJSON<T>(
  request: Request,
  path: string,
  fallback: T,
  warning: string,
): Promise<DashboardJSONResult<T>> {
  try {
    return {
      data: await readDashboardJSON<T>(request, path, warning),
      warning: null,
    };
  } catch (error) {
    if (isRedirectResponse(error)) {
      throw error;
    }
    return { data: fallback, warning };
  }
}

function uniqueDashboardWarnings(warnings: string[]): string[] {
  return [...new Set(warnings.filter(Boolean))];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const orderFilter = parseOrderFilter(url.searchParams.get("orders"));
  const [profile, currentUser] = await Promise.all([
    readDashboardJSON<Profile>(
      request,
      "/businesses/me",
      "The business dashboard API is unavailable. Start the API and refresh this dashboard.",
    ),
    readDashboardJSON<CurrentUser>(
      request,
      "/auth/business/me",
      "The signed-in business user could not be loaded. Start the API and refresh this dashboard.",
    ),
  ]);
  const canManage = canManageDashboard(currentUser.role);
  const section = parseDashboardSection(params.section, canManage);
  const dataWarnings: string[] = [];
  const readResult = <T,>(result: DashboardJSONResult<T>): T => {
    if (result.warning) {
      dataWarnings.push(result.warning);
    }
    return result.data;
  };

  const [
    ordersResult,
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
  const fieldsData = readResult(fieldsResult);
  const bookingsData = readResult(bookingsResult);
  const handoversData = readResult(handoversResult);
  const notificationsData = readResult(notificationsResult);

  let designs: Design[] = [];
  let moneySummary: MoneySummary = defaultMoneySummary;
  let manualTakings: ManualTaking[] = [];
  let availabilityWindows: AvailabilityWindow[] = [];
  let businessUsers: BusinessUser[] = [];
  let storeSettings = defaultStoreSettings;
  let collections: CollectionSummary[] = [];
  let sizeBands: SizeBand[] = [];
  let promotions: BusinessPromotion[] = [];
  const orders = ordersData.orders ?? [];

  if (canManage) {
    const [
      designsResult,
      moneySummaryResult,
      takingsResult,
      availabilityResult,
      businessUsersResult,
      settingsResult,
      collectionsResult,
      sizeBandsResult,
      promotionsResult,
    ] = await Promise.all([
      loadDashboardJSON<{ designs: Design[] }>(
        request,
        "/designs",
        { designs: [] },
        "Catalogue designs could not be loaded right now.",
      ),
      loadDashboardJSON<MoneySummary>(
        request,
        "/money/summary",
        defaultMoneySummary,
        "Money summary could not be loaded right now.",
      ),
      loadDashboardJSON<{ takings: ManualTaking[] }>(
        request,
        "/money/takings",
        { takings: [] },
        "Manual takings could not be loaded right now.",
      ),
      loadDashboardJSON<{ windows: AvailabilityWindow[] }>(
        request,
        "/availability",
        { windows: [] },
        "Availability windows could not be loaded right now.",
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
        defaultStoreSettings,
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
      loadDashboardJSON<{ promotions: BusinessPromotion[] }>(
        request,
        "/promotions",
        { promotions: [] },
        "Promotions could not be loaded right now.",
      ),
    ]);
    const designsData = readResult(designsResult);
    const moneySummaryData = readResult(moneySummaryResult);
    const takingsData = readResult(takingsResult);
    const availabilityData = readResult(availabilityResult);
    const businessUsersData = readResult(businessUsersResult);
    const settingsData = readResult(settingsResult);
    const collectionsData = readResult(collectionsResult);
    const sizeBandsData = readResult(sizeBandsResult);
    const promotionsData = readResult(promotionsResult);

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
      commission_minor: moneySummaryData.commission_minor ?? 0,
      manual_takings_minor: moneySummaryData.manual_takings_minor ?? 0,
      net_income_minor: moneySummaryData.net_income_minor ?? 0,
    };
    manualTakings = takingsData.takings ?? [];
    availabilityWindows = availabilityData.windows ?? [];
    businessUsers = businessUsersData.users ?? [];
    storeSettings = settingsData;
    collections = collectionsData.collections ?? [];
    sizeBands = sizeBandsData.size_bands ?? [];
    promotions = promotionsData.promotions ?? [];
  }

  return {
    profile,
    currentUser,
    designs,
    orders: canManage ? orders : stripStaffMoneyDetails(orders),
    measurementFields: fieldsData.fields ?? [],
    moneySummary,
    manualTakings,
    bookings: bookingsData.bookings ?? [],
    handovers: handoversData.handovers ?? [],
    notifications: notificationsData.notifications ?? [],
    availabilityWindows,
    businessUsers,
    storeSettings,
    collections,
    sizeBands,
    promotions,
    section,
    orderFilter,
    dataWarnings: uniqueDashboardWarnings(dataWarnings),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "logout") {
    return logOut(request);
  }

  if (dashboardActionIntents.has(intent)) {
    const currentUser = await loadCurrentUser(request);
    if (!canUseDashboardIntent(currentUser.role, intent)) {
      return {
        permissionError: rolePermissionMessage(currentUser.role),
      };
    }
  }

  if (intent === "advance") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID) {
      return { orderError: "That order cannot move stages yet." };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/advance`,
      { method: "POST" },
    );
    if (!response.ok) {
      return { orderError: "That order cannot move stages yet." };
    }
    return redirect(returnTo);
  }

  if (intent === "record_measurements") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const source = String(form.get("source") ?? "").trim();
    const values = extractMeasurementValues(form);
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID || !source || Object.keys(values).length === 0) {
      return {
        measurementError: "Add at least one measurement value before saving.",
      };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/measurements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, values }),
      },
    );
    if (!response.ok) {
      return {
        measurementError:
          "Could not save those measurements. Check the order route and field list.",
      };
    }
    return redirect(returnTo);
  }

  if (intent === "create_walk_in_order") {
    const designID = String(form.get("design_id") ?? "").trim();
    const sizeBandID = String(form.get("size_band_id") ?? "").trim();
    const customerName = String(form.get("customer_name") ?? "").trim();
    const agreedTotalMinor = parseMoneyMinor(form.get("agreed_total_ghs"));
    if (!designID || !customerName) {
      return {
        walkInError:
          "Choose a design and add the customer name before logging a walk-in order.",
      };
    }
    const response = await apiFetch(request, "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        design_id: designID,
        size_band_id: sizeBandID || undefined,
        customer_name: customerName,
        customer_phone: String(form.get("customer_phone") ?? "").trim(),
        customer_email: String(form.get("customer_email") ?? "").trim(),
        agreed_total_minor: agreedTotalMinor,
      }),
    });
    if (!response.ok) {
      return {
        walkInError:
          "Could not log that walk-in order. Check the design, size, and customer details.",
      };
    }
    return redirect("/dashboard/orders?orders=confirmed");
  }

  if (intent === "set_agreed_total") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const agreedTotalMinor = parseMoneyMinor(form.get("agreed_total_ghs"));
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID || agreedTotalMinor === null) {
      return { orderError: "Add a valid agreed total before saving." };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/agreed-total`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed_total_minor: agreedTotalMinor }),
      },
    );
    if (!response.ok) {
      return { orderError: "Could not save that agreed total." };
    }
    return redirect(returnTo);
  }

  if (intent === "collect_balance") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const method =
      String(form.get("method") ?? "momo") === "card" ? "card" : "momo";
    const returnTo = safeDashboardReturn(String(form.get("return_to") ?? ""));
    if (!orderID) {
      return { orderError: "Choose an order before collecting a balance." };
    }
    const response = await apiFetch(
      request,
      `/orders/${encodeURIComponent(orderID)}/balance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      },
    );
    if (!response.ok) {
      return {
        orderError:
          "Could not open balance checkout. The order may already be paid or payment may be in progress.",
      };
    }
    const payload = (await response.json()) as {
      authorization_url?: string;
    };
    if (payload.authorization_url) {
      return redirect(payload.authorization_url);
    }
    return redirect(returnTo);
  }

  if (intent === "log_taking") {
    const amountMinor = parseMoneyMinor(form.get("amount_ghs"));
    const orderID = String(form.get("order_id") ?? "").trim();
    const method = String(form.get("method") ?? "").trim();
    const whatFor = String(form.get("what_for") ?? "").trim();
    if (amountMinor === null || !method || !whatFor) {
      return {
        moneyError:
          "Add an amount, method, and short reason before logging a taking.",
      };
    }
    const response = await apiFetch(request, "/money/takings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderID,
        amount_minor: amountMinor,
        method,
        what_for: whatFor,
      }),
    });
    if (!response.ok) {
      return {
        moneyError:
          "Could not log that taking. Check the amount, method, and order link.",
      };
    }
    return redirect("/dashboard/money");
  }

  if (intent === "cancel_booking") {
    const bookingID = String(form.get("booking_id") ?? "").trim();
    if (!bookingID) {
      return { bookingError: "That booking could not be found." };
    }
    const response = await apiFetch(
      request,
      `/bookings/${encodeURIComponent(bookingID)}/cancel`,
      { method: "POST" },
    );
    if (!response.ok) {
      return {
        bookingError:
          "Could not cancel that booking. It may already be closed.",
      };
    }
    return redirect("/dashboard/visits");
  }

  if (intent === "reschedule_booking") {
    const bookingID = String(form.get("booking_id") ?? "").trim();
    const slotStart = datetimeLocalToRFC3339(
      String(form.get("slot_start") ?? ""),
    );
    if (!bookingID || !slotStart) {
      return { bookingError: "Pick a valid new visit time." };
    }
    const response = await apiFetch(
      request,
      `/bookings/${encodeURIComponent(bookingID)}/reschedule`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_start: slotStart }),
      },
    );
    if (!response.ok) {
      return {
        bookingError:
          "Could not reschedule that visit. The slot may be unavailable.",
      };
    }
    return redirect("/dashboard/visits");
  }

  if (intent === "arrange_handover") {
    const orderID = String(form.get("order_id") ?? "").trim();
    const method = String(form.get("method") ?? "").trim();
    if (!orderID || !method) {
      return { handoverError: "Select a fulfilled order and handover method." };
    }
    const response = await apiFetch(request, "/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderID,
        method,
        recipient_name: String(form.get("recipient_name") ?? "").trim(),
        recipient_phone: String(form.get("recipient_phone") ?? "").trim(),
        address: String(form.get("address") ?? "").trim(),
        courier: String(form.get("courier") ?? "").trim(),
        note: String(form.get("note") ?? "").trim(),
      }),
    });
    if (!response.ok) {
      return {
        handoverError:
          "Could not arrange that handover. The order may not be fulfilled yet.",
      };
    }
    return redirect("/dashboard/handovers");
  }

  if (intent === "advance_handover") {
    const handoverID = String(form.get("handover_id") ?? "").trim();
    if (!handoverID) {
      return { handoverError: "That handover could not be found." };
    }
    const response = await apiFetch(
      request,
      `/handovers/${encodeURIComponent(handoverID)}/advance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courier: String(form.get("courier") ?? "").trim(),
          note: String(form.get("note") ?? "").trim(),
        }),
      },
    );
    if (!response.ok) {
      return {
        handoverError:
          "Could not move that handover. It may already be closed.",
      };
    }
    return redirect("/dashboard/handovers");
  }

  if (intent === "cancel_handover") {
    const handoverID = String(form.get("handover_id") ?? "").trim();
    if (!handoverID) {
      return { handoverError: "That handover could not be found." };
    }
    const response = await apiFetch(
      request,
      `/handovers/${encodeURIComponent(handoverID)}/cancel`,
      { method: "POST" },
    );
    if (!response.ok) {
      return {
        handoverError:
          "Could not cancel that handover. It may already be closed.",
      };
    }
    return redirect("/dashboard/handovers");
  }

  if (intent === "save_availability") {
    const windows = parseAvailabilityWindows(form);
    if (windows === null) {
      return {
        availabilityError:
          "Check the weekday, start time, end time, and slot length for each row.",
      };
    }
    const response = await apiFetch(request, "/availability/windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows }),
    });
    if (!response.ok) {
      return {
        availabilityError:
          "Could not save those hours. Avoid overlapping windows and use valid times.",
      };
    }
    return redirect("/dashboard/availability");
  }

  if (intent === "create_measurement_field") {
    const sequence = parseSequence(form.get("sequence"));
    if (sequence === null) {
      return {
        fieldError: "Use a zero or positive display order for the field.",
      };
    }
    const response = await apiFetch(request, "/measurement-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: String(form.get("label") ?? "").trim(),
        unit: String(form.get("unit") ?? "in").trim(),
        sequence,
      }),
    });
    if (!response.ok) {
      return {
        fieldError:
          "Could not add the field. Check the label and display order.",
      };
    }
    return redirect("/dashboard/measurements");
  }

  if (intent === "update_measurement_field") {
    const fieldID = String(form.get("field_id") ?? "").trim();
    const sequence = parseSequence(form.get("sequence"));
    if (!fieldID || sequence === null) {
      return {
        fieldError: "Could not update that field. Check the display order.",
      };
    }
    const response = await apiFetch(
      request,
      `/measurement-fields/${encodeURIComponent(fieldID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(form.get("label") ?? "").trim(),
          unit: String(form.get("unit") ?? "in").trim(),
          sequence,
        }),
      },
    );
    if (!response.ok) {
      return {
        fieldError:
          "Could not update that field. Another field may already use that order.",
      };
    }
    return redirect("/dashboard/measurements");
  }

  if (intent === "delete_measurement_field") {
    const fieldID = String(form.get("field_id") ?? "").trim();
    if (!fieldID) {
      return { fieldError: "Could not delete that field." };
    }
    const response = await apiFetch(
      request,
      `/measurement-fields/${encodeURIComponent(fieldID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return { fieldError: "Could not delete that field." };
    }
    return redirect("/dashboard/measurements");
  }

  if (intent === "save_store_settings") {
    const brandColor = String(form.get("brand_color") ?? "").trim();
    const response = await apiFetch(request, "/store-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bespoke_enabled: form.get("bespoke_enabled") === "on",
        measurements_enabled: form.get("measurements_enabled") === "on",
        customisation_enabled: form.get("customisation_enabled") === "on",
        collections_enabled: form.get("collections_enabled") === "on",
        delivery_enabled: form.get("delivery_enabled") === "on",
        dispatch_enabled: form.get("dispatch_enabled") === "on",
        brand_color: brandColor || tokens.burgundy,
      }),
    });
    if (!response.ok) {
      return {
        settingsError:
          "Could not save storefront settings. Check the brand colour and feature switches.",
      };
    }
    return redirect("/dashboard/settings");
  }

  if (intent === "create_business_user") {
    const response = await apiFetch(request, "/auth/business/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: String(form.get("display_name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
        role: String(form.get("role") ?? "staff").trim(),
      }),
    });
    if (!response.ok) {
      return { teamError: businessUserErrorMessage(response.status, "create") };
    }
    return redirect("/dashboard/team");
  }

  if (intent === "update_business_user") {
    const userID = String(form.get("business_user_id") ?? "").trim();
    if (!userID) {
      return { teamError: "That team member could not be found." };
    }
    const response = await apiFetch(
      request,
      `/auth/business/users/${encodeURIComponent(userID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: String(form.get("display_name") ?? "").trim(),
          role: String(form.get("role") ?? "staff").trim(),
          is_active: String(form.get("is_active") ?? "false") === "true",
        }),
      },
    );
    if (!response.ok) {
      return { teamError: businessUserErrorMessage(response.status, "update") };
    }
    return redirect("/dashboard/team");
  }

  if (intent === "reset_business_user_password") {
    const userID = String(form.get("business_user_id") ?? "").trim();
    if (!userID) {
      return { teamError: "That team member could not be found." };
    }
    const response = await apiFetch(
      request,
      `/auth/business/users/${encodeURIComponent(userID)}/password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: String(form.get("password") ?? ""),
        }),
      },
    );
    if (!response.ok) {
      return { teamError: businessUserErrorMessage(response.status, "reset") };
    }
    return redirect("/dashboard/team");
  }

  if (intent === "transfer_owner") {
    const newOwnerUserID = String(form.get("new_owner_user_id") ?? "").trim();
    if (!newOwnerUserID) {
      return { teamError: "Choose an active admin to become the owner." };
    }
    const response = await apiFetch(request, "/auth/business/owner-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        new_owner_user_id: newOwnerUserID,
        confirmation: String(form.get("confirmation") ?? ""),
      }),
    });
    if (!response.ok) {
      return {
        teamError: businessUserErrorMessage(response.status, "transfer"),
      };
    }
    return redirect("/dashboard/team");
  }

  if (intent === "create_collection") {
    const sequence = parseSequence(form.get("sequence"));
    if (sequence === null) {
      return {
        collectionError:
          "Use a zero or positive display order for the collection.",
      };
    }
    const response = await apiFetch(request, "/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? "").trim(),
        theme: String(form.get("theme") ?? "").trim(),
        sequence,
      }),
    });
    if (!response.ok) {
      return {
        collectionError:
          "Could not create that collection. Add a name and unique display order.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "retire_collection" || intent === "restore_collection") {
    const collectionID = String(form.get("collection_id") ?? "").trim();
    if (!collectionID) {
      return { collectionError: "That collection could not be found." };
    }
    const actionName = intent === "retire_collection" ? "retire" : "restore";
    const response = await apiFetch(
      request,
      `/collections/${encodeURIComponent(collectionID)}/${actionName}`,
      { method: "POST" },
    );
    if (!response.ok) {
      return { collectionError: "Could not update that collection." };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "delete_collection") {
    const collectionID = String(form.get("collection_id") ?? "").trim();
    if (!collectionID) {
      return { collectionError: "That collection could not be found." };
    }
    const response = await apiFetch(
      request,
      `/collections/${encodeURIComponent(collectionID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return {
        collectionError:
          "Could not remove that collection. Retire it first if it is still active.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "create_size_band") {
    const sequence = parseSequence(form.get("sequence"));
    if (sequence === null) {
      return {
        sizeBandError: "Use a zero or positive display order for the size.",
      };
    }
    const response = await apiFetch(request, "/size-bands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: String(form.get("label") ?? "").trim(),
        sequence,
      }),
    });
    if (!response.ok) {
      return {
        sizeBandError:
          "Could not create that size band. Add a label and unique display order.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "create_promotion" || intent === "update_promotion") {
    const parsed = promotionBodyFromForm(form);
    if (!parsed.ok) {
      return { promotionError: parsed.message };
    }
    const promotionID = String(form.get("promotion_id") ?? "").trim();
    if (intent === "update_promotion" && !promotionID) {
      return { promotionError: "That promotion could not be found." };
    }
    const response = await apiFetch(
      request,
      intent === "create_promotion"
        ? "/promotions"
        : `/promotions/${encodeURIComponent(promotionID)}`,
      {
        method: intent === "create_promotion" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.body),
      },
    );
    if (!response.ok) {
      return {
        promotionError: promotionErrorMessage(response.status),
      };
    }
    return redirect("/dashboard/promotions");
  }

  if (intent === "archive_promotion") {
    const promotionID = String(form.get("promotion_id") ?? "").trim();
    if (!promotionID) {
      return { promotionError: "That promotion could not be found." };
    }
    const response = await apiFetch(
      request,
      `/promotions/${encodeURIComponent(promotionID)}/archive`,
      { method: "POST" },
    );
    if (!response.ok) {
      return {
        promotionError: promotionErrorMessage(response.status),
      };
    }
    return redirect("/dashboard/promotions");
  }

  if (intent === "upload_design_image") {
    const designID = String(form.get("design_id") ?? "").trim();
    const file = form.get("image_file");
    if (!designID) {
      return { mediaError: "Choose a design before uploading an image." };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { mediaError: "Choose an image file before uploading." };
    }
    if (!file.type.startsWith("image/")) {
      return { mediaError: "Upload an image file such as JPG, PNG, or WebP." };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { mediaError: "Keep design images under 10 MB." };
    }

    const designResponse = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
    );
    if (!designResponse.ok) {
      return { mediaError: "That design could not be found." };
    }
    const design = (await designResponse.json()) as Design;
    const imageUrl = await uploadDesignImage(request, file);
    if (!imageUrl) {
      return {
        mediaError:
          "Could not upload that image. Check Cloudinary setup or try another file.",
      };
    }

    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          designPatchBody(design, [
            imageUrl,
            ...design.images.filter((url) => url !== imageUrl),
          ]),
        ),
      },
    );
    if (!response.ok) {
      return {
        mediaError: "Image uploaded, but the design could not be saved.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "update_design") {
    const designID = String(form.get("design_id") ?? "").trim();
    const sequence = parseSequence(form.get("sequence"));
    const depositOverrideMinor = parseMoneyMinor(form.get("deposit_ghs"));
    if (!designID || sequence === null) {
      return {
        designError: "Could not update that design. Check the display order.",
      };
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: String(form.get("collection_id") ?? "").trim() || null,
          title: String(form.get("title") ?? "").trim(),
          description: String(form.get("description") ?? "").trim(),
          customisation_allowed: form.get("customisation") === "on",
          deposit_override_minor: depositOverrideMinor,
          sequence,
          images: parseImageURLs(form.get("image_urls")),
        }),
      },
    );
    if (!response.ok) {
      return {
        designError:
          "Could not update that design. Check the title, images, deposit, and collection.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "set_design_price") {
    const designID = String(form.get("design_id") ?? "").trim();
    const sizeBandID = String(form.get("size_band_id") ?? "").trim();
    const priceMinor = parseMoneyMinor(form.get("price_ghs"));
    if (!designID || !sizeBandID || priceMinor === null) {
      return { priceError: "Choose a design, size, and valid price." };
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}/prices/${encodeURIComponent(sizeBandID)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_minor: priceMinor }),
      },
    );
    if (!response.ok) {
      return { priceError: "Could not save that design price." };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "create") {
    const sequence = parseSequence(form.get("sequence"));
    const depositOverrideMinor = parseMoneyMinor(form.get("deposit_ghs"));

    // The first catalogue image is uploaded from the user's device to Cloudinary
    // (no link pasting); only the resulting URL is stored.
    const file = form.get("image_file");
    let images: string[] = [];
    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) {
        return {
          designError: "Upload an image file such as JPG, PNG, or WebP.",
        };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { designError: "Keep design images under 10 MB." };
      }
      const imageUrl = await uploadDesignImage(request, file);
      if (!imageUrl) {
        return {
          designError:
            "Could not upload that image. Check Cloudinary setup or try another file.",
        };
      }
      images = [imageUrl];
    }

    const response = await apiFetch(request, "/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_id: String(form.get("collection_id") ?? "").trim() || null,
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        customisation_allowed: form.get("customisation") === "on",
        deposit_override_minor: depositOverrideMinor,
        sequence: sequence ?? 0,
        images,
      }),
    });
    if (!response.ok) {
      return {
        designError: "Could not create the design. A title is required.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "delete_design") {
    const designID = String(form.get("id") ?? "").trim();
    if (!designID) {
      return { designError: "That design could not be found." };
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      return { designError: "Could not remove that design." };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "retire" || intent === "restore") {
    const designID = String(form.get("id") ?? "").trim();
    if (!designID) {
      return { designError: "That design could not be found." };
    }
    const response = await apiFetch(
      request,
      `/designs/${encodeURIComponent(designID)}/${intent}`,
      { method: "POST" },
    );
    if (!response.ok) {
      return { designError: "Could not update that design status." };
    }
    return redirect("/dashboard/catalogue");
  }

  return null;
}

function parseOrderFilter(value: string | null): OrderFilter {
  return orderFilters.some((filter) => filter.value === value)
    ? (value as OrderFilter)
    : "all";
}

function parseDashboardSection(
  value: string | undefined,
  canManage: boolean,
): DashboardSection {
  if (!value) {
    return canManage ? "overview" : "tasks";
  }

  if (canManage && isManagementSection(value)) {
    return value;
  }

  if (!canManage && isStaffSection(value)) {
    return value;
  }

  throw redirect("/dashboard");
}

function isManagementSection(value: string): value is DashboardSection {
  return [
    "overview",
    "reports",
    "orders",
    "money",
    "visits",
    "handovers",
    "catalogue",
    "promotions",
    "measurements",
    "availability",
    "settings",
    "team",
    "messages",
  ].includes(value);
}

function isStaffSection(value: string): value is DashboardSection {
  return ["tasks", "orders", "visits", "handovers", "messages"].includes(value);
}

async function loadCurrentUser(request: Request): Promise<CurrentUser> {
  const response = await apiFetch(request, "/auth/business/me");
  if (!response.ok) {
    throw redirect("/login");
  }
  return (await response.json()) as CurrentUser;
}

function canManageDashboard(role: string): boolean {
  return role === "owner" || role === "admin";
}

function canUseDashboardIntent(role: string, intent: string): boolean {
  if (canManageDashboard(role)) {
    return true;
  }
  return role === "staff" && staffAllowedIntents.has(intent);
}

function stripStaffMoneyDetails(orders: OrderSummary[]): OrderSummary[] {
  return orders.map((order) => ({
    ...order,
    agreed_total_minor: null,
    settled_minor: 0,
    payment_amount_minor: null,
  }));
}

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "staff":
      return "Staff";
    default:
      return "Limited access";
  }
}

function roleTone(role: string): string {
  switch (role) {
    case "owner":
      return tokens.burgundy;
    case "admin":
      return tokens.info;
    case "staff":
      return tokens.success;
    default:
      return tokens.mutedText;
  }
}

function rolePermissionMessage(role: string): string {
  if (role === "staff") {
    return "Staff can work orders, visits, measurements, and handovers. Money, catalogue, measurement setup, availability, and reports stay with owners or admins.";
  }
  return "Your current role cannot perform that dashboard action.";
}

function businessUserErrorMessage(
  status: number,
  action: "create" | "update" | "reset" | "transfer",
): string {
  if (status === 403) {
    return action === "transfer"
      ? "Only the current owner can transfer business ownership."
      : "Only owners and admins can manage team access.";
  }
  if (status === 409) {
    return "That email is already attached to this business.";
  }
  if (status === 404) {
    return action === "transfer"
      ? "Choose an active admin account before transferring ownership."
      : "That team member could not be found or is protected.";
  }
  if (status === 400) {
    if (action === "create") {
      return "Add a name, valid email, password of at least 8 characters, and an admin or staff role.";
    }
    if (action === "reset") {
      return "Use a temporary password between 8 and 72 characters.";
    }
    if (action === "transfer") {
      return 'Choose an active admin and type "TRANSFER OWNER" exactly.';
    }
    return "Add a name and choose an admin or staff role before saving.";
  }
  if (action === "create") {
    return "Could not create that team member yet.";
  }
  if (action === "transfer") {
    return "Could not transfer ownership yet.";
  }
  return action === "reset"
    ? "Could not reset that team member's password yet."
    : "Could not update that team member yet.";
}

function railBadge(count: number): string | undefined {
  return count > 0 ? String(count) : undefined;
}

function dashboardPageMeta(section: DashboardSection): DashboardPageMeta {
  switch (section) {
    case "tasks":
      return {
        eyebrow: "Shift desk",
        title: "Task queue",
        helper:
          "The work staff can safely move today: fittings, visits, production stages, handovers, and message checks.",
        icon: <TuneRounded />,
        tone: tokens.success,
      };
    case "reports":
      return {
        eyebrow: "Reports",
        title: "Studio performance snapshot",
        helper:
          "Read revenue movement, collection health, production status, and follow-up pressure without digging through every order.",
        icon: <QueryStatsRounded />,
        tone: tokens.info,
      };
    case "orders":
      return {
        eyebrow: "Production",
        title: "Order board",
        helper:
          "Filter live work, capture measurements, and move confirmed garments through the studio in clear stages.",
        icon: <TimelineRounded />,
        tone: tokens.burgundy,
      };
    case "money":
      return {
        eyebrow: "Money",
        title: "Money desk",
        helper:
          "Track platform payments, manual takings, commission, and net income while keeping funds outside Xtiitch.",
        icon: <AccountBalanceWalletRounded />,
        tone: tokens.success,
      };
    case "visits":
      return {
        eyebrow: "Appointments",
        title: "Visit queue",
        helper:
          "Manage held and booked home visits, keep customers updated, and protect the shop calendar.",
        icon: <CalendarMonthRounded />,
        tone: tokens.info,
      };
    case "handovers":
      return {
        eyebrow: "Fulfilment",
        title: "Handover desk",
        helper:
          "Arrange pickup and delivery work for finished garments, then close the customer loop cleanly.",
        icon: <LocalShippingRounded />,
        tone: tokens.warning,
      };
    case "catalogue":
      return {
        eyebrow: "Storefront",
        title: "Design studio",
        helper:
          "Publish, retire, and refresh the designs customers see before they order or request custom work.",
        icon: <DesignServicesRounded />,
        tone: tokens.burgundy,
      };
    case "promotions":
      return {
        eyebrow: "Growth",
        title: "Promotion desk",
        helper:
          "Create business-funded promo codes for the whole store, one collection, or a specific design.",
        icon: <LocalOfferRounded />,
        tone: tokens.gold,
      };
    case "measurements":
      return {
        eyebrow: "Fittings",
        title: "Measurement setup",
        helper:
          "Define the fields staff use for visit, shop, and self-measurement flows so order records stay consistent.",
        icon: <StraightenRounded />,
        tone: tokens.info,
      };
    case "availability":
      return {
        eyebrow: "Calendar",
        title: "Visit hours",
        helper:
          "Set the appointment windows customers can book and keep fitting capacity realistic.",
        icon: <ScheduleRounded />,
        tone: tokens.gold,
      };
    case "settings":
      return {
        eyebrow: "Storefront setup",
        title: "Store switches",
        helper:
          "Control what customers can request, which services appear, and how your public store is branded.",
        icon: <SettingsRounded />,
        tone: tokens.burgundy,
      };
    case "team":
      return {
        eyebrow: "Access",
        title: "Team permissions",
        helper:
          "Create admin and staff accounts, keep inactive people out, and see who can manage the studio.",
        icon: <PeopleAltRounded />,
        tone: tokens.info,
      };
    case "messages":
      return {
        eyebrow: "Outbox",
        title: "Message log",
        helper:
          "Review order, payment, booking, and handover notifications so customer communication stays accountable.",
        icon: <NotificationsRounded />,
        tone: tokens.burgundy,
      };
    case "overview":
    default:
      return {
        eyebrow: "Control room",
        title: "Studio command center",
        helper:
          "Spot the studio decisions that need attention first, then move into the room that needs action.",
        icon: <TuneRounded />,
        tone: tokens.burgundy,
      };
  }
}

function safeDashboardReturn(value: string): string {
  if (value === "/dashboard" || value.startsWith("/dashboard?")) {
    return value;
  }

  if (value.startsWith("/dashboard/")) {
    const path = value.split(/[?#]/)[0] ?? "";
    const section = path.slice("/dashboard/".length);
    if (isManagementSection(section) || isStaffSection(section)) {
      return value;
    }
  }

  return "/dashboard/orders?orders=all";
}

function parseSequence(value: FormDataEntryValue | null): number | null {
  const sequence = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(sequence) && sequence >= 0 ? sequence : null;
}

function parseMoneyMinor(value: FormDataEntryValue | null): number | null {
  const entered = String(value ?? "")
    .replaceAll(",", "")
    .trim();
  if (!entered) {
    return null;
  }
  const amount = Number.parseFloat(entered);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round(amount * 100);
}

function parseOptionalMoneyMinor(
  value: FormDataEntryValue | null,
): number | null {
  const entered = String(value ?? "")
    .replaceAll(",", "")
    .trim();
  if (!entered) {
    return 0;
  }
  const amount = Number.parseFloat(entered);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100);
}

function parseOptionalPositiveInt(
  value: FormDataEntryValue | null,
): number | null | undefined {
  const entered = String(value ?? "").trim();
  if (!entered) {
    return null;
  }
  const parsed = Number.parseInt(entered, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePercentBps(value: FormDataEntryValue | null): number | null {
  const entered = String(value ?? "").trim();
  if (!entered) {
    return null;
  }
  const percent = Number.parseFloat(entered);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return null;
  }
  return Math.round(percent * 100);
}

type PromotionFormBody =
  | {
      ok: true;
      body: {
        code: string;
        title: string;
        description: string;
        discount_type: string;
        discount_value: number;
        max_discount_minor: number | null;
        min_spend_minor: number;
        usage_limit_global: number | null;
        usage_limit_per_customer: number | null;
        scope: string;
        target_collection_id: string | null;
        target_design_id: string | null;
        status: string;
        starts_at: string;
        ends_at: string;
      };
    }
  | { ok: false; message: string };

function promotionBodyFromForm(form: FormData): PromotionFormBody {
  const code = String(form.get("code") ?? "")
    .trim()
    .toUpperCase();
  const title = String(form.get("title") ?? "").trim();
  const discountType =
    String(form.get("discount_type") ?? "percentage") === "fixed"
      ? "fixed"
      : "percentage";
  const scope = ["store", "collection", "design"].includes(
    String(form.get("scope") ?? ""),
  )
    ? String(form.get("scope") ?? "")
    : "store";
  const status =
    String(form.get("status") ?? "active") === "paused" ? "paused" : "active";
  const minSpendMinor = parseOptionalMoneyMinor(form.get("min_spend_ghs"));
  const usageLimitGlobal = parseOptionalPositiveInt(
    form.get("usage_limit_global"),
  );
  const usageLimitPerCustomer = parseOptionalPositiveInt(
    form.get("usage_limit_per_customer"),
  );
  if (!code || !title) {
    return { ok: false, message: "Add a code and title for the promotion." };
  }
  if (
    minSpendMinor === null ||
    usageLimitGlobal === undefined ||
    usageLimitPerCustomer === undefined
  ) {
    return {
      ok: false,
      message:
        "Check the spend floor and usage limits. Limits can be blank, but must be positive when set.",
    };
  }

  let maxDiscountMinor: number | null = null;
  const discountValue =
    discountType === "percentage"
      ? parsePercentBps(form.get("percentage_discount"))
      : parseMoneyMinor(form.get("fixed_discount_ghs"));
  if (discountType === "percentage") {
    maxDiscountMinor = parseMoneyMinor(form.get("max_discount_ghs"));
    if (discountValue === null || maxDiscountMinor === null) {
      return {
        ok: false,
        message:
          "Percentage promos need a discount percent and a maximum discount amount.",
      };
    }
  } else {
    if (discountValue === null) {
      return { ok: false, message: "Add a valid fixed discount amount." };
    }
  }

  const startsRaw = String(form.get("starts_at") ?? "").trim();
  const endsRaw = String(form.get("ends_at") ?? "").trim();
  const startsAt = startsRaw ? datetimeLocalToRFC3339(startsRaw) : null;
  const endsAt = endsRaw ? datetimeLocalToRFC3339(endsRaw) : null;
  if ((startsRaw && !startsAt) || (endsRaw && !endsAt)) {
    return { ok: false, message: "Use valid start and end dates." };
  }

  const targetCollectionID =
    scope === "collection"
      ? String(form.get("target_collection_id") ?? "").trim() || null
      : null;
  const targetDesignID =
    scope === "design"
      ? String(form.get("target_design_id") ?? "").trim() || null
      : null;
  if (
    (scope === "collection" && !targetCollectionID) ||
    (scope === "design" && !targetDesignID)
  ) {
    return {
      ok: false,
      message: "Choose the collection or design this promotion targets.",
    };
  }

  return {
    ok: true,
    body: {
      code,
      title,
      description: String(form.get("description") ?? "").trim(),
      discount_type: discountType,
      discount_value: discountValue,
      max_discount_minor: maxDiscountMinor,
      min_spend_minor: minSpendMinor,
      usage_limit_global: usageLimitGlobal,
      usage_limit_per_customer: usageLimitPerCustomer,
      scope,
      target_collection_id: targetCollectionID,
      target_design_id: targetDesignID,
      status,
      starts_at: startsAt ?? "",
      ends_at: endsAt ?? "",
    },
  };
}

function promotionErrorMessage(status: number): string {
  if (status === 409) {
    return "That promotion code is already in use.";
  }
  if (status === 404) {
    return "That promotion or target could not be found.";
  }
  if (status === 400) {
    return "Check the promotion details, target, discount, and active dates.";
  }
  return "Could not save that promotion yet.";
}

function parseImageURLs(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean);
}

async function uploadDesignImage(
  request: Request,
  file: File,
): Promise<string | null> {
  const signatureResponse = await apiFetch(
    request,
    "/media/design-upload-signature",
    { method: "POST" },
  );
  if (!signatureResponse.ok) {
    return null;
  }
  const signature = (await signatureResponse.json()) as UploadSignature;
  if (signature.cloud_name === "demo" && signature.api_key === "demo") {
    return null;
  }

  const uploadForm = new FormData();
  uploadForm.set("file", file);
  uploadForm.set("api_key", signature.api_key);
  uploadForm.set("timestamp", String(signature.timestamp));
  uploadForm.set("signature", signature.signature);
  if (signature.folder) {
    uploadForm.set("folder", signature.folder);
  }

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloud_name)}/image/upload`,
    { method: "POST", body: uploadForm },
  );
  if (!uploadResponse.ok) {
    return null;
  }
  const result = (await uploadResponse.json()) as CloudinaryUploadResult;
  return result.secure_url ?? result.url ?? null;
}

function designPatchBody(
  design: Design,
  images: string[],
): Record<string, unknown> {
  return {
    collection_id: design.collection_id,
    title: design.title,
    description: design.description,
    customisation_allowed: design.customisation_allowed,
    deposit_override_minor: design.deposit_override_minor,
    sequence: design.sequence,
    images,
  };
}

function datetimeLocalToRFC3339(value: string): string | null {
  const entered = value.trim();
  if (!entered) {
    return null;
  }
  const withSeconds = entered.length === 16 ? `${entered}:00` : entered;
  const parsed = new Date(`${withSeconds}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

function parseAvailabilityWindows(form: FormData): AvailabilityWindow[] | null {
  const weekdays = form.getAll("weekday");
  const starts = form.getAll("start");
  const ends = form.getAll("end");
  const slots = form.getAll("slot_minutes");
  const rows = Math.max(
    weekdays.length,
    starts.length,
    ends.length,
    slots.length,
  );
  const windows: AvailabilityWindow[] = [];

  for (let index = 0; index < rows; index += 1) {
    const weekdayValue = String(weekdays[index] ?? "").trim();
    const startValue = String(starts[index] ?? "").trim();
    const endValue = String(ends[index] ?? "").trim();
    const slotValue = String(slots[index] ?? "").trim();
    if (!startValue && !endValue) {
      continue;
    }
    const weekday = Number.parseInt(weekdayValue, 10);
    const startMinute = parseTimeToMinutes(startValue);
    const endMinute = parseTimeToMinutes(endValue);
    const slotMinutes = Number.parseInt(slotValue, 10);
    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      startMinute === null ||
      endMinute === null ||
      endMinute <= startMinute ||
      !Number.isInteger(slotMinutes) ||
      slotMinutes < 15 ||
      slotMinutes > 480
    ) {
      return null;
    }
    windows.push({
      weekday,
      start_minute: startMinute,
      end_minute: endMinute,
      slot_minutes: slotMinutes,
    });
  }

  return windows;
}

function extractMeasurementValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("measurement_")) {
      continue;
    }
    const fieldID = key.slice("measurement_".length);
    const entered = String(value ?? "").trim();
    if (fieldID && entered) {
      values[fieldID] = entered;
    }
  }
  return values;
}

function filterOrders(
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

function countOrders(orders: OrderSummary[], filter: OrderFilter): number {
  return filterOrders(orders, filter).length;
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildRevenueBuckets(
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

function buildStageMetrics(
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

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

function percentage(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return (value / total) * 100;
}

function daysBetween(start: Date, end: Date): number {
  const startDay = startOfLocalDay(start);
  const endDay = startOfLocalDay(end);
  return Math.max(
    0,
    Math.floor((endDay.getTime() - startDay.getTime()) / dayMs),
  );
}

function ageLabel(value: string, now = new Date()): string {
  const date = parseDate(value);
  if (!date) {
    return "Date missing";
  }
  const days = daysBetween(date, now);
  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "1 day";
  }
  return `${days} days`;
}

function buildFollowUps({
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

function fulfilledOrdersWithoutOpenHandover(
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

function stageColor(colour: string): string {
  switch (colour) {
    case "green":
      return tokens.success;
    case "yellow":
      return tokens.warning;
    default:
      return tokens.burgundy;
  }
}

function orderRouteLabel(order: OrderSummary): string {
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

function measurementSourceFor(order: OrderSummary): "visit" | "shop" | null {
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

function statusLabel(status: string): string {
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

function paymentLabel(order: OrderSummary): string {
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

function paymentTone(order: OrderSummary): string {
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

function bookingTone(status: string): string {
  switch (status) {
    case "booked":
      return tokens.success;
    case "held":
      return tokens.warning;
    case "cancelled":
      return tokens.danger;
    case "rescheduled":
      return tokens.info;
    default:
      return tokens.mutedText;
  }
}

function handoverTone(status: string): string {
  switch (status) {
    case "pending":
      return tokens.warning;
    case "dispatched":
      return tokens.info;
    case "completed":
      return tokens.success;
    case "cancelled":
      return tokens.danger;
    default:
      return tokens.mutedText;
  }
}

function notificationTone(status: string): string {
  switch (status) {
    case "sent":
      return tokens.success;
    case "sending":
      return tokens.info;
    case "dead":
      return tokens.danger;
    case "pending":
      return tokens.warning;
    default:
      return tokens.mutedText;
  }
}

function moneyProgress(order: OrderSummary): string {
  const target = order.agreed_total_minor ?? order.payment_amount_minor;
  if (!target) {
    return order.settled_minor > 0
      ? formatGHS(order.settled_minor)
      : "No total set";
  }
  return `${formatGHS(order.settled_minor)} / ${formatGHS(target)}`;
}

function moneyInputValue(value: number | null | undefined): string {
  if (!value || value <= 0) {
    return "";
  }
  return String(value / 100);
}

function orderTargetMinor(order: OrderSummary): number | null {
  return order.agreed_total_minor ?? order.payment_amount_minor ?? null;
}

function orderBalanceDueMinor(order: OrderSummary): number {
  const target = orderTargetMinor(order);
  if (!target) {
    return 0;
  }
  return Math.max(0, target - order.settled_minor);
}

function findBandPrice(
  design: Design,
  sizeBandID: string,
): BandPrice | undefined {
  return design.prices.find((price) => price.size_band_id === sizeBandID);
}

function enabledStoreSettings(settings: StoreSettings): number {
  return [
    settings.bespoke_enabled,
    settings.measurements_enabled,
    settings.customisation_enabled,
    settings.collections_enabled,
    settings.delivery_enabled,
    settings.dispatch_enabled,
  ].filter(Boolean).length;
}

function shortDate(value: string): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function shortDateTime(value: string): string {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function datetimeLocalValue(value: string): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 16);
}

function splitDateTimeInputValue(value = ""): {
  date: string;
  time: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) {
    const fallback = datetimeLocalValue(value);
    return fallback && fallback !== value
      ? splitDateTimeInputValue(fallback)
      : { date: "", time: "" };
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function normaliseDateInput(value: string): string | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const year = Number.parseInt(iso[1] ?? "", 10);
    const month = Number.parseInt(iso[2] ?? "", 10);
    const day = Number.parseInt(iso[3] ?? "", 10);
    return validCalendarDate(year, month, day)
      ? `${iso[1]}-${iso[2]}-${iso[3]}`
      : null;
  }

  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!local) {
    return null;
  }
  const day = Number.parseInt(local[1] ?? "", 10);
  const month = Number.parseInt(local[2] ?? "", 10);
  const year = Number.parseInt(local[3] ?? "", 10);
  if (!validCalendarDate(year, month, day)) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normaliseTimeInput(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function composeDateTimeValue(dateValue: string, timeValue: string): string {
  const date = normaliseDateInput(dateValue);
  const time = normaliseTimeInput(timeValue);
  return date && time ? `${date}T${time}` : "";
}

const monthOptions = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const hourOptions = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);

const defaultMinuteOptions = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);

const periodOptions = ["AM", "PM"] as const;

function optionListWithSelected(options: string[], selected: string): string[] {
  return selected && !options.includes(selected)
    ? [...options, selected].sort((a, b) => Number(a) - Number(b))
    : options;
}

function splitDateParts(value: string): {
  year: string;
  month: string;
  day: string;
} {
  const normalised = normaliseDateInput(value);
  if (!normalised) {
    return { year: "", month: "", day: "" };
  }
  const [year = "", month = "", day = ""] = normalised.split("-");
  return { year, month, day };
}

function splitTimeParts(value: string): {
  hour: string;
  minute: string;
  period: (typeof periodOptions)[number] | "";
} {
  const normalised = normaliseTimeInput(value);
  if (!normalised) {
    return { hour: "", minute: "", period: "" };
  }
  const [hourRaw = "0", minute = ""] = normalised.split(":");
  const hours = Number.parseInt(hourRaw, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return {
    hour: String(displayHour).padStart(2, "0"),
    minute,
    period,
  };
}

function composeDateInputValue(
  year: string,
  month: string,
  day: string,
): string {
  return normaliseDateInput(`${year}-${month}-${day}`) ?? "";
}

function composeTimeInputValue(
  hour: string,
  minute: string,
  period: string,
): string {
  if (!hour || !minute || !period) {
    return "";
  }
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  if (
    parsedHour < 1 ||
    parsedHour > 12 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return "";
  }
  const hours24 = period === "PM" ? (parsedHour % 12) + 12 : parsedHour % 12;
  return (
    normaliseTimeInput(
      `${String(hours24).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`,
    ) ?? ""
  );
}

function dayOptionsFor(year: string, month: string): string[] {
  const parsedYear = Number.parseInt(year, 10);
  const parsedMonth = Number.parseInt(month, 10);
  const maxDay =
    Number.isInteger(parsedYear) &&
    Number.isInteger(parsedMonth) &&
    parsedMonth >= 1 &&
    parsedMonth <= 12
      ? new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate()
      : 31;
  return Array.from({ length: maxDay }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );
}

function yearOptionsFor(selectedYear: string): string[] {
  const current = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, index) =>
    String(current - 1 + index),
  );
  return selectedYear && !years.includes(selectedYear)
    ? [...years, selectedYear].sort((a, b) => Number(a) - Number(b))
    : years;
}

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const StyledTemporalField = styled(Box)(({ theme }) => ({
  border: `1px solid ${alpha(tokens.ink, 0.1)}`,
  borderRadius: 20,
  background: `linear-gradient(180deg, rgba(var(--surface-rgb), 0.96), rgba(var(--surface-rgb), 0.78))`,
  padding: theme.spacing(0.75),
  transition:
    "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
  "&:focus-within": {
    borderColor: alpha(tokens.burgundy, 0.42),
    boxShadow: `0 0 0 4px ${alpha(tokens.burgundy, 0.1)}`,
  },
  "&[data-disabled='true']": {
    opacity: 0.56,
  },
  "& .MuiFormLabel-root": {
    fontWeight: 800,
  },
  "& .MuiOutlinedInput-root": {
    borderRadius: 14,
    backgroundColor: tokens.white,
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: alpha(tokens.ink, 0.12),
  },
  "& .MuiInputBase-input": {
    fontWeight: 800,
    letterSpacing: 0,
  },
  "& .MuiSelect-select": {
    fontWeight: 800,
    letterSpacing: 0,
  },
  "& .MuiSelect-icon": {
    color: alpha(tokens.burgundy, 0.68),
  },
  "& .MuiInputAdornment-root .MuiSvgIcon-root": {
    color: alpha(tokens.burgundy, 0.78),
  },
}));

function StyledDateTimeField({
  name,
  label,
  defaultValue = "",
  required = false,
  disabled = false,
  size = "small",
  fullWidth = true,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  fullWidth?: boolean;
}) {
  const initial = splitDateTimeInputValue(defaultValue);
  const initialDate = splitDateParts(initial.date);
  const initialTime = splitTimeParts(initial.time);
  const [dateYear, setDateYear] = useState(initialDate.year);
  const [dateMonth, setDateMonth] = useState(initialDate.month);
  const [dateDay, setDateDay] = useState(initialDate.day);
  const [timeHour, setTimeHour] = useState(initialTime.hour);
  const [timeMinute, setTimeMinute] = useState(initialTime.minute);
  const [timePeriod, setTimePeriod] = useState<string>(initialTime.period);
  const dayOptions = useMemo(
    () => dayOptionsFor(dateYear, dateMonth),
    [dateYear, dateMonth],
  );
  const minuteOptions = useMemo(
    () => optionListWithSelected(defaultMinuteOptions, timeMinute),
    [timeMinute],
  );
  const dateValue = composeDateInputValue(dateYear, dateMonth, dateDay);
  const timeValue = composeTimeInputValue(timeHour, timeMinute, timePeriod);
  const hiddenValue = composeDateTimeValue(dateValue, timeValue);

  useEffect(() => {
    if (dateDay && !dayOptions.includes(dateDay)) {
      setDateDay("");
    }
  }, [dateDay, dayOptions]);

  return (
    <StyledTemporalField data-disabled={disabled ? "true" : undefined}>
      <input
        type="hidden"
        name={name}
        value={hiddenValue}
        disabled={disabled}
      />
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block", mb: 0.5 }}
      >
        {label}
        {required ? " *" : ""}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 0.75,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: 0.75,
            gridTemplateColumns: { xs: "1fr 1fr", sm: "0.9fr 1fr 1.2fr" },
          }}
        >
          <TextField
            select
            label="Day"
            value={dateDay}
            onChange={(event) => setDateDay(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          >
            <MenuItem value="">Day</MenuItem>
            {dayOptions.map((day) => (
              <MenuItem key={day} value={day}>
                {day}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Month"
            value={dateMonth}
            onChange={(event) => setDateMonth(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
          >
            <MenuItem value="">Month</MenuItem>
            {monthOptions.map((month) => (
              <MenuItem key={month.value} value={month.value}>
                {month.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Year"
            value={dateYear}
            onChange={(event) => setDateYear(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
            sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}
          >
            <MenuItem value="">Year</MenuItem>
            {yearOptionsFor(dateYear).map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 0.75,
            gridTemplateColumns: {
              xs: "1fr 1fr 0.9fr",
              sm: "0.9fr 0.9fr 0.8fr",
            },
          }}
        >
          <TextField
            select
            label="Hour"
            value={timeHour}
            onChange={(event) => setTimeHour(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <ScheduleRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          >
            <MenuItem value="">Hour</MenuItem>
            {hourOptions.map((hour) => (
              <MenuItem key={hour} value={hour}>
                {hour}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Minute"
            value={timeMinute}
            onChange={(event) => setTimeMinute(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
          >
            <MenuItem value="">Minute</MenuItem>
            {minuteOptions.map((minute) => (
              <MenuItem key={minute} value={minute}>
                {minute}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="AM/PM"
            value={timePeriod}
            onChange={(event) => setTimePeriod(event.target.value)}
            required={required}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
          >
            <MenuItem value="">--</MenuItem>
            {periodOptions.map((period) => (
              <MenuItem key={period} value={period}>
                {period}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
    </StyledTemporalField>
  );
}

function StyledTimeField({
  name,
  label,
  defaultValue = "",
  required = false,
  disabled = false,
  size = "small",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
}) {
  const initialTime = splitTimeParts(defaultValue);
  const [timeHour, setTimeHour] = useState(initialTime.hour);
  const [timeMinute, setTimeMinute] = useState(initialTime.minute);
  const [timePeriod, setTimePeriod] = useState<string>(initialTime.period);
  const minuteOptions = useMemo(
    () => optionListWithSelected(defaultMinuteOptions, timeMinute),
    [timeMinute],
  );
  const hiddenValue = composeTimeInputValue(timeHour, timeMinute, timePeriod);

  return (
    <StyledTemporalField data-disabled={disabled ? "true" : undefined}>
      <input
        type="hidden"
        name={name}
        value={hiddenValue}
        disabled={disabled}
      />
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block", mb: 0.5 }}
      >
        {label}
        {required ? " *" : ""}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 0.75,
          gridTemplateColumns: { xs: "1fr 1fr 0.9fr", sm: "0.9fr 0.9fr 0.8fr" },
        }}
      >
        <TextField
          select
          label="Hour"
          value={timeHour}
          onChange={(event) => setTimeHour(event.target.value)}
          required={required}
          disabled={disabled}
          size={size}
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <ScheduleRounded fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        >
          <MenuItem value="">Hour</MenuItem>
          {hourOptions.map((hour) => (
            <MenuItem key={hour} value={hour}>
              {hour}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Minute"
          value={timeMinute}
          onChange={(event) => setTimeMinute(event.target.value)}
          required={required}
          disabled={disabled}
          size={size}
          fullWidth
        >
          <MenuItem value="">Minute</MenuItem>
          {minuteOptions.map((minute) => (
            <MenuItem key={minute} value={minute}>
              {minute}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="AM/PM"
          value={timePeriod}
          onChange={(event) => setTimePeriod(event.target.value)}
          required={required}
          disabled={disabled}
          size={size}
          fullWidth
        >
          <MenuItem value="">--</MenuItem>
          {periodOptions.map((period) => (
            <MenuItem key={period} value={period}>
              {period}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </StyledTemporalField>
  );
}

function formatMethod(value: string): string {
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

function messageKindLabel(kind: string): string {
  return kind
    .split("_")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function handoverActionLabel(handover: HandoverSummary): string {
  if (handover.method === "delivery" && handover.status === "pending") {
    return "Mark dispatched";
  }
  return "Mark completed";
}

function canManageBooking(status: string): boolean {
  return status === "held" || status === "booked";
}

function canAdvanceHandover(status: string): boolean {
  return status === "pending" || status === "dispatched";
}

function orderInitials(order: OrderSummary): string {
  return (order.customer_name || order.design_title || "Order")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function businessUserInitials(user: BusinessUser): string {
  return (user.display_name || user.email || "Team")
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function businessUserJoinedLabel(user: BusinessUser): string {
  const created = shortDate(user.created_at);
  return created ? `Joined ${created}` : "Join date missing";
}

function fallbackDesignImage(design: Design): string {
  const key = design.handle || design.design_id || design.title;
  const index = Array.from(key).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return (
    dashboardFallbackDesignImages[
      index % dashboardFallbackDesignImages.length
    ] ??
    dashboardFallbackDesignImages[0] ??
    ""
  );
}

function Panel({
  children,
  sx,
  id,
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
  id?: string;
}) {
  return (
    <Paper
      id={id}
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.96)",
        backgroundImage: `linear-gradient(180deg, rgba(var(--surface-rgb), 0.78), rgba(var(--surface-rgb), 0.5))`,
        boxShadow: `0 18px 54px ${alpha(tokens.ink, 0.07)}`,
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        backdropFilter: "blur(10px)",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "dashboardSurfaceIn 420ms ease both",
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function SectionHeader({
  eyebrow,
  title,
  helper,
  action,
}: {
  eyebrow: string;
  title: string;
  helper: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      sx={{
        justifyContent: "space-between",
        alignItems: { xs: "flex-start", md: "flex-end" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", fontWeight: 800 }}
        >
          {eyebrow}
        </Typography>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        <Typography sx={{ mt: 0.5, color: "text.secondary", maxWidth: 720 }}>
          {helper}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = tokens.burgundy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <Panel
      sx={{
        p: 2.25,
        minHeight: 142,
        position: "relative",
        overflow: "hidden",
        backgroundImage: `linear-gradient(135deg, ${alpha(tone, 0.12)}, transparent 46%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.9), rgba(var(--surface-rgb), 0.58))`,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto auto 0",
          width: "100%",
          height: 3,
          bgcolor: tone,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          right: -34,
          bottom: -42,
          width: 110,
          height: 110,
          borderRadius: "50%",
          border: `1px solid ${alpha(tone, 0.18)}`,
          bgcolor: alpha(tone, 0.035),
        },
        "&:hover": {
          borderColor: alpha(tone, 0.25),
          transform: "translateY(-2px)",
          boxShadow: `0 22px 64px ${alpha(tokens.ink, 0.09)}`,
        },
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    >
      <Stack
        spacing={2}
        sx={{
          height: "100%",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 800 }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tone, 0.1),
              color: tone,
              border: "1px solid",
              borderColor: alpha(tone, 0.16),
              boxShadow: `0 12px 28px ${alpha(tone, 0.08)}`,
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Box>
          <Typography variant="h4" sx={{ lineHeight: 1.05 }}>
            {value}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.75, color: "text.secondary" }}
          >
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Panel>
  );
}

function ToneChip({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: string;
  icon?: ReactElement;
}) {
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={{
        bgcolor: alpha(tone, 0.1),
        color: tone,
        border: "1px solid",
        borderColor: alpha(tone, 0.22),
        "& .MuiChip-icon": { color: tone },
      }}
    />
  );
}

function WorkspaceRail({
  profile,
  currentUser,
  verified,
  workspaceGroups,
  section,
  storefrontURL,
  badges,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  verified: boolean;
  workspaceGroups: WorkspaceNavGroup[];
  section: DashboardSection;
  storefrontURL: string;
  badges: Partial<Record<DashboardSection, string | undefined>>;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const railSurfaceSx = {
    bgcolor: tokens.charcoal,
    color: tokens.white,
    backgroundImage: `
      linear-gradient(180deg, ${alpha(tokens.white, 0.06)} 0%, transparent 22%),
      linear-gradient(155deg, ${alpha(tokens.burgundy, 0.62)} 0%, ${tokens.charcoal} 50%, ${alpha(tokens.ink, 0.98)} 100%)
    `,
    boxShadow: `inset -1px 0 0 ${alpha(tokens.white, 0.08)}`,
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      workspaceGroups.map((group) => [
        group.id,
        group.id === "command"
          ? group.items.some((item) => item.section === section)
          : true,
      ]),
    ),
  );
  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }));
  };

  const renderWorkspaceGroup = (
    group: WorkspaceNavGroup,
    inDrawer: boolean,
    compact: boolean,
    placement: "main" | "bottom" = "main",
    solo: boolean = false,
  ) => {
    const activeGroup = group.items.some((item) => item.section === section);
    const open = openGroups[group.id] ?? true;
    const groupBadge = group.items.reduce((total, item) => {
      const value = Number(badges[item.section] ?? 0);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
    const groupTone = placement === "bottom" ? tokens.gold : tokens.warning;

    return (
      <Box key={group.id}>
        {!solo &&
          (compact ? (
          <Tooltip title={group.label} placement="right">
            <IconButton
              aria-label={`${group.label} navigation group`}
              aria-expanded={open}
              onClick={() => toggleGroup(group.id)}
              sx={{
                width: "100%",
                height: 40,
                color: activeGroup ? groupTone : alpha(tokens.white, 0.78),
                border: "1px solid",
                borderColor: activeGroup
                  ? alpha(groupTone, 0.34)
                  : alpha(tokens.white, 0.1),
                bgcolor: activeGroup
                  ? alpha(groupTone, 0.12)
                  : alpha(tokens.white, 0.035),
                borderRadius: 1.25,
                "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.1)" },
              }}
            >
              <Badge
                color="error"
                badgeContent={groupBadge}
                invisible={groupBadge === 0}
                max={99}
                sx={{
                  "& .MuiBadge-badge": {
                    bgcolor: tokens.burgundy,
                    color: tokens.white,
                    border: `1px solid ${alpha(tokens.white, 0.28)}`,
                  },
                }}
              >
                {group.icon}
              </Badge>
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            type="button"
            onClick={() => toggleGroup(group.id)}
            startIcon={group.icon}
            endIcon={
              open ? (
                <KeyboardArrowDownRounded />
              ) : (
                <KeyboardArrowRightRounded />
              )
            }
            aria-expanded={open}
            fullWidth
            sx={{
              minHeight: 36,
              justifyContent: "flex-start",
              color: activeGroup ? tokens.white : alpha(tokens.white, 0.72),
              borderRadius: 1.25,
              border: "1px solid",
              borderColor: activeGroup ? alpha(groupTone, 0.3) : "transparent",
              bgcolor: activeGroup ? alpha(groupTone, 0.11) : "transparent",
              position: "relative",
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: 9,
                bottom: 9,
                width: 2,
                borderRadius: 4,
                bgcolor: activeGroup ? groupTone : "transparent",
              },
              "& .MuiButton-startIcon": {
                color: activeGroup ? groupTone : alpha(tokens.white, 0.62),
              },
              "& .MuiButton-endIcon": {
                ml: "auto",
                color: alpha(tokens.white, 0.56),
              },
              "&:hover": {
                bgcolor: "rgba(var(--surface-rgb), 0.08)",
                borderColor: alpha(tokens.white, 0.1),
              },
            }}
          >
            <Box
              component="span"
              sx={{
                minWidth: 0,
                flex: 1,
                textAlign: "left",
                fontSize: 12,
                fontWeight: 950,
                letterSpacing: 0,
                textTransform: "uppercase",
              }}
            >
              {group.label}
            </Box>
            {groupBadge > 0 ? (
              <Chip
                size="small"
                label={groupBadge}
                sx={{
                  height: 20,
                  mr: 0.5,
                  color: tokens.white,
                  bgcolor: alpha(tokens.burgundy, 0.72),
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.14),
                }}
              />
            ) : null}
          </Button>
          ))}
        <Collapse in={solo || open} timeout="auto" unmountOnExit>
          <Stack spacing={0.55} sx={{ mt: 0.6, display: "grid" }}>
            {group.items.map((item) => {
              const active = item.section === section;
              const badge = badges[item.section];
              const itemButton = (
                <Button
                  key={item.href}
                  component={RouterLink}
                  to={item.href}
                  fullWidth
                  startIcon={compact ? undefined : item.icon}
                  aria-current={active ? "page" : undefined}
                  onClick={inDrawer ? onCloseMobile : undefined}
                  sx={{
                    minHeight: compact ? 44 : 48,
                    minWidth: 0,
                    px: compact ? 1 : 1.4,
                    justifyContent: compact ? "center" : "flex-start",
                    position: "relative",
                    overflow: "hidden",
                    color: active ? tokens.white : alpha(tokens.white, 0.88),
                    bgcolor: active ? alpha(tokens.white, 0.11) : "transparent",
                    border: "1px solid",
                    borderColor: active
                      ? alpha(tokens.gold, 0.24)
                      : "transparent",
                    borderRadius: 1.25,
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 7,
                      bottom: 7,
                      width: 3,
                      borderRadius: 4,
                      bgcolor: active ? tokens.gold : "transparent",
                    },
                    "& .MuiButton-startIcon": {
                      color: active ? tokens.gold : alpha(tokens.white, 0.58),
                    },
                    "&:hover": {
                      bgcolor: "rgba(var(--surface-rgb), 0.09)",
                      borderColor: alpha(tokens.white, 0.12),
                      color: tokens.white,
                      transform: compact
                        ? "translateY(-1px)"
                        : "translateX(2px)",
                      "& .MuiButton-startIcon": {
                        color: active ? tokens.gold : tokens.white,
                      },
                    },
                    transition:
                      "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
                  }}
                >
                  {compact ? (
                    <Badge
                      color="error"
                      badgeContent={badge ? Number(badge) : 0}
                      invisible={!badge}
                      max={99}
                      sx={{
                        "& .MuiBadge-badge": {
                          bgcolor: tokens.burgundy,
                          color: tokens.white,
                          border: `1px solid ${alpha(tokens.white, 0.28)}`,
                        },
                      }}
                    >
                      {item.icon}
                    </Badge>
                  ) : (
                    <>
                      <Box sx={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                        <Typography
                          component="span"
                          sx={{
                            display: "block",
                            fontWeight: active ? 900 : 780,
                            fontSize: 14,
                            lineHeight: 1.15,
                          }}
                          noWrap
                        >
                          {item.label}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            display: "block",
                            color: alpha(tokens.white, 0.56),
                            lineHeight: 1.1,
                          }}
                          noWrap
                        >
                          {item.helper}
                        </Typography>
                      </Box>
                      {badge ? (
                        <Chip
                          size="small"
                          label={badge}
                          sx={{
                            height: 22,
                            color: tokens.white,
                            bgcolor: alpha(tokens.burgundy, 0.72),
                            border: "1px solid",
                            borderColor: alpha(tokens.white, 0.14),
                          }}
                        />
                      ) : null}
                    </>
                  )}
                </Button>
              );

              return (
                <Box key={item.href}>
                  {compact ? (
                    <Tooltip title={item.label} placement="right">
                      {itemButton}
                    </Tooltip>
                  ) : (
                    itemButton
                  )}
                </Box>
              );
            })}
          </Stack>
        </Collapse>
      </Box>
    );
  };

  const renderRailContent = ({ inDrawer = false }: { inDrawer?: boolean }) => {
    const compact = collapsed && !inDrawer;

    return (
      <Stack
        spacing={{ xs: 1.2, lg: 1.6 }}
        sx={{
          minHeight: inDrawer ? "100dvh" : "100%",
          width: "100%",
          p: compact ? 1 : { xs: 1.25, sm: 1.5 },
          pb: inDrawer
            ? "calc(16px + env(safe-area-inset-bottom))"
            : compact
              ? 1
              : { xs: 1.25, sm: 1.5 },
        }}
      >
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            p: compact ? 0.75 : 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.gold, 0.22),
            borderRadius: 2.5,
            color: tokens.white,
            backgroundColor: alpha(tokens.white, 0.05),
            backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${alpha(tokens.gold, 0.16)} 0%, transparent 44%), linear-gradient(150deg, ${alpha(tokens.burgundy, 0.5)} 0%, ${alpha(tokens.ink, 0)} 62%)`,
            backdropFilter: "blur(14px)",
            boxShadow: `0 18px 44px ${alpha(tokens.ink, 0.42)}, inset 0 1px 0 ${alpha(tokens.white, 0.12)}`,
            "&::before": {
              content: '""',
              position: "absolute",
              insetInline: 14,
              top: 0,
              height: "1px",
              background: `linear-gradient(90deg, transparent, ${alpha(tokens.gold, 0.7)}, transparent)`,
            },
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              alignItems: "center",
              justifyContent: compact ? "center" : "space-between",
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: compact ? 44 : 48,
                  height: compact ? 44 : 48,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  color: tokens.white,
                  backgroundImage: `linear-gradient(155deg, ${tokens.burgundy} 0%, ${tokens.charcoal} 100%)`,
                  border: `1px solid ${alpha(tokens.gold, 0.5)}`,
                  boxShadow: `0 14px 30px ${alpha(tokens.burgundy, 0.5)}, inset 0 1px 0 ${alpha(tokens.white, 0.22)}`,
                }}
              >
                <Typography
                  component="span"
                  aria-hidden
                  sx={{
                    fontFamily: '"DM Serif Display", serif',
                    fontSize: 24,
                    lineHeight: 1,
                    mt: "2px",
                  }}
                >
                  {(profile.name?.trim()?.[0] ?? "X").toUpperCase()}
                </Typography>
                <StorefrontRounded
                  sx={{
                    position: "absolute",
                    right: -6,
                    bottom: -6,
                    fontSize: 17,
                    p: "2px",
                    borderRadius: "50%",
                    color: tokens.charcoal,
                    bgcolor: tokens.gold,
                    boxShadow: `0 4px 10px ${alpha(tokens.ink, 0.5)}`,
                  }}
                />
              </Box>
              {!compact ? (
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: '"DM Serif Display", serif',
                      fontSize: 19,
                      lineHeight: 1.15,
                      color: tokens.white,
                    }}
                    noWrap
                  >
                    {profile.name}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center", mt: 0.25, minWidth: 0 }}
                  >
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: 0,
                        textTransform: "uppercase",
                        color: tokens.gold,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {profile.plan} plan
                    </Typography>
                    <Box
                      sx={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        bgcolor: "rgba(var(--surface-rgb), 0.4)",
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: alpha(tokens.white, 0.62),
                      }}
                      noWrap
                    >
                      {profile.handle}
                    </Typography>
                  </Stack>
                </Box>
              ) : null}
            </Stack>
            {inDrawer ? (
              <IconButton
                aria-label="Close navigation"
                onClick={onCloseMobile}
                sx={{
                  color: tokens.white,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.14),
                  bgcolor: "rgba(var(--surface-rgb), 0.06)",
                  flexShrink: 0,
                }}
              >
                <CloseRounded />
              </IconButton>
            ) : null}
          </Stack>
          {!compact ? (
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.75 }}
            >
              <Chip
                size="small"
                icon={
                  verified ? <VerifiedUserRounded /> : <WarningAmberRounded />
                }
                label={verified ? "Verified" : "Needs review"}
                sx={{
                  height: 26,
                  fontWeight: 700,
                  color: tokens.white,
                  borderRadius: 1.5,
                  bgcolor: alpha(
                    verified ? tokens.success : tokens.warning,
                    0.16,
                  ),
                  border: "1px solid",
                  borderColor: alpha(
                    verified ? tokens.success : tokens.warning,
                    0.5,
                  ),
                  "& .MuiChip-label": { px: 1 },
                  "& .MuiChip-icon": {
                    fontSize: 15,
                    color: verified ? tokens.success : tokens.gold,
                  },
                }}
              />
              <Chip
                size="small"
                label={roleLabel(currentUser.role)}
                sx={{
                  height: 26,
                  fontWeight: 700,
                  color: tokens.white,
                  borderRadius: 1.5,
                  backgroundImage: `linear-gradient(135deg, ${alpha(roleTone(currentUser.role), 0.34)}, ${alpha(roleTone(currentUser.role), 0.14)})`,
                  border: "1px solid",
                  borderColor: alpha(roleTone(currentUser.role), 0.5),
                  "& .MuiChip-label": { px: 1 },
                }}
              />
            </Stack>
          ) : null}
        </Box>

        <Box
          sx={{
            flex: inDrawer ? "0 0 auto" : 1,
            minHeight: inDrawer ? "auto" : 0,
          }}
        >
          <Stack spacing={0.85} sx={{ display: "grid" }}>
            {/* Overview renders solo at the top (no group header); the rest of
                the groups flow in order with Command last, no longer pinned. */}
            {workspaceGroups.map((group) =>
              renderWorkspaceGroup(
                group,
                inDrawer,
                compact,
                "main",
                group.id === "overview",
              ),
            )}
          </Stack>
        </Box>

        <Box sx={{ mt: "auto" }}>
          {compact ? (
            <Tooltip title="View storefront" placement="right">
              <IconButton
                component={MuiLink}
                href={storefrontURL}
                target="_blank"
                rel="noreferrer"
                aria-label="View storefront"
                sx={{
                  width: "100%",
                  height: 48,
                  color: tokens.white,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.16),
                  bgcolor: alpha(tokens.burgundy, 0.72),
                  borderRadius: 1.5,
                  "&:hover": { bgcolor: alpha(tokens.burgundy, 0.82) },
                }}
              >
                <VisibilityRounded />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              component={MuiLink}
              href={storefrontURL}
              target="_blank"
              rel="noreferrer"
              variant="contained"
              startIcon={<VisibilityRounded />}
              fullWidth
              sx={{
                bgcolor: tokens.burgundy,
                color: tokens.white,
                "&:hover": { bgcolor: alpha(tokens.burgundy, 0.82) },
              }}
            >
              View storefront
            </Button>
          )}
          <Form method="post">
            <input type="hidden" name="intent" value="logout" />
            {compact ? (
              <Tooltip title="Log out" placement="right">
                <IconButton
                  type="submit"
                  aria-label="Log out"
                  sx={{
                    mt: 1,
                    width: "100%",
                    height: 48,
                    color: tokens.white,
                    border: "1px solid",
                    borderColor: alpha(tokens.white, 0.16),
                    bgcolor: "rgba(var(--surface-rgb), 0.06)",
                    borderRadius: 1.5,
                    "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
                  }}
                >
                  <LogoutRounded />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                type="submit"
                color="inherit"
                startIcon={<LogoutRounded />}
                fullWidth
                sx={{
                  mt: 1,
                  color: tokens.white,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.16),
                  bgcolor: "rgba(var(--surface-rgb), 0.06)",
                  "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
                }}
              >
                Log out
              </Button>
            )}
          </Form>
        </Box>
      </Stack>
    );
  };

  return (
    <>
      <Panel
        sx={{
          ...railSurfaceSx,
          display: { xs: "none", md: "block" },
          p: 0,
          position: "fixed",
          top: { md: 16, lg: 24 },
          bottom: { md: 16, lg: 24 },
          left: { md: 16, lg: 24 },
          width: collapsed ? dashboardRailCollapsedWidth : dashboardRailWidth,
          zIndex: 18,
          overflowX: "hidden",
          overflowY: "auto",
          backdropFilter: "blur(14px)",
          borderColor: alpha(tokens.white, 0.12),
          boxShadow: `18px 0 60px ${alpha(tokens.ink, 0.18)}`,
          transition: "width 220ms ease",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "dashboardRailSlide 520ms cubic-bezier(.2,.8,.2,1) both",
          },
        }}
      >
        {renderRailContent({})}
      </Panel>
      <Drawer
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              ...railSurfaceSx,
              width: { xs: "min(90vw, 332px)", sm: 340 },
              maxWidth: "calc(100vw - 20px)",
              height: "100dvh",
              maxHeight: "100dvh",
              display: "block",
              borderRight: "1px solid",
              borderColor: alpha(tokens.white, 0.12),
              overflowX: "hidden",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorY: "contain",
              scrollbarWidth: "thin",
              scrollbarColor: `${alpha(tokens.white, 0.34)} transparent`,
              "&::-webkit-scrollbar": {
                display: "block",
                width: 8,
              },
              "&::-webkit-scrollbar-thumb": {
                borderRadius: 999,
                bgcolor: "rgba(var(--surface-rgb), 0.28)",
              },
            },
          },
        }}
      >
        {renderRailContent({ inDrawer: true })}
      </Drawer>
    </>
  );
}

function WorkspaceTopBar({
  profile,
  currentUser,
  meta,
  verified,
  collapsed,
  darkChrome,
  notificationCount,
  storefrontURL,
  onOpenMobileNav,
  onToggleCollapsed,
  onToggleDarkChrome,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  meta: DashboardPageMeta;
  verified: boolean;
  collapsed: boolean;
  darkChrome: boolean;
  notificationCount: number;
  storefrontURL: string;
  onOpenMobileNav: () => void;
  onToggleCollapsed: () => void;
  onToggleDarkChrome: () => void;
}) {
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const profileOpen = Boolean(profileAnchor);
  const closeProfileMenu = () => setProfileAnchor(null);
  const avatarLabel = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Box
      sx={{
        px: { xs: 1.75, sm: 2.5, md: 4 },
        py: { xs: 1, sm: 1.25 },
        // A floating pill rather than a flush edge-to-edge bar: rounded all
        // round, lifted off the window edges, full border (not just a bottom
        // rule). Padding is kept.
        mx: { xs: 1, sm: 1.5, md: 2 },
        mt: { xs: 1, sm: 1.5 },
        borderRadius: 999,
        border: "1px solid",
        borderColor: darkChrome
          ? alpha(tokens.white, 0.12)
          : alpha(tokens.ink, 0.09),
        bgcolor: darkChrome
          ? alpha(tokens.charcoal, 0.94)
          : alpha(tokens.white, 0.86),
        color: darkChrome ? tokens.white : tokens.ink,
        backgroundImage: darkChrome
          ? `linear-gradient(90deg, ${alpha(tokens.burgundy, 0.24)}, ${alpha(tokens.charcoal, 0.94)})`
          : `linear-gradient(90deg, rgba(var(--surface-rgb), 0.96), rgba(var(--surface-rgb), 0.74))`,
        boxShadow: darkChrome
          ? `0 18px 40px ${alpha(tokens.ink, 0.5)}`
          : `0 18px 40px ${alpha(tokens.ink, 0.1)}`,
        position: "sticky",
        top: { xs: 8, sm: 12 },
        zIndex: 16,
        backdropFilter: "blur(14px)",
        maxWidth: "100%",
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: 0.75, sm: 1.25 }}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: { xs: 52, sm: 58 },
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={{ xs: 0.75, sm: 1 }}
          sx={{ alignItems: "center", minWidth: 0, flex: "1 1 auto" }}
        >
          <Tooltip title="Open navigation">
            <IconButton
              aria-label="Open navigation"
              onClick={onOpenMobileNav}
              sx={{
                display: { xs: "inline-flex", md: "none" },
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                color: "inherit",
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              <MenuRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <IconButton
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapsed}
              sx={{
                display: { xs: "none", md: "inline-flex" },
                color: "inherit",
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              {collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}
            </IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
            <Typography
              variant="overline"
              sx={{
                color: darkChrome ? alpha(tokens.white, 0.68) : "primary.main",
                fontWeight: 900,
                display: { xs: "none", sm: "block" },
              }}
            >
              {profile.handle}.xtiitch.com
            </Typography>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                lineHeight: 1.05,
                fontSize: { xs: "1.3rem", sm: "1.55rem" },
              }}
              noWrap
            >
              {meta.title}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={{ xs: 0.5, sm: 0.75 }}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          <Tooltip title="Messages">
            <IconButton
              component={RouterLink}
              to="/dashboard/messages"
              aria-label="Open messages"
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              <Badge badgeContent={notificationCount} color="error" max={99}>
                <NotificationsRounded />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={darkChrome ? "Use light theme" : "Use dark theme"}>
            <IconButton
              aria-label="Toggle theme"
              onClick={onToggleDarkChrome}
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
              }}
            >
              {darkChrome ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Profile and settings">
            <IconButton
              aria-label="Open profile menu"
              onClick={(event) => setProfileAnchor(event.currentTarget)}
              sx={{
                color: "inherit",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                border: "1px solid",
                borderColor: darkChrome
                  ? alpha(tokens.white, 0.16)
                  : alpha(tokens.ink, 0.1),
                p: 0.45,
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: darkChrome
                    ? alpha(tokens.white, 0.14)
                    : alpha(tokens.burgundy, 0.12),
                  color: darkChrome ? tokens.white : tokens.burgundy,
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                {avatarLabel || "X"}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={profileAnchor}
            open={profileOpen}
            onClose={closeProfileMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: { xs: "calc(100vw - 32px)", sm: 250 },
                  maxWidth: "calc(100vw - 32px)",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: alpha(tokens.ink, 0.1),
                  boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.16)}`,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.4 }}>
              <Typography sx={{ fontWeight: 900 }} noWrap>
                {profile.name}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                {roleLabel(currentUser.role)} ·{" "}
                {verified ? "Verified store" : "Verification needed"}
              </Typography>
            </Box>
            <Divider />
            <MenuItem
              component={RouterLink}
              to="/dashboard/settings"
              onClick={closeProfileMenu}
            >
              <SettingsRounded sx={{ mr: 1.25 }} fontSize="small" />
              Store settings
            </MenuItem>
            <MenuItem
              component={RouterLink}
              to="/dashboard/team"
              onClick={closeProfileMenu}
            >
              <PeopleAltRounded sx={{ mr: 1.25 }} fontSize="small" />
              Team access
            </MenuItem>
            <MenuItem
              component={RouterLink}
              to="/dashboard/messages"
              onClick={closeProfileMenu}
            >
              <NotificationsRounded sx={{ mr: 1.25 }} fontSize="small" />
              Messages
            </MenuItem>
            <MenuItem
              component={MuiLink}
              href={storefrontURL}
              target="_blank"
              rel="noreferrer"
              onClick={closeProfileMenu}
            >
              <VisibilityRounded sx={{ mr: 1.25 }} fontSize="small" />
              View storefront
            </MenuItem>
            <Divider />
            <Form method="post">
              <input type="hidden" name="intent" value="logout" />
              <MenuItem
                component="button"
                type="submit"
                sx={{ width: "100%", color: tokens.danger }}
              >
                <LogoutRounded sx={{ mr: 1.25 }} fontSize="small" />
                Log out
              </MenuItem>
            </Form>
          </Menu>
        </Stack>
      </Stack>
    </Box>
  );
}

function WorkspaceHeader({
  meta,
  canManage,
  currentUser,
  verified,
  moneySummary,
  liveOrders,
  activeBookings,
  availabilityWindows,
  pendingPayments,
  needsMeasurements,
  openHandovers,
  pendingMessages,
}: {
  meta: DashboardPageMeta;
  canManage: boolean;
  currentUser: CurrentUser;
  verified: boolean;
  moneySummary: MoneySummary;
  liveOrders: OrderSummary[];
  activeBookings: number;
  availabilityWindows: AvailabilityWindow[];
  pendingPayments: number;
  needsMeasurements: number;
  openHandovers: number;
  pendingMessages: number;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2.25, md: 3 },
        mb: 2.5,
        position: "relative",
        bgcolor: tokens.charcoal,
        color: "common.white",
        borderColor: alpha(tokens.ink, 0.1),
        backgroundImage: `linear-gradient(135deg, ${alpha(meta.tone, 0.32)}, transparent 44%), linear-gradient(180deg, ${alpha(tokens.white, 0.08)}, transparent)`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          right: { xs: -38, md: -18 },
          top: { xs: -34, md: -42 },
          color: alpha(tokens.white, 0.075),
          transform: "rotate(-10deg)",
          "& .MuiSvgIcon-root": {
            fontSize: { xs: 150, md: 210 },
          },
        }}
      >
        {meta.icon}
      </Box>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2.5}
        sx={{
          position: "relative",
          justifyContent: "space-between",
          alignItems: { xs: "stretch", lg: "flex-end" },
        }}
      >
        <Box sx={{ maxWidth: 800 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
            <Chip
              size="small"
              label={`${roleLabel(currentUser.role)} access`}
              sx={{
                color: "common.white",
                bgcolor: "rgba(var(--surface-rgb), 0.12)",
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.18),
              }}
            />
            <Chip
              size="small"
              label={verified ? "Verified store" : "Verification needed"}
              sx={{
                color: "common.white",
                bgcolor: alpha(
                  verified ? tokens.success : tokens.warning,
                  0.28,
                ),
                border: "1px solid",
                borderColor: alpha(
                  verified ? tokens.success : tokens.warning,
                  0.48,
                ),
              }}
            />
          </Stack>
          <Typography
            variant="overline"
            sx={{ color: alpha(tokens.white, 0.68), fontWeight: 900 }}
          >
            {meta.eyebrow}
          </Typography>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              mt: 0.5,
              maxWidth: 760,
              fontSize: { xs: "2rem", md: "2.55rem" },
              lineHeight: 1.04,
            }}
          >
            {meta.title}
          </Typography>
          <Typography
            sx={{
              mt: 1.25,
              color: alpha(tokens.white, 0.72),
              maxWidth: 700,
            }}
          >
            {meta.helper}
          </Typography>
          <PriorityRibbon
            canManage={canManage}
            pendingPayments={pendingPayments}
            needsMeasurements={needsMeasurements}
            activeBookings={activeBookings}
            openHandovers={openHandovers}
            pendingMessages={pendingMessages}
          />
        </Box>
        <Box
          sx={{
            minWidth: { lg: 360 },
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr" },
          }}
        >
          <HeaderSignal
            icon={
              canManage ? <AccountBalanceWalletRounded /> : <TimelineRounded />
            }
            tone={canManage ? tokens.gold : tokens.info}
            title={
              canManage
                ? formatGHS(moneySummary.net_income_minor)
                : `${liveOrders.length} live orders`
            }
            helper={
              canManage
                ? `${pendingPayments} payment follow-ups`
                : `${needsMeasurements} measurement captures`
            }
          />
          <HeaderSignal
            icon={<EventAvailableRounded />}
            tone={tokens.info}
            title={`${activeBookings} active visits`}
            helper={`${availabilityWindows.length} windows · ${openHandovers} handovers`}
          />
        </Box>
      </Stack>
    </Panel>
  );
}

function HeaderSignal({
  icon,
  tone,
  title,
  helper,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  helper: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        p: 1.35,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(tokens.white, 0.15),
        bgcolor: "rgba(var(--surface-rgb), 0.085)",
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          color: tone,
          bgcolor: alpha(tone, 0.18),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 900,
            color: "common.white",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: alpha(tokens.white, 0.68), overflowWrap: "anywhere" }}
        >
          {helper}
        </Typography>
      </Box>
    </Stack>
  );
}

function PriorityRibbon({
  canManage,
  pendingPayments,
  needsMeasurements,
  activeBookings,
  openHandovers,
  pendingMessages,
}: {
  canManage: boolean;
  pendingPayments: number;
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  pendingMessages: number;
}) {
  const items: PriorityRibbonItem[] = [
    ...(canManage
      ? [
          {
            label: "Draft pay",
            value: pendingPayments,
            href: "/dashboard/orders?orders=draft",
            icon: <ReceiptLongRounded fontSize="small" />,
            tone: tokens.warning,
          },
        ]
      : []),
    {
      label: "Measurements",
      value: needsMeasurements,
      href: "/dashboard/orders?orders=confirmed",
      icon: <StraightenRounded fontSize="small" />,
      tone: tokens.burgundy,
    },
    {
      label: "Visits",
      value: activeBookings,
      href: "/dashboard/visits",
      icon: <CalendarMonthRounded fontSize="small" />,
      tone: tokens.info,
    },
    {
      label: "Handovers",
      value: openHandovers,
      href: "/dashboard/handovers",
      icon: <LocalShippingRounded fontSize="small" />,
      tone: tokens.warning,
    },
    {
      label: "Messages",
      value: pendingMessages,
      href: "/dashboard/messages",
      icon: <NotificationsRounded fontSize="small" />,
      tone: tokens.success,
    },
  ];

  return (
    <Box
      sx={{
        mt: 2.25,
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
      }}
    >
      {items.map((item) => {
        const needsAction = item.value > 0;
        return (
          <Button
            key={item.href}
            component={RouterLink}
            to={item.href}
            aria-label={`${item.label}: ${item.value}`}
            sx={{
              flex: { xs: "1 1 calc(50% - 8px)", sm: "0 0 auto" },
              minHeight: 42,
              minWidth: 0,
              pl: 1,
              pr: 0.75,
              py: 0.6,
              borderRadius: 999,
              justifyContent: "flex-start",
              textTransform: "none",
              color: tokens.white,
              border: "1px solid",
              borderColor: needsAction
                ? alpha(item.tone, 0.5)
                : alpha(tokens.white, 0.12),
              bgcolor: needsAction
                ? alpha(item.tone, 0.16)
                : alpha(tokens.white, 0.05),
              transition:
                "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
              "&:hover": {
                bgcolor: alpha(item.tone, 0.26),
                borderColor: alpha(item.tone, 0.55),
                transform: "translateY(-1px)",
              },
            }}
          >
            <Stack
              direction="row"
              spacing={0.85}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              <Box
                component="span"
                sx={{
                  color: item.tone,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Typography
                component="span"
                sx={{
                  fontSize: 13,
                  fontWeight: 750,
                  letterSpacing: "0.01em",
                  color: alpha(tokens.white, 0.92),
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </Typography>
              <Box
                component="span"
                sx={{
                  ml: 0.25,
                  minWidth: 22,
                  height: 22,
                  px: 0.5,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 900,
                  flexShrink: 0,
                  color: needsAction ? tokens.white : alpha(tokens.white, 0.5),
                  bgcolor: needsAction ? item.tone : alpha(tokens.white, 0.1),
                }}
              >
                {item.value}
              </Box>
            </Stack>
          </Button>
        );
      })}
    </Box>
  );
}

function ManagementOverviewPanel({ rooms }: { rooms: OverviewRoom[] }) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.065)}, transparent 44%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.7))`,
      }}
    >
      <SectionHeader
        eyebrow="Overview"
        title="Choose the right workspace"
        helper="Start with the room that matches the work in front of you, from production to money to customer follow-up."
      />
      <Box
        sx={{
          mt: 2,
          display: "grid",
          gap: 1.4,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        {rooms.map((room) => (
          <MuiLink
            key={room.href}
            component={RouterLink}
            to={room.href}
            underline="none"
            aria-label={`${room.actionLabel}: ${room.title}`}
            sx={{
              p: 1.65,
              border: "1px solid",
              borderColor: alpha(room.tone, 0.2),
              borderRadius: 2,
              bgcolor: "rgba(var(--surface-rgb), 0.78)",
              backgroundImage: `linear-gradient(135deg, ${alpha(room.tone, 0.08)}, transparent 48%)`,
              color: "text.primary",
              minWidth: 0,
              display: "grid",
              gap: 1.25,
              position: "relative",
              overflow: "hidden",
              textDecoration: "none",
              boxShadow: `0 14px 34px ${alpha(tokens.ink, 0.045)}`,
              transition:
                "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
              "&::after": {
                content: '""',
                position: "absolute",
                right: -28,
                bottom: -34,
                width: 94,
                height: 94,
                borderRadius: "50%",
                bgcolor: alpha(room.tone, 0.055),
                border: `1px solid ${alpha(room.tone, 0.12)}`,
              },
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: alpha(room.tone, 0.34),
                boxShadow: `0 22px 50px ${alpha(tokens.ink, 0.075)}`,
                "& .workspace-arrow": { transform: "translateX(2px)" },
              },
              "&:focus-visible": {
                outline: `3px solid ${alpha(room.tone, 0.32)}`,
                outlineOffset: 3,
              },
            }}
          >
            <Stack
              direction="row"
              spacing={1.35}
              sx={{ alignItems: "flex-start", minWidth: 0 }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 1.5,
                  display: "grid",
                  placeItems: "center",
                  color: room.tone,
                  bgcolor: alpha(room.tone, 0.1),
                  border: "1px solid",
                  borderColor: alpha(room.tone, 0.18),
                  boxShadow: `0 12px 26px ${alpha(room.tone, 0.08)}`,
                  flexShrink: 0,
                }}
              >
                {room.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 900 }}>{room.title}</Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.4, color: "text.secondary" }}
                >
                  {room.helper}
                </Typography>
              </Box>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <ToneChip label={room.value} tone={room.tone} />
              <Box
                sx={{
                  minHeight: 34,
                  px: 1.15,
                  borderRadius: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  border: "1px solid",
                  bgcolor: "rgba(var(--surface-rgb), 0.72)",
                  borderColor: alpha(room.tone, 0.2),
                  color: room.tone,
                  fontSize: 13,
                  fontWeight: 850,
                  whiteSpace: "nowrap",
                }}
              >
                {room.actionLabel}
                <ArrowForwardRounded
                  className="workspace-arrow"
                  sx={{ fontSize: 17, transition: "transform 180ms ease" }}
                />
              </Box>
            </Stack>
          </MuiLink>
        ))}
      </Box>
    </Panel>
  );
}

function StoreReadinessPanel({
  steps,
  storefrontURL,
}: {
  steps: SetupStep[];
  storefrontURL: string;
}) {
  const completed = steps.filter((step) => step.done).length;
  const progress = steps.length === 0 ? 0 : (completed / steps.length) * 100;

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.info, 0.075)}, transparent 48%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.74))`,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { xs: "stretch", sm: "flex-start" },
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <VerifiedUserRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Store readiness</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              The essentials that make the storefront workable for customers and
              staff.
            </Typography>
          </Box>
        </Stack>
        <ToneChip
          label={`${completed}/${steps.length} ready`}
          tone={completed === steps.length ? tokens.success : tokens.warning}
        />
      </Stack>

      <Box
        aria-hidden
        sx={{
          mt: 2,
          height: 9,
          borderRadius: 999,
          bgcolor: alpha(tokens.ink, 0.08),
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 999,
            bgcolor: completed === steps.length ? tokens.success : tokens.gold,
            transition: "width 180ms ease",
          }}
        />
      </Box>

      <Stack spacing={1} sx={{ mt: 1.75 }}>
        {steps.map((step) => (
          <MuiLink
            key={step.label}
            component={RouterLink}
            to={step.href}
            underline="none"
            sx={{
              p: 1.25,
              display: "grid",
              gap: 1,
              gridTemplateColumns: "32px minmax(0, 1fr) auto",
              alignItems: "center",
              border: "1px solid",
              borderColor: step.done
                ? alpha(tokens.success, 0.22)
                : alpha(tokens.warning, 0.22),
              borderRadius: 2,
              color: "text.primary",
              bgcolor: step.done
                ? alpha(tokens.success, 0.045)
                : alpha(tokens.white, 0.72),
              "&:hover": {
                bgcolor: step.done
                  ? alpha(tokens.success, 0.075)
                  : alpha(tokens.warning, 0.075),
              },
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                display: "grid",
                placeItems: "center",
                color: step.done ? tokens.success : tokens.warning,
                bgcolor: step.done
                  ? alpha(tokens.success, 0.1)
                  : alpha(tokens.warning, 0.12),
              }}
            >
              {step.done ? <CheckCircleRounded /> : step.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900 }} noWrap>
                {step.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
              >
                {step.helper}
              </Typography>
            </Box>
            <ArrowForwardRounded fontSize="small" />
          </MuiLink>
        ))}
      </Stack>

      <Button
        href={storefrontURL}
        target="_blank"
        rel="noreferrer"
        fullWidth
        variant="outlined"
        startIcon={<StorefrontRounded />}
        sx={{ mt: 1.5 }}
      >
        Open storefront
      </Button>
    </Panel>
  );
}

function TodayFocusPanel({
  pendingPayments,
  needsMeasurements,
  openHandovers,
  pendingMessages,
}: {
  pendingPayments: number;
  needsMeasurements: number;
  openHandovers: number;
  pendingMessages: number;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        bgcolor: tokens.charcoal,
        color: tokens.white,
        position: "relative",
        backgroundImage: `
          linear-gradient(${alpha(tokens.white, 0.045)} 1px, transparent 1px),
          linear-gradient(90deg, ${alpha(tokens.white, 0.045)} 1px, transparent 1px),
          linear-gradient(145deg, ${alpha(tokens.burgundy, 0.42)}, transparent 54%)
        `,
        backgroundSize: "34px 34px, 34px 34px, auto",
      }}
    >
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              color: tokens.white,
              bgcolor: alpha(tokens.burgundy, 0.58),
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.16),
              flexShrink: 0,
            }}
          >
            <TuneRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Today's focus</Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.75, color: alpha(tokens.white, 0.7) }}
            >
              Clear drafts first, capture visit/shop measurements, then close
              finished garments with pickup or delivery handovers. Xtiitch
              records payment state but never holds funds.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <ToneChip
            label={`${pendingPayments} payment follow-ups`}
            tone={tokens.warning}
          />
          <ToneChip
            label={`${needsMeasurements} measurement captures`}
            tone={tokens.info}
          />
          <ToneChip
            label={`${openHandovers} active handovers`}
            tone={tokens.warning}
          />
          <ToneChip
            label={`${pendingMessages} messages pending`}
            tone={tokens.burgundy}
          />
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Button
            component={RouterLink}
            to="/dashboard/orders?orders=draft"
            size="small"
            variant="contained"
            startIcon={<ReceiptLongRounded />}
            sx={{ bgcolor: "rgb(var(--surface-rgb))", color: "text.primary" }}
          >
            Drafts
          </Button>
          <Button
            component={RouterLink}
            to="/dashboard/visits"
            size="small"
            variant="outlined"
            startIcon={<CalendarMonthRounded />}
            sx={{
              color: tokens.white,
              borderColor: alpha(tokens.white, 0.22),
              "&:hover": { borderColor: alpha(tokens.white, 0.34) },
            }}
          >
            Visits
          </Button>
          <Button
            component={RouterLink}
            to="/dashboard/handovers"
            size="small"
            variant="outlined"
            startIcon={<LocalShippingRounded />}
            sx={{
              color: tokens.white,
              borderColor: alpha(tokens.white, 0.22),
              "&:hover": { borderColor: alpha(tokens.white, 0.34) },
            }}
          >
            Handovers
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}

function EmptyState({
  icon,
  title,
  helper,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 3, md: 5 },
        textAlign: "center",
        borderStyle: "dashed",
        borderColor: alpha(tokens.burgundy, 0.25),
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.05)}, transparent 48%)`,
      }}
    >
      <Box
        sx={{
          color: "primary.main",
          mb: 1.25,
          width: 58,
          height: 58,
          mx: "auto",
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(tokens.burgundy, 0.08),
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.16),
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      <Typography
        variant="body2"
        sx={{ mt: 0.5, color: "text.secondary", maxWidth: 420, mx: "auto" }}
      >
        {helper}
      </Typography>
    </Panel>
  );
}

function OrderCard({
  order,
  returnTo,
  measurementFields,
  showMoneyDetails,
}: {
  order: OrderSummary;
  returnTo: string;
  measurementFields: MeasurementField[];
  showMoneyDetails: boolean;
}) {
  const colour = stageColor(order.colour);
  const payTone = paymentTone(order);
  const canAdvance = order.status === "confirmed";
  const measurementSource = measurementSourceFor(order);
  const showMeasurementCapture = Boolean(measurementSource);
  const targetMinor = orderTargetMinor(order);
  const balanceDueMinor = orderBalanceDueMinor(order);
  const canCollectBalance =
    showMoneyDetails &&
    balanceDueMinor > 0 &&
    ["confirmed", "fulfilled"].includes(order.status);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [measurementsOpen, setMeasurementsOpen] = useState(false);

  return (
    <Panel
      id={`order-${order.order_id}`}
      sx={{ height: "100%", p: { xs: 2, md: 2.5 } }}
    >
      <Stack spacing={2.25}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                bgcolor: alpha(colour, 0.1),
                color: colour,
                fontWeight: 800,
              }}
            >
              {orderInitials(order)}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", mb: 0.75 }}
              >
                <ToneChip
                  label={order.order_type === "custom" ? "Custom" : "Standard"}
                  tone={tokens.burgundy}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={order.channel === "walk_in" ? "Walk-in" : "Online"}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={orderRouteLabel(order)}
                />
              </Stack>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                {order.design_title}
              </Typography>
              <Typography sx={{ mt: 0.65, color: "text.secondary" }}>
                {order.customer_name || "Unnamed customer"}{" "}
                {shortDate(order.created_at)
                  ? `· ${shortDate(order.created_at)}`
                  : ""}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              minWidth: { xs: "100%", md: 235 },
              border: "1px solid",
              borderColor: alpha(colour, 0.28),
              borderRadius: 2,
              p: 1.5,
              bgcolor: alpha(colour, 0.08),
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: colour,
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ fontWeight: 800 }}>
                {order.stage_name || statusLabel(order.status)}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 0.75, color: "text.secondary" }}
            >
              {statusLabel(order.status)}
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <InfoStrip
            icon={<PaymentsRounded />}
            tone={payTone}
            title={paymentLabel(order)}
            helper={
              showMoneyDetails
                ? moneyProgress(order)
                : "Payment detail visible to owners and admins"
            }
          />
          <InfoStrip
            icon={<PhoneRounded />}
            tone={tokens.info}
            title={order.customer_phone || "No phone captured"}
            helper={order.customer_email || "No email captured"}
          />
        </Box>

        {showMoneyDetails ? (
          <Box
            sx={{
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.14),
              borderRadius: 2,
              p: 1.25,
              bgcolor: "rgba(var(--surface-rgb), 0.72)",
              backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.055)}, transparent 48%)`,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                alignItems: { xs: "stretch", sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900 }}>
                  Payment controls
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Agreed total{" "}
                  {targetMinor === null ? "Not set" : formatGHS(targetMinor)} ·
                  Balance {formatGHS(balanceDueMinor)}
                </Typography>
              </Box>
              <Button
                type="button"
                variant="outlined"
                startIcon={<PaymentsRounded />}
                onClick={() => setPaymentOpen(true)}
              >
                Manage payment
              </Button>
            </Stack>
            <Dialog
              open={paymentOpen}
              onClose={() => setPaymentOpen(false)}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle sx={{ pb: 0.5 }}>
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      component="span"
                      sx={{ display: "block", fontWeight: 950 }}
                    >
                      Payment controls
                    </Typography>
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ display: "block", color: "text.secondary" }}
                    >
                      {order.design_title} · {order.customer_name || "Customer"}
                    </Typography>
                  </Box>
                  <IconButton
                    aria-label="Close"
                    onClick={() => setPaymentOpen(false)}
                  >
                    <CloseRounded />
                  </IconButton>
                </Stack>
              </DialogTitle>
              <DialogContent dividers>
                <Stack spacing={2.25}>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="set_agreed_total"
                    />
                    <input
                      type="hidden"
                      name="order_id"
                      value={order.order_id}
                    />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Stack spacing={1.25}>
                      <Typography sx={{ fontWeight: 900 }}>
                        Agreed total
                      </Typography>
                      <TextField
                        name="agreed_total_ghs"
                        label="Agreed total"
                        size="small"
                        defaultValue={moneyInputValue(targetMinor)}
                        fullWidth
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                GHS
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { inputMode: "decimal" },
                        }}
                      />
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          type="submit"
                          variant="outlined"
                          startIcon={<SaveRounded />}
                        >
                          Save total
                        </Button>
                      </Stack>
                    </Stack>
                  </Form>
                  <Divider />
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="collect_balance"
                    />
                    <input
                      type="hidden"
                      name="order_id"
                      value={order.order_id}
                    />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Stack spacing={1.25}>
                      <Typography sx={{ fontWeight: 900 }}>
                        Collect balance
                      </Typography>
                      <TextField
                        name="method"
                        label="Balance method"
                        select
                        size="small"
                        defaultValue="momo"
                        disabled={!canCollectBalance}
                        fullWidth
                      >
                        <MenuItem value="momo">Mobile money</MenuItem>
                        <MenuItem value="card">Card</MenuItem>
                      </TextField>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ justifyContent: "flex-end" }}
                      >
                        <Button
                          type="submit"
                          variant="contained"
                          disabled={!canCollectBalance}
                          startIcon={<PaymentsRounded />}
                        >
                          {balanceDueMinor > 0
                            ? `Collect ${formatGHS(balanceDueMinor)}`
                            : "Paid"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Form>
                </Stack>
              </DialogContent>
            </Dialog>
          </Box>
        ) : null}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Ref {order.order_id.slice(0, 8)}
          </Typography>
          <Form method="post">
            <input type="hidden" name="intent" value="advance" />
            <input type="hidden" name="order_id" value={order.order_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <Button
              type="submit"
              variant={canAdvance ? "contained" : "outlined"}
              disabled={!canAdvance}
              endIcon={<ArrowForwardRounded />}
              fullWidth
            >
              {canAdvance ? "Advance stage" : statusLabel(order.status)}
            </Button>
          </Form>
        </Stack>

        {showMeasurementCapture ? (
          <Box
            sx={{
              borderTop: "1px solid",
              borderColor: "divider",
              pt: 2,
            }}
          >
            {measurementFields.length === 0 ? (
              <Alert severity="info" icon={<StraightenRounded />}>
                Add measurement fields before recording this{" "}
                {orderRouteLabel(order).toLowerCase()} order.
              </Alert>
            ) : (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    {measurementSource === "visit"
                      ? "Visit measurements"
                      : "Shop measurements"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {measurementFields.length} configured fields
                  </Typography>
                </Box>
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<StraightenRounded />}
                  onClick={() => setMeasurementsOpen(true)}
                >
                  Record measurements
                </Button>
                <Dialog
                  open={measurementsOpen}
                  onClose={() => setMeasurementsOpen(false)}
                  fullWidth
                  maxWidth="sm"
                >
                  <DialogTitle sx={{ pb: 0.5 }}>
                    <Stack
                      direction="row"
                      spacing={1.25}
                      sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          component="span"
                          sx={{ display: "block", fontWeight: 950 }}
                        >
                          {measurementSource === "visit"
                            ? "Visit measurements"
                            : "Shop measurements"}
                        </Typography>
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{ display: "block", color: "text.secondary" }}
                        >
                          {order.design_title} ·{" "}
                          {order.customer_name || "Customer"}
                        </Typography>
                      </Box>
                      <IconButton
                        aria-label="Close"
                        onClick={() => setMeasurementsOpen(false)}
                      >
                        <CloseRounded />
                      </IconButton>
                    </Stack>
                  </DialogTitle>
                  <DialogContent dividers>
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="record_measurements"
                      />
                      <input
                        type="hidden"
                        name="order_id"
                        value={order.order_id}
                      />
                      <input
                        type="hidden"
                        name="source"
                        value={measurementSource ?? ""}
                      />
                      <input
                        type="hidden"
                        name="return_to"
                        value={`/dashboard/orders?orders=${order.order_type}`}
                      />
                      <Stack spacing={2}>
                        <Box
                          sx={{
                            display: "grid",
                            gap: 1.25,
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "repeat(2, minmax(0, 1fr))",
                            },
                          }}
                        >
                          {measurementFields.map((field) => (
                            <TextField
                              key={field.field_id}
                              name={`measurement_${field.field_id}`}
                              label={`${field.label} (${field.unit})`}
                              size="small"
                              slotProps={{
                                htmlInput: { inputMode: "decimal" },
                              }}
                            />
                          ))}
                        </Box>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          sx={{ justifyContent: "flex-end" }}
                        >
                          <Button
                            type="button"
                            variant="outlined"
                            onClick={() => setMeasurementsOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="contained"
                            startIcon={<SaveRounded />}
                          >
                            Save measurements
                          </Button>
                        </Stack>
                      </Stack>
                    </Form>
                  </DialogContent>
                </Dialog>
              </Stack>
            )}
          </Box>
        ) : null}
      </Stack>
    </Panel>
  );
}

function InfoStrip({
  icon,
  tone,
  title,
  helper,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  helper: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        p: 1.35,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(tone, 0.18),
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tone, 0.075)}, transparent 52%)`,
        minWidth: 0,
        boxShadow: `0 10px 26px ${alpha(tokens.ink, 0.04)}`,
      }}
    >
      <Box
        sx={{
          color: tone,
          width: 34,
          height: 34,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(tone, 0.1),
          border: "1px solid",
          borderColor: alpha(tone, 0.16),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
        >
          {helper}
        </Typography>
      </Box>
    </Stack>
  );
}

function DesignCard({
  design,
  collections,
  onOpen,
}: {
  design: Design;
  collections: CollectionSummary[];
  onOpen: () => void;
}) {
  const retired = design.status === "retired";
  const image = design.images[0] || fallbackDesignImage(design);
  const collectionName =
    collections.find(
      (collection) => collection.collection_id === design.collection_id,
    )?.name ?? "No collection";
  const lowestPriceMinor = design.prices.reduce<number | null>(
    (lowest, price) =>
      lowest === null ? price.price_minor : Math.min(lowest, price.price_minor),
    null,
  );
  const priceSummary =
    lowestPriceMinor === null
      ? "No prices"
      : design.prices.length === 1
        ? formatGHS(lowestPriceMinor)
        : `From ${formatGHS(lowestPriceMinor)}`;
  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={`Open ${design.title}`}
      sx={{
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        width: "100%",
        minHeight: "100%",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "background.paper",
        opacity: retired ? 0.62 : 1,
        transition:
          "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(tokens.burgundy, 0.3),
          boxShadow: `0 18px 40px ${alpha(tokens.ink, 0.1)}`,
        },
        "&:focus-visible": {
          outline: `2px solid ${tokens.burgundy}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "4 / 3",
          bgcolor: alpha(tokens.burgundy, 0.06),
        }}
      >
        <Box
          component="img"
          src={image}
          alt=""
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            filter: design.images[0] ? "none" : "saturate(0.9) contrast(1.04)",
          }}
        />
        <Box sx={{ position: "absolute", top: 8, left: 8 }}>
          <ToneChip
            label={design.status}
            tone={retired ? tokens.mutedText : tokens.success}
          />
        </Box>
      </Box>
      <Box
        sx={{
          p: 1.5,
          minWidth: 0,
          display: "flex",
          flex: 1,
          flexDirection: "column",
        }}
      >
        <Typography sx={{ fontWeight: 800 }} noWrap>
          {design.title}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block" }}
          noWrap
        >
          {collectionName}
        </Typography>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            mt: "auto",
            pt: 1,
            alignItems: "center",
            flexWrap: "wrap",
            gap: 0.5,
          }}
        >
          <Chip size="small" variant="outlined" label={priceSummary} />
          {design.customisation_allowed ? (
            <Chip size="small" variant="outlined" label="Bespoke" />
          ) : null}
        </Stack>
      </Box>
    </ButtonBase>
  );
}

function DesignRow({
  design,
  collections,
  defaultOpen = false,
}: {
  design: Design;
  collections: CollectionSummary[];
  defaultOpen?: boolean;
}) {
  const retired = design.status === "retired";
  const image = design.images[0] || fallbackDesignImage(design);
  const collectionName =
    collections.find(
      (collection) => collection.collection_id === design.collection_id,
    )?.name ?? "No collection";
  const lowestPriceMinor = design.prices.reduce<number | null>(
    (lowest, price) =>
      lowest === null ? price.price_minor : Math.min(lowest, price.price_minor),
    null,
  );
  const priceSummary =
    lowestPriceMinor === null
      ? "No prices"
      : design.prices.length === 1
        ? formatGHS(lowestPriceMinor)
        : `From ${formatGHS(lowestPriceMinor)}`;
  const [editOpen, setEditOpen] = useState(defaultOpen);
  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(var(--surface-rgb), 0.42)",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "64px minmax(0, 1fr)",
            sm: "72px minmax(0, 1fr) auto",
          },
          alignItems: "center",
          py: 1.5,
          px: { xs: 2, md: 2.5 },
          "&:hover": { bgcolor: alpha(tokens.burgundy, 0.035) },
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 58,
            height: 74,
            borderRadius: 1.5,
            overflow: "hidden",
            bgcolor: alpha(tokens.burgundy, 0.08),
            color: "primary.main",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Box
            component="img"
            src={image}
            alt=""
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: design.images[0]
                ? "none"
                : "saturate(0.9) contrast(1.04)",
            }}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap>
            {design.title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {design.description || "No description yet"}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 0.85, alignItems: "center", flexWrap: "wrap" }}
          >
            <ToneChip
              label={design.status}
              tone={retired ? tokens.mutedText : tokens.success}
            />
            <Chip size="small" variant="outlined" label={collectionName} />
            <Chip size="small" variant="outlined" label={priceSummary} />
            {design.customisation_allowed ? (
              <Chip size="small" variant="outlined" label="Customisable" />
            ) : null}
          </Stack>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{
            gridColumn: { xs: "1 / -1", sm: "auto" },
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Button
            type="button"
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardRounded fontSize="small" />}
            onClick={() => setEditOpen(true)}
          >
            Edit design
          </Button>
        </Stack>
      </Box>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                sx={{ display: "block", fontWeight: 950 }}
              >
                Edit {design.title}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Update catalogue details, media links, ordering, and visibility.
              </Typography>
            </Box>
            <IconButton aria-label="Close" onClick={() => setEditOpen(false)}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Form method="post">
            <input type="hidden" name="intent" value="update_design" />
            <input type="hidden" name="design_id" value={design.design_id} />
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Design details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "minmax(0, 1fr) minmax(180px, 0.4fr)",
                    },
                  }}
                >
                  <TextField
                    name="title"
                    label="Title"
                    defaultValue={design.title}
                    size="small"
                    required
                  />
                  <TextField
                    name="collection_id"
                    label="Collection"
                    select
                    defaultValue={design.collection_id ?? ""}
                    size="small"
                  >
                    <MenuItem value="">No collection</MenuItem>
                    {collections
                      .filter((collection) => collection.status === "active")
                      .map((collection) => (
                        <MenuItem
                          key={collection.collection_id}
                          value={collection.collection_id}
                        >
                          {collection.name}
                        </MenuItem>
                      ))}
                  </TextField>
                  <TextField
                    name="description"
                    label="Description"
                    defaultValue={design.description}
                    size="small"
                    multiline
                    minRows={2}
                    sx={{ gridColumn: { md: "1 / -1" } }}
                  />
                  <TextField
                    name="image_urls"
                    label="Image URLs"
                    defaultValue={design.images.join("\n")}
                    size="small"
                    multiline
                    minRows={2}
                    placeholder="https://..."
                    helperText="Use one URL per line; the first image becomes the catalogue thumbnail."
                    sx={{ gridColumn: { md: "1 / -1" } }}
                  />
                </Box>
              </Box>
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Pricing & display
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                  }}
                >
                  <TextField
                    name="sequence"
                    label="Display order"
                    type="number"
                    defaultValue={design.sequence}
                    size="small"
                    required
                    slotProps={{ htmlInput: { min: 0 } }}
                  />
                  <TextField
                    name="deposit_ghs"
                    label="Custom deposit"
                    defaultValue={moneyInputValue(
                      design.deposit_override_minor,
                    )}
                    size="small"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">GHS</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: "decimal" },
                    }}
                  />
                </Box>
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    name="customisation"
                    defaultChecked={design.customisation_allowed}
                  />
                }
                label="Allow customisation"
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveRounded />}
                >
                  Save design
                </Button>
              </Stack>
            </Stack>
          </Form>

          <Divider sx={{ my: 2 }} />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Retire hides the piece from customers. Remove deletes it from the
              dashboard list.
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: "flex-end" }}
            >
              <Form method="post">
                <input type="hidden" name="id" value={design.design_id} />
                <input
                  type="hidden"
                  name="intent"
                  value={retired ? "restore" : "retire"}
                />
                <Button
                  type="submit"
                  size="small"
                  variant="outlined"
                  color={retired ? "primary" : "inherit"}
                >
                  {retired ? "Restore" : "Retire"}
                </Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="id" value={design.design_id} />
                <input type="hidden" name="intent" value="delete_design" />
                <Button
                  type="submit"
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineRounded />}
                >
                  Remove
                </Button>
              </Form>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function MeasurementFieldRow({ field }: { field: MeasurementField }) {
  const updateFormID = `measurement-field-update-${field.field_id}`;
  const deleteFormID = `measurement-field-delete-${field.field_id}`;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1fr) 96px 110px 104px",
        },
        alignItems: "center",
        py: 1.5,
        px: { xs: 2, md: 2.5 },
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Form id={updateFormID} method="post" style={{ display: "contents" }}>
        <input type="hidden" name="intent" value="update_measurement_field" />
        <input type="hidden" name="field_id" value={field.field_id} />
        <TextField
          name="label"
          label="Field"
          defaultValue={field.label}
          size="small"
          required
        />
        <TextField
          name="unit"
          label="Unit"
          select
          defaultValue={field.unit}
          size="small"
        >
          {fieldUnits.map((unit) => (
            <MenuItem key={unit.value} value={unit.value}>
              {unit.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="sequence"
          label="Order"
          type="number"
          defaultValue={field.sequence}
          size="small"
          slotProps={{ htmlInput: { min: 0 } }}
          required
        />
      </Form>
      <Form id={deleteFormID} method="post" style={{ display: "contents" }}>
        <input type="hidden" name="intent" value="delete_measurement_field" />
        <input type="hidden" name="field_id" value={field.field_id} />
      </Form>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          gridColumn: { xs: "1 / -1", md: "auto" },
          alignItems: "center",
          justifyContent: { xs: "flex-start", md: "flex-end" },
          minWidth: 0,
          flexWrap: "nowrap",
        }}
      >
        <Tooltip title="Save field">
          <IconButton
            type="submit"
            form={updateFormID}
            color="primary"
            aria-label={`Save ${field.label}`}
            sx={{
              width: 44,
              height: 44,
              flex: "0 0 auto",
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.2),
              bgcolor: alpha(tokens.burgundy, 0.07),
              "&:hover": {
                bgcolor: alpha(tokens.burgundy, 0.13),
              },
            }}
          >
            <SaveRounded />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete field">
          <IconButton
            type="submit"
            form={deleteFormID}
            color="error"
            aria-label={`Delete ${field.label}`}
            sx={{
              width: 44,
              height: 44,
              flex: "0 0 auto",
              border: "1px solid",
              borderColor: (theme) => alpha(theme.palette.error.main, 0.24),
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.06),
              "&:hover": {
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
              },
            }}
          >
            <DeleteOutlineRounded />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function MiniStat({
  icon,
  label,
  value,
  helper,
  tone = tokens.burgundy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
  tone?: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: alpha(tone, 0.18),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.78)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tone, 0.075)}, transparent 48%)`,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&::after": {
          content: '""',
          position: "absolute",
          right: -26,
          bottom: -32,
          width: 78,
          height: 78,
          borderRadius: "50%",
          bgcolor: alpha(tone, 0.05),
          border: `1px solid ${alpha(tone, 0.12)}`,
        },
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(tone, 0.3),
          boxShadow: `0 18px 42px ${alpha(tokens.ink, 0.065)}`,
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", position: "relative", zIndex: 1 }}
      >
        <Box
          sx={{
            color: tone,
            display: "grid",
            width: 28,
            height: 28,
            borderRadius: 1,
            placeItems: "center",
            bgcolor: alpha(tone, 0.1),
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 900 }}
        >
          {label}
        </Typography>
      </Stack>
      <Typography
        sx={{
          mt: 0.75,
          fontWeight: 900,
          overflowWrap: "anywhere",
          position: "relative",
          zIndex: 1,
        }}
      >
        {value}
      </Typography>
      {helper ? (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", position: "relative", zIndex: 1 }}
        >
          {helper}
        </Typography>
      ) : null}
    </Box>
  );
}

function InlineEmptyState({
  icon,
  title,
  helper,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        border: "1px dashed",
        borderColor: alpha(tokens.burgundy, 0.25),
        borderRadius: 2,
        textAlign: "center",
        bgcolor: "rgba(var(--surface-rgb), 0.7)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.045)}, transparent 48%)`,
      }}
    >
      <Box
        sx={{
          color: "primary.main",
          mb: 0.85,
          mx: "auto",
          width: 52,
          height: 52,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(tokens.burgundy, 0.08),
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.16),
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: 380, mx: "auto", mt: 0.5 }}
      >
        {helper}
      </Typography>
    </Box>
  );
}

function ReportsPanel({
  revenueBuckets,
  stageMetrics,
  followUps,
  totalRevenueMinor,
  completionRate,
  collectionRate,
}: {
  revenueBuckets: RevenueBucket[];
  stageMetrics: StageMetric[];
  followUps: FollowUpItem[];
  totalRevenueMinor: number;
  completionRate: number;
  collectionRate: number;
}) {
  const peakRevenue = Math.max(
    1,
    ...revenueBuckets.map((bucket) => bucket.total_minor),
  );
  const totalStageCount = stageMetrics.reduce(
    (sum, metric) => sum + metric.count,
    0,
  );

  return (
    <Panel id="reports">
      <Box sx={{ p: { xs: 2, md: 2.75 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <QueryStatsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Reports snapshot</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Recorded revenue, stage flow, and work that needs a follow-up.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <ToneChip
              label={`${formatPercent(collectionRate)} collected`}
              tone={tokens.success}
            />
            <ToneChip
              label={`${formatPercent(completionRate)} fulfilled`}
              tone={tokens.info}
            />
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(0, 1.25fr) minmax(340px, 0.75fr)",
            },
          }}
        >
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: { xs: 1.5, md: 2 },
              bgcolor: alpha(tokens.ink, 0.018),
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 900 }}>
                  Seven-day recorded income
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Checkout settlement plus manual takings.
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ lineHeight: 1 }}>
                {formatGHS(totalRevenueMinor)}
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "repeat(7, minmax(34px, 1fr))",
                  md: "repeat(7, minmax(54px, 1fr))",
                },
                alignItems: "end",
                minHeight: 188,
              }}
            >
              {revenueBuckets.map((bucket) => {
                const height = Math.max(
                  14,
                  Math.round((bucket.total_minor / peakRevenue) * 120),
                );
                return (
                  <Stack
                    key={bucket.key}
                    spacing={0.75}
                    sx={{
                      minWidth: 0,
                      alignItems: "stretch",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        textAlign: "center",
                        minHeight: 32,
                        display: "grid",
                        alignItems: "end",
                      }}
                    >
                      {bucket.total_minor > 0
                        ? formatGHS(bucket.total_minor)
                        : "GHS 0"}
                    </Typography>
                    <Box
                      sx={{
                        height,
                        borderRadius: 1.25,
                        bgcolor:
                          bucket.total_minor > 0
                            ? tokens.burgundy
                            : alpha(tokens.ink, 0.08),
                        border: "1px solid",
                        borderColor:
                          bucket.total_minor > 0
                            ? alpha(tokens.burgundy, 0.3)
                            : "divider",
                        transition: "height 180ms ease",
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 800,
                        textAlign: "center",
                        whiteSpace: "normal",
                      }}
                    >
                      {bucket.label}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>
          </Box>

          <Stack spacing={1.25}>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              }}
            >
              <MiniStat
                icon={<TrendingUpRounded fontSize="small" />}
                label="Completion"
                value={formatPercent(completionRate)}
                helper="Fulfilled share of all orders"
                tone={tokens.success}
              />
              <MiniStat
                icon={<PaymentsRounded fontSize="small" />}
                label="Collection"
                value={formatPercent(collectionRate)}
                helper="Settled against known order totals"
                tone={tokens.info}
              />
            </Box>

            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Box sx={{ px: 1.75, py: 1.5, bgcolor: tokens.panel }}>
                <Typography sx={{ fontWeight: 900 }}>
                  Stage throughput
                </Typography>
              </Box>
              {stageMetrics.map((metric) => {
                const width = formatPercent(
                  percentage(metric.count, totalStageCount),
                );
                return (
                  <Box
                    key={metric.label}
                    sx={{
                      px: 1.75,
                      py: 1.35,
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900 }}>
                          {metric.label}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          {metric.helper}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 900 }}>
                        {metric.count}
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        mt: 1,
                        height: 8,
                        borderRadius: 999,
                        bgcolor: alpha(metric.tone, 0.12),
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          width,
                          height: "100%",
                          bgcolor: metric.tone,
                          borderRadius: 999,
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          px: { xs: 2, md: 2.75 },
          pb: { xs: 2, md: 2.75 },
        }}
      >
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              px: 1.75,
              py: 1.5,
              bgcolor: tokens.panel,
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Follow-up radar</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Overdue visits, open handovers, failed messages, and fulfilled
                orders waiting for pickup or delivery.
              </Typography>
            </Box>
            <ToneChip
              label={`${followUps.length} signals`}
              tone={followUps.length > 0 ? tokens.warning : tokens.success}
            />
          </Stack>

          {followUps.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <InlineEmptyState
                icon={<CheckCircleRounded sx={{ fontSize: 38 }} />}
                title="No risky follow-ups"
                helper="The dashboard will surface overdue visits, open handovers, and message problems here."
              />
            </Box>
          ) : (
            followUps.map((item) => (
              <Box
                key={item.id}
                sx={{
                  px: 1.75,
                  py: 1.35,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(0, 1fr) auto",
                  },
                  alignItems: "center",
                }}
              >
                <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      mt: 0.75,
                      bgcolor: item.tone,
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {item.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                    >
                      {item.helper}
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  component={RouterLink}
                  to={item.href}
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowForwardRounded />}
                >
                  {item.meta}
                </Button>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Panel>
  );
}

function StaffTaskPanel({
  orders,
  bookings,
  handovers,
  followUps,
  needsMeasurements,
  activeBookings,
  openHandovers,
  readyForHandover,
  pendingMessages,
}: {
  orders: OrderSummary[];
  bookings: BookingSummary[];
  handovers: HandoverSummary[];
  followUps: FollowUpItem[];
  needsMeasurements: number;
  activeBookings: number;
  openHandovers: number;
  readyForHandover: number;
  pendingMessages: number;
}) {
  const visitMeasurements = orders.filter(
    (order) => measurementSourceFor(order) === "visit",
  ).length;
  const shopMeasurements = orders.filter(
    (order) => measurementSourceFor(order) === "shop",
  ).length;
  const nextBookings = bookings.filter((booking) =>
    canManageBooking(booking.status),
  );
  const nextHandovers = handovers.filter((handover) =>
    canAdvanceHandover(handover.status),
  );

  return (
    <Panel id="tasks">
      <Box sx={{ p: { xs: 2, md: 2.75 } }}>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", lg: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <TuneRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Staff task queue</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Move production, capture measurements, manage visits, and close
                pickup or delivery work.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button
              component={RouterLink}
              to="/dashboard/orders"
              size="small"
              variant="contained"
            >
              Orders
            </Button>
            <Button
              component={RouterLink}
              to="/dashboard/visits"
              size="small"
              variant="outlined"
            >
              Visits
            </Button>
            <Button
              component={RouterLink}
              to="/dashboard/handovers"
              size="small"
              variant="outlined"
            >
              Handovers
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <MiniStat
            icon={<TimelineRounded fontSize="small" />}
            label="In studio"
            value={String(countOrders(orders, "confirmed"))}
            helper="Confirmed orders ready to move"
            tone={tokens.info}
          />
          <MiniStat
            icon={<StraightenRounded fontSize="small" />}
            label="Measurements"
            value={String(needsMeasurements)}
            helper={`${visitMeasurements} visit, ${shopMeasurements} shop`}
            tone={tokens.burgundy}
          />
          <MiniStat
            icon={<CalendarMonthRounded fontSize="small" />}
            label="Visits"
            value={String(activeBookings)}
            helper="Held or booked home visits"
            tone={tokens.success}
          />
          <MiniStat
            icon={<LocalShippingRounded fontSize="small" />}
            label="Handovers"
            value={String(openHandovers)}
            helper={`${readyForHandover} fulfilled orders ready`}
            tone={tokens.warning}
          />
        </Box>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          }}
        >
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 1.75, py: 1.5, bgcolor: tokens.panel }}>
              <Typography sx={{ fontWeight: 900 }}>Next visits</Typography>
            </Box>
            {nextBookings.length === 0 ? (
              <Box sx={{ p: 1.75 }}>
                <InlineEmptyState
                  icon={<CalendarMonthRounded sx={{ fontSize: 34 }} />}
                  title="No active visits"
                  helper="Home visit work will appear here once customers book or hold a slot."
                />
              </Box>
            ) : (
              nextBookings.slice(0, 3).map((booking) => (
                <Box
                  key={booking.booking_id}
                  sx={{
                    px: 1.75,
                    py: 1.35,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {booking.customer_name || "Visit customer"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {shortDateTime(booking.slot_start)} · {booking.design_title}
                  </Typography>
                </Box>
              ))
            )}
          </Box>

          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 1.75, py: 1.5, bgcolor: tokens.panel }}>
              <Typography sx={{ fontWeight: 900 }}>Handover work</Typography>
            </Box>
            {nextHandovers.length === 0 ? (
              <Box sx={{ p: 1.75 }}>
                <InlineEmptyState
                  icon={<LocalShippingRounded sx={{ fontSize: 34 }} />}
                  title="No open handovers"
                  helper="Fulfilled garments waiting for pickup or delivery will appear here."
                />
              </Box>
            ) : (
              nextHandovers.slice(0, 3).map((handover) => (
                <Box
                  key={handover.handover_id}
                  sx={{
                    px: 1.75,
                    py: 1.35,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    alignItems: "center",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {handover.customer_name || "Handover customer"}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                      noWrap
                    >
                      {formatMethod(handover.method)} · {handover.design_title}
                    </Typography>
                  </Box>
                  <ToneChip
                    label={handover.status}
                    tone={handoverTone(handover.status)}
                  />
                </Box>
              ))
            )}
          </Box>
        </Box>

        {followUps.length > 0 || pendingMessages > 0 ? (
          <Box
            sx={{
              mt: 2,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                px: 1.75,
                py: 1.5,
                bgcolor: tokens.panel,
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", sm: "center" },
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Follow-ups</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Open customer work that should not wait.
                </Typography>
              </Box>
              <ToneChip
                label={`${followUps.length} signals`}
                tone={followUps.length > 0 ? tokens.warning : tokens.success}
              />
            </Stack>
            {followUps.slice(0, 4).map((item) => (
              <Box
                key={item.id}
                sx={{
                  px: 1.75,
                  py: 1.35,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "minmax(0, 1fr) auto",
                  },
                  alignItems: "center",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {item.helper}
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  to={item.href}
                  size="small"
                  variant="outlined"
                >
                  {item.meta}
                </Button>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    </Panel>
  );
}

function MoneyPanel({
  summary,
  takings,
  orders,
  error,
}: {
  summary: MoneySummary;
  takings: ManualTaking[];
  orders: OrderSummary[];
  error?: string;
}) {
  const linkableOrders = orders.filter((order) => order.status !== "cancelled");
  const [logOpen, setLogOpen] = useState(false);

  return (
    <Panel id="money">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <AccountBalanceWalletRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Money desk</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Track Paystack money and off-platform cash or momo takings.
              </Typography>
            </Box>
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: { xs: "stretch", sm: "center" } }}
          >
            <ToneChip
              label={`${takings.length} manual entries`}
              tone={tokens.info}
            />
            <Button
              type="button"
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setLogOpen(true)}
            >
              Log taking
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <MiniStat
            icon={<PaymentsRounded fontSize="small" />}
            label="Platform"
            value={formatGHS(summary.through_platform_minor)}
            helper="Paid through checkout"
            tone={tokens.success}
          />
          <MiniStat
            icon={<AccountBalanceWalletRounded fontSize="small" />}
            label="Manual"
            value={formatGHS(summary.manual_takings_minor)}
            helper="Logged cash or momo"
            tone={tokens.info}
          />
          <MiniStat
            icon={<ReceiptLongRounded fontSize="small" />}
            label="Commission"
            value={formatGHS(summary.commission_minor)}
            helper="Xtiitch platform fee"
            tone={tokens.warning}
          />
          <MiniStat
            icon={<CheckCircleRounded fontSize="small" />}
            label="Net income"
            value={formatGHS(summary.net_income_minor)}
            helper="Platform plus manual less fee"
            tone={tokens.burgundy}
          />
        </Box>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Dialog
          open={logOpen}
          onClose={() => setLogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="span"
                  sx={{ display: "block", fontWeight: 950 }}
                >
                  Log manual taking
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  Record off-platform cash, momo, transfer, or card income.
                </Typography>
              </Box>
              <IconButton aria-label="Close" onClick={() => setLogOpen(false)}>
                <CloseRounded />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Form method="post">
              <input type="hidden" name="intent" value="log_taking" />
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    },
                  }}
                >
                  <TextField
                    name="amount_ghs"
                    label="Amount"
                    size="small"
                    required
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">GHS</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: "decimal" },
                    }}
                  />
                  <TextField
                    name="method"
                    label="Method"
                    select
                    defaultValue="cash"
                    size="small"
                  >
                    {manualTakingMethods.map((method) => (
                      <MenuItem key={method.value} value={method.value}>
                        {method.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    name="order_id"
                    label="Order link"
                    select
                    defaultValue=""
                    size="small"
                  >
                    <MenuItem value="">No order link</MenuItem>
                    {linkableOrders.map((order) => (
                      <MenuItem key={order.order_id} value={order.order_id}>
                        {order.design_title} ·{" "}
                        {order.customer_name || "Customer"}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    name="what_for"
                    label="What for"
                    size="small"
                    placeholder="Balance, walk-in, alteration"
                    required
                  />
                </Box>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "flex-end" }}
                >
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setLogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<AddRounded />}
                  >
                    Log taking
                  </Button>
                </Stack>
              </Stack>
            </Form>
          </DialogContent>
        </Dialog>
      </Box>

      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        {takings.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <InlineEmptyState
              icon={<AccountBalanceWalletRounded sx={{ fontSize: 38 }} />}
              title="No manual takings yet"
              helper="Cash, mobile money, and other off-platform income will appear here after staff log it."
            />
          </Box>
        ) : (
          takings.slice(0, 6).map((taking) => (
            <Box
              key={taking.taking_id}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.4,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(0, 1fr) auto",
                },
                alignItems: "center",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900 }} noWrap>
                  {taking.what_for}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {formatMethod(taking.method)} ·{" "}
                  {shortDateTime(taking.taken_at)}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 900 }}>
                {formatGHS(taking.amount_minor)}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </Panel>
  );
}

function WalkInOrderPanel({
  designs,
  sizeBands,
  error,
}: {
  designs: Design[];
  sizeBands: SizeBand[];
  error?: string;
}) {
  const activeDesigns = designs.filter((design) => design.status === "active");
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.success, 0.07)}, transparent 50%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.72))`,
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "stretch", lg: "flex-start" },
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <AddRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Log a walk-in</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Create an in-studio order for a customer who calls or walks in.
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { xs: "stretch", sm: "center" } }}
        >
          <ToneChip
            label={`${activeDesigns.length} active designs`}
            tone={activeDesigns.length > 0 ? tokens.success : tokens.warning}
          />
          <Button
            type="button"
            variant="contained"
            startIcon={<AddRounded />}
            disabled={activeDesigns.length === 0}
            onClick={() => setCreateOpen(true)}
          >
            New walk-in
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 0.5 }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="span"
                sx={{ display: "block", fontWeight: 950 }}
              >
                Create walk-in order
              </Typography>
              <Typography
                component="span"
                variant="body2"
                sx={{ display: "block", color: "text.secondary" }}
              >
                Capture the design, value, and customer details in one focused
                flow.
              </Typography>
            </Box>
            <IconButton aria-label="Close" onClick={() => setCreateOpen(false)}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Form method="post">
            <input type="hidden" name="intent" value="create_walk_in_order" />
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Order details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  <TextField
                    name="design_id"
                    label="Design"
                    select
                    size="small"
                    defaultValue={activeDesigns[0]?.design_id ?? ""}
                    disabled={activeDesigns.length === 0}
                    required
                  >
                    {activeDesigns.length === 0 ? (
                      <MenuItem value="">Add an active design first</MenuItem>
                    ) : null}
                    {activeDesigns.map((design) => (
                      <MenuItem key={design.design_id} value={design.design_id}>
                        {design.title}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    name="size_band_id"
                    label="Size"
                    select
                    size="small"
                    defaultValue=""
                  >
                    <MenuItem value="">No size yet</MenuItem>
                    {sizeBands.map((band) => (
                      <MenuItem
                        key={band.size_band_id}
                        value={band.size_band_id}
                      >
                        {band.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    name="agreed_total_ghs"
                    label="Agreed total"
                    size="small"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">GHS</InputAdornment>
                        ),
                      },
                      htmlInput: { inputMode: "decimal" },
                    }}
                  />
                </Box>
              </Box>
              <Box>
                <Typography sx={{ mb: 1, fontWeight: 900 }}>
                  Customer details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  <TextField
                    name="customer_name"
                    label="Customer name"
                    size="small"
                    required
                  />
                  <TextField name="customer_phone" label="Phone" size="small" />
                  <TextField
                    name="customer_email"
                    label="Email"
                    type="email"
                    size="small"
                  />
                </Box>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "flex-end" }}
              >
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<AddRounded />}
                  disabled={activeDesigns.length === 0}
                >
                  Create order
                </Button>
              </Stack>
            </Stack>
          </Form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function ImageDropzone({
  name,
  helper,
  required = false,
  disabled = false,
}: {
  name: string;
  helper?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const applyFile = (file: File | null | undefined) => {
    const isImage =
      file !== null && file !== undefined && file.type.startsWith("image/");
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return isImage && file ? URL.createObjectURL(file) : null;
    });
    setFileName(isImage && file ? file.name : null);
  };

  return (
    <Box
      component="label"
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) {
          return;
        }
        const file = event.dataTransfer.files?.[0];
        if (file && inputRef.current) {
          const transfer = new DataTransfer();
          transfer.items.add(file);
          inputRef.current.files = transfer.files;
        }
        applyFile(file);
      }}
      sx={{
        display: "block",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        borderRadius: 2,
        p: previewUrl ? 1.25 : 2.5,
        border: "1.5px dashed",
        borderColor: dragging ? tokens.burgundy : alpha(tokens.ink, 0.22),
        bgcolor: dragging
          ? alpha(tokens.burgundy, 0.05)
          : alpha(tokens.burgundy, 0.02),
        transition: "border-color 160ms ease, background-color 160ms ease",
        "&:hover": disabled
          ? {}
          : {
              borderColor: alpha(tokens.burgundy, 0.5),
              bgcolor: alpha(tokens.burgundy, 0.04),
            },
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        required={required}
        disabled={disabled}
        onChange={(event) => applyFile(event.currentTarget.files?.[0])}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />
      {previewUrl ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            component="img"
            src={previewUrl}
            alt=""
            sx={{
              width: 64,
              height: 64,
              borderRadius: 1.5,
              objectFit: "cover",
              flexShrink: 0,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.12),
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }} noWrap>
              {fileName}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: tokens.burgundy, fontWeight: 700 }}
            >
              Click or drop to replace
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Stack
          spacing={0.75}
          sx={{ alignItems: "center", textAlign: "center", py: 0.5 }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              color: tokens.burgundy,
              bgcolor: alpha(tokens.burgundy, 0.1),
            }}
          >
            <CloudUploadRounded />
          </Box>
          <Typography sx={{ fontWeight: 800 }}>
            {dragging
              ? "Drop image to upload"
              : "Drag & drop, or click to choose"}
          </Typography>
          {helper ? (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {helper}
            </Typography>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}

function DesignImageUploadPanel({
  designs,
  error,
}: {
  designs: Design[];
  error?: string;
}) {
  const uploadableDesigns = designs.filter(
    (design) => design.status !== "deleted",
  );

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.info, 0.07)}, transparent 50%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.74))`,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ color: "primary.main" }}>
          <CloudUploadRounded />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>Upload design image</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Attach a photo to an existing catalogue piece.
          </Typography>
        </Box>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      ) : null}

      <Form method="post" encType="multipart/form-data">
        <input type="hidden" name="intent" value="upload_design_image" />
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          <TextField
            name="design_id"
            label="Design"
            select
            defaultValue={uploadableDesigns[0]?.design_id ?? ""}
            disabled={uploadableDesigns.length === 0}
            required
            size="small"
          >
            {uploadableDesigns.length === 0 ? (
              <MenuItem value="">Add a design first</MenuItem>
            ) : null}
            {uploadableDesigns.map((design) => (
              <MenuItem key={design.design_id} value={design.design_id}>
                {design.title}
              </MenuItem>
            ))}
          </TextField>
          <ImageDropzone
            name="image_file"
            required
            disabled={uploadableDesigns.length === 0}
            helper="JPG, PNG, or WebP up to 10 MB. Becomes the first catalogue image."
          />
          <Button
            type="submit"
            variant="outlined"
            startIcon={<CloudUploadRounded />}
            disabled={uploadableDesigns.length === 0}
          >
            Upload and attach
          </Button>
        </Stack>
      </Form>
    </Panel>
  );
}

function StoreSettingsPanel({
  settings,
  profile,
  error,
}: {
  settings: StoreSettings;
  profile: Profile;
  error?: string;
}) {
  const featureSwitches = [
    {
      name: "bespoke_enabled",
      label: "Bespoke orders",
      helper: "Let customers request custom work from eligible designs.",
      checked: settings.bespoke_enabled,
    },
    {
      name: "measurements_enabled",
      label: "Measurements",
      helper: "Show measurement-led ordering and fitting flows.",
      checked: settings.measurements_enabled,
    },
    {
      name: "customisation_enabled",
      label: "Customisation",
      helper: "Allow customers to ask for alterations to catalogue pieces.",
      checked: settings.customisation_enabled,
    },
    {
      name: "collections_enabled",
      label: "Collections",
      helper: "Organise designs into public storefront collections.",
      checked: settings.collections_enabled,
    },
    {
      name: "delivery_enabled",
      label: "Delivery",
      helper: "Show delivery as a fulfilment option where available.",
      checked: settings.delivery_enabled,
    },
    {
      name: "dispatch_enabled",
      label: "Dispatch desk",
      helper: "Let the team manage pickup and delivery handovers.",
      checked: settings.dispatch_enabled,
    },
  ];

  return (
    <Panel id="settings">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <SettingsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
                Storefront settings
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Shape what customers see and which request paths are available.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${enabledStoreSettings(settings)} features on`}
            tone={tokens.burgundy}
          />
        </Stack>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Form method="post">
          <input type="hidden" name="intent" value="save_store_settings" />
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
            }}
          >
            <Box
              sx={{
                p: 2,
                border: "1px solid",
                borderColor: alpha(tokens.burgundy, 0.18),
                borderRadius: 2,
                bgcolor: "rgba(var(--surface-rgb), 0.76)",
                backgroundImage: `linear-gradient(135deg, ${alpha(settings.brand_color || tokens.burgundy, 0.11)}, transparent 52%)`,
              }}
            >
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    color: tokens.white,
                    bgcolor: settings.brand_color || tokens.burgundy,
                    border: "1px solid",
                    borderColor: alpha(tokens.ink, 0.12),
                  }}
                >
                  <PaletteRounded />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {profile.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Public colour and store switches
                  </Typography>
                </Box>
              </Stack>
              <TextField
                name="brand_color"
                label="Brand colour"
                type="color"
                defaultValue={settings.brand_color || tokens.burgundy}
                fullWidth
                sx={{ mt: 2 }}
              />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                This colour is used on the public store header and customer
                trust moments.
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              }}
            >
              {featureSwitches.map((feature) => (
                <Box
                  key={feature.name}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: feature.checked
                      ? alpha(tokens.burgundy, 0.24)
                      : "divider",
                    borderRadius: 2,
                    bgcolor: feature.checked
                      ? alpha(tokens.burgundy, 0.055)
                      : alpha(tokens.white, 0.72),
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name={feature.name}
                        defaultChecked={feature.checked}
                      />
                    }
                    label={feature.label}
                    sx={{
                      m: 0,
                      "& .MuiFormControlLabel-label": { fontWeight: 900 },
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.45, color: "text.secondary" }}
                  >
                    {feature.helper}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveRounded />}
            sx={{ mt: 2 }}
          >
            Save storefront settings
          </Button>
        </Form>
      </Box>
    </Panel>
  );
}

function CatalogueSetupPanel({
  collections,
  sizeBands,
  collectionError,
  sizeBandError,
}: {
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  collectionError?: string;
  sizeBandError?: string;
}) {
  const nextCollectionSequence =
    collections.length === 0
      ? 1
      : Math.max(...collections.map((collection) => collection.sequence)) + 1;
  const nextSizeBandSequence =
    sizeBands.length === 0
      ? 1
      : Math.max(...sizeBands.map((band) => band.sequence)) + 1;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
      }}
    >
      <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <StorefrontRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Collections</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Group pieces for the public store.
            </Typography>
          </Box>
        </Stack>
        {collectionError ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {collectionError}
          </Alert>
        ) : null}
        <Form method="post">
          <input type="hidden" name="intent" value="create_collection" />
          <Box
            sx={{
              mt: 1.5,
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 96px" },
            }}
          >
            <TextField
              name="name"
              label="Collection name"
              size="small"
              required
            />
            <TextField
              name="sequence"
              label="Order"
              type="number"
              size="small"
              defaultValue={nextCollectionSequence}
              slotProps={{ htmlInput: { min: 0 } }}
              required
            />
          </Box>
          <TextField
            name="theme"
            label="Theme"
            size="small"
            fullWidth
            sx={{ mt: 1 }}
            placeholder="Wedding, Friday wear, Ready now"
          />
          <Button
            type="submit"
            variant="outlined"
            startIcon={<AddRounded />}
            sx={{ mt: 1.25 }}
          >
            Add collection
          </Button>
        </Form>
        <Divider sx={{ my: 1.75 }} />
        <Stack spacing={1}>
          {collections.length === 0 ? (
            <InlineEmptyState
              icon={<StorefrontRounded sx={{ fontSize: 34 }} />}
              title="No collections yet"
              helper="Collections help customers browse by occasion or drop."
            />
          ) : (
            collections.map((collection) => (
              <Stack
                key={collection.collection_id}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  p: 1.25,
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "rgba(var(--surface-rgb), 0.72)",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }} noWrap>
                    {collection.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {collection.theme || collection.handle} · #
                    {collection.sequence}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75}>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value={
                        collection.status === "active"
                          ? "retire_collection"
                          : "restore_collection"
                      }
                    />
                    <input
                      type="hidden"
                      name="collection_id"
                      value={collection.collection_id}
                    />
                    <Button type="submit" size="small" variant="outlined">
                      {collection.status === "active" ? "Retire" : "Restore"}
                    </Button>
                  </Form>
                  {collection.status !== "active" ? (
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="delete_collection"
                      />
                      <input
                        type="hidden"
                        name="collection_id"
                        value={collection.collection_id}
                      />
                      <Tooltip title="Remove collection">
                        <IconButton
                          type="submit"
                          color="error"
                          aria-label={`Remove ${collection.name}`}
                        >
                          <DeleteOutlineRounded />
                        </IconButton>
                      </Tooltip>
                    </Form>
                  ) : null}
                </Stack>
              </Stack>
            ))
          )}
        </Stack>
      </Panel>

      <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <StraightenRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Size bands</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Sizes become price rows for standard checkout.
            </Typography>
          </Box>
        </Stack>
        {sizeBandError ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {sizeBandError}
          </Alert>
        ) : null}
        <Form method="post">
          <input type="hidden" name="intent" value="create_size_band" />
          <Box
            sx={{
              mt: 1.5,
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 96px" },
            }}
          >
            <TextField
              name="label"
              label="Size label"
              size="small"
              placeholder="M, L, XL, Custom"
              required
            />
            <TextField
              name="sequence"
              label="Order"
              type="number"
              size="small"
              defaultValue={nextSizeBandSequence}
              slotProps={{ htmlInput: { min: 0 } }}
              required
            />
          </Box>
          <Button
            type="submit"
            variant="outlined"
            startIcon={<AddRounded />}
            sx={{ mt: 1.25 }}
          >
            Add size band
          </Button>
        </Form>
        <Divider sx={{ my: 1.75 }} />
        {sizeBands.length === 0 ? (
          <InlineEmptyState
            icon={<StraightenRounded sx={{ fontSize: 34 }} />}
            title="No size bands yet"
            helper="Add sizes before setting per-design prices."
          />
        ) : (
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {sizeBands.map((band) => (
              <ToneChip
                key={band.size_band_id}
                label={`${band.label} · #${band.sequence}`}
                tone={tokens.info}
              />
            ))}
          </Stack>
        )}
      </Panel>
    </Box>
  );
}

function PriceBoardPanel({
  designs,
  sizeBands,
  error,
}: {
  designs: Design[];
  sizeBands: SizeBand[];
  error?: string;
}) {
  return (
    <Panel>
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <PriceCheckRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Price board</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Set standard checkout prices for every design and size band.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${designs.reduce((total, design) => total + design.prices.length, 0)} prices`}
            tone={tokens.success}
          />
        </Stack>
        {error ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        ) : null}
      </Box>

      {designs.length === 0 || sizeBands.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <InlineEmptyState
            icon={<PriceCheckRounded sx={{ fontSize: 38 }} />}
            title="Prices need designs and sizes"
            helper="Add at least one design and one size band, then set public checkout prices here."
          />
        </Box>
      ) : (
        <Stack
          spacing={0}
          sx={{ borderTop: "1px solid", borderColor: "divider" }}
        >
          {designs.map((design) => (
            <Box
              key={design.design_id}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.6,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {design.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {design.status} · {design.prices.length} prices set
                    </Typography>
                  </Box>
                  <ToneChip
                    label={design.status === "active" ? "Public" : "Hidden"}
                    tone={
                      design.status === "active"
                        ? tokens.success
                        : tokens.warning
                    }
                  />
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                      xl: "repeat(3, minmax(0, 1fr))",
                    },
                  }}
                >
                  {sizeBands.map((band) => {
                    const price = findBandPrice(design, band.size_band_id);
                    return (
                      <Form method="post" key={band.size_band_id}>
                        <input
                          type="hidden"
                          name="intent"
                          value="set_design_price"
                        />
                        <input
                          type="hidden"
                          name="design_id"
                          value={design.design_id}
                        />
                        <input
                          type="hidden"
                          name="size_band_id"
                          value={band.size_band_id}
                        />
                        <Stack
                          direction="row"
                          spacing={0.85}
                          sx={{
                            p: 1,
                            border: "1px solid",
                            borderColor: price
                              ? alpha(tokens.success, 0.22)
                              : "divider",
                            borderRadius: 2,
                            bgcolor: price
                              ? alpha(tokens.success, 0.045)
                              : alpha(tokens.white, 0.72),
                            alignItems: "center",
                          }}
                        >
                          <TextField
                            name="price_ghs"
                            label={band.label}
                            size="small"
                            defaultValue={moneyInputValue(price?.price_minor)}
                            fullWidth
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">
                                    GHS
                                  </InputAdornment>
                                ),
                              },
                              htmlInput: { inputMode: "decimal" },
                            }}
                          />
                          <Tooltip title="Save price">
                            <IconButton
                              type="submit"
                              color="primary"
                              aria-label={`Save ${band.label} price for ${design.title}`}
                            >
                              <SaveRounded />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Form>
                    );
                  })}
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

function promotionDiscountLabel(promotion: BusinessPromotion): string {
  if (promotion.discount_type === "percentage") {
    return `${promotion.discount_value / 100}% up to ${formatGHS(promotion.max_discount_minor ?? 0)}`;
  }
  return formatGHS(promotion.discount_value);
}

function promotionStatusTone(status: string): string {
  switch (status) {
    case "active":
      return tokens.success;
    case "paused":
      return tokens.warning;
    case "archived":
      return tokens.mutedText;
    default:
      return tokens.info;
  }
}

function promotionScopeLabel(promotion: BusinessPromotion): string {
  switch (promotion.scope) {
    case "collection":
      return "Collection";
    case "design":
      return "Design";
    default:
      return "Store";
  }
}

function promotionTargetLabel(
  promotion: BusinessPromotion,
  collections: CollectionSummary[],
  designs: Design[],
): string {
  if (promotion.scope === "collection") {
    const collection = collections.find(
      (item) => item.collection_id === promotion.target_collection_id,
    );
    return collection?.name ?? "Collection target";
  }
  if (promotion.scope === "design") {
    const design = designs.find(
      (item) => item.design_id === promotion.target_design_id,
    );
    return design?.title ?? "Design target";
  }
  return "Entire store";
}

function promotionWindowLabel(promotion: BusinessPromotion): string {
  if (!promotion.starts_at && !promotion.ends_at) {
    return "Always available";
  }
  const start = promotion.starts_at ? shortDate(promotion.starts_at) : "Now";
  const end = promotion.ends_at ? shortDate(promotion.ends_at) : "No end";
  return `${start} to ${end}`;
}

function promotionPercentInputValue(promotion: BusinessPromotion): string {
  return promotion.discount_type === "percentage"
    ? String(promotion.discount_value / 100)
    : "";
}

function PromotionPanel({
  promotions,
  collections,
  designs,
  activeCount,
  redeemedMinor,
  error,
}: {
  promotions: BusinessPromotion[];
  collections: CollectionSummary[];
  designs: Design[];
  activeCount: number;
  redeemedMinor: number;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);
  const pausedCount = promotions.filter(
    (promotion) => promotion.status === "paused",
  ).length;
  const redemptionCount = promotions.reduce(
    (total, promotion) => total + promotion.redemption_count,
    0,
  );
  const activeCollections = collections.filter(
    (collection) => collection.status === "active",
  );
  const activeDesigns = designs.filter((design) => design.status === "active");
  const filteredPromotions = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return promotions.filter((promotion) => {
      const matchesStatus =
        statusFilter === "all" || promotion.status === statusFilter;
      const matchesScope =
        scopeFilter === "all" || promotion.scope === scopeFilter;
      const searchable = [
        promotion.code,
        promotion.title,
        promotion.description,
        promotion.status,
        promotion.scope,
        promotionDiscountLabel(promotion),
        promotionTargetLabel(promotion, collections, designs),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesScope &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [collections, designs, promotions, query, scopeFilter, statusFilter]);
  const selectedPromotion =
    promotions.find((promotion) => promotion.promotion_id === detailID) ?? null;

  return (
    <Panel id="promotions">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <LocalOfferRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Promotion desk</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Business-funded codes for store, collection, or design pushes.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${activeCount} active`}
            tone={activeCount > 0 ? tokens.success : tokens.warning}
          />
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              xl: "repeat(4, 1fr)",
            },
          }}
        >
          <MiniStat
            icon={<LocalOfferRounded fontSize="small" />}
            label="Active"
            value={String(activeCount)}
            helper={`${promotions.length} total codes`}
            tone={tokens.success}
          />
          <MiniStat
            icon={<ScheduleRounded fontSize="small" />}
            label="Paused"
            value={String(pausedCount)}
            helper="Saved but not redeemable"
            tone={tokens.warning}
          />
          <MiniStat
            icon={<PriceCheckRounded fontSize="small" />}
            label="Redemptions"
            value={String(redemptionCount)}
            helper="Applied checkout discounts"
            tone={tokens.info}
          />
          <MiniStat
            icon={<PaymentsRounded fontSize="small" />}
            label="Discounted"
            value={formatGHS(redeemedMinor)}
            helper="Business-funded value"
            tone={tokens.burgundy}
          />
        </Box>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box
          sx={{
            mt: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "rgba(var(--surface-rgb), 0.72)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(150px, 0.38fr)) auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search codes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Status"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
            <TextField
              label="Scope"
              select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All scopes</MenuItem>
              <MenuItem value="store">Store</MenuItem>
              <MenuItem value="collection">Collection</MenuItem>
              <MenuItem value="design">Design</MenuItem>
            </TextField>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New promotion
            </Button>
          </Box>
          <Divider />
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Promotion list</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {filteredPromotions.length} of {promotions.length} codes shown
              </Typography>
            </Box>
            <ToneChip
              label={`${redemptionCount} used`}
              tone={redemptionCount > 0 ? tokens.success : tokens.info}
            />
          </Box>
          {promotions.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<LocalOfferRounded sx={{ fontSize: 38 }} />}
                title="No promotions yet"
                helper="Create the first promo code when a business wants to fund a store or design push."
              />
            </Box>
          ) : filteredPromotions.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<SearchRounded sx={{ fontSize: 38 }} />}
                title="No matching promotions"
                helper="Adjust the search or filters to bring more codes back into view."
              />
            </Box>
          ) : (
            filteredPromotions.map((promotion) => (
              <PromotionRow
                key={promotion.promotion_id}
                promotion={promotion}
                collections={collections}
                designs={designs}
                onView={() => setDetailID(promotion.promotion_id)}
              />
            ))
          )}
        </Box>
      </Box>
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create promotion</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Launch a storewide or targeted offer.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <PromotionCreateForm
            activeCollections={activeCollections}
            activeDesigns={activeDesigns}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedPromotion)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">
                {selectedPromotion?.code ?? "Promotion details"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Review, edit, or archive this promotion.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPromotion ? (
            <PromotionDetailForm
              promotion={selectedPromotion}
              collections={collections}
              designs={designs}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function PromotionCreateForm({
  activeCollections,
  activeDesigns,
}: {
  activeCollections: CollectionSummary[];
  activeDesigns: Design[];
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="create_promotion" />
      <Stack spacing={1.5}>
        <TextField
          name="code"
          label="Code"
          defaultValue="WELCOME10"
          size="small"
          required
          fullWidth
        />
        <TextField name="title" label="Title" size="small" required fullWidth />
        <TextField
          name="description"
          label="Internal note"
          size="small"
          multiline
          minRows={2}
          fullWidth
        />
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="discount_type"
            label="Discount type"
            select
            defaultValue="percentage"
            size="small"
          >
            <MenuItem value="percentage">Percentage</MenuItem>
            <MenuItem value="fixed">Fixed amount</MenuItem>
          </TextField>
          <TextField
            name="status"
            label="Status"
            select
            defaultValue="active"
            size="small"
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="paused">Paused</MenuItem>
          </TextField>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          }}
        >
          <TextField
            name="percentage_discount"
            label="Percent"
            size="small"
            defaultValue="10"
            slotProps={{ htmlInput: { inputMode: "decimal" } }}
          />
          <TextField
            name="fixed_discount_ghs"
            label="Fixed"
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
          />
          <TextField
            name="max_discount_ghs"
            label="Max"
            size="small"
            defaultValue="50"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="scope"
            label="Applies to"
            select
            defaultValue="store"
            size="small"
          >
            <MenuItem value="store">Entire store</MenuItem>
            <MenuItem value="collection">Collection</MenuItem>
            <MenuItem value="design">Design</MenuItem>
          </TextField>
          <TextField
            name="min_spend_ghs"
            label="Min spend"
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">GHS</InputAdornment>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
          />
        </Box>
        <TextField
          name="target_collection_id"
          label="Collection target"
          select
          defaultValue=""
          size="small"
        >
          <MenuItem value="">No collection target</MenuItem>
          {activeCollections.map((collection) => (
            <MenuItem
              key={collection.collection_id}
              value={collection.collection_id}
            >
              {collection.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="target_design_id"
          label="Design target"
          select
          defaultValue=""
          size="small"
        >
          <MenuItem value="">No design target</MenuItem>
          {activeDesigns.map((design) => (
            <MenuItem key={design.design_id} value={design.design_id}>
              {design.title}
            </MenuItem>
          ))}
        </TextField>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="usage_limit_global"
            label="Total uses"
            type="number"
            size="small"
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <TextField
            name="usage_limit_per_customer"
            label="Uses/customer"
            type="number"
            size="small"
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <StyledDateTimeField name="starts_at" label="Starts" size="small" />
          <StyledDateTimeField name="ends_at" label="Ends" size="small" />
        </Box>
        <Button type="submit" variant="contained" startIcon={<AddRounded />}>
          Create promotion
        </Button>
      </Stack>
    </Form>
  );
}

function PromotionRow({
  promotion,
  collections,
  designs,
  onView,
}: {
  promotion: BusinessPromotion;
  collections: CollectionSummary[];
  designs: Design[];
  onView: () => void;
}) {
  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.6,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={1.35}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.4}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.15} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                bgcolor: alpha(promotionStatusTone(promotion.status), 0.1),
                color: promotionStatusTone(promotion.status),
                border: "1px solid",
                borderColor: alpha(promotionStatusTone(promotion.status), 0.2),
              }}
            >
              <LocalOfferRounded />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 950 }} noWrap>
                {promotion.code}
              </Typography>
              <Typography sx={{ fontWeight: 800 }} noWrap>
                {promotion.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {promotionDiscountLabel(promotion)} ·{" "}
                {promotionTargetLabel(promotion, collections, designs)}
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ mt: 0.85, flexWrap: "wrap" }}
              >
                <ToneChip
                  label={promotion.status}
                  tone={promotionStatusTone(promotion.status)}
                />
                <ToneChip
                  label={promotionScopeLabel(promotion)}
                  tone={tokens.info}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={promotionWindowLabel(promotion)}
                />
              </Stack>
            </Box>
          </Stack>
          <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {promotion.redemption_count} redemption
              {promotion.redemption_count === 1 ? "" : "s"}
            </Typography>
            <Typography sx={{ fontWeight: 900 }}>
              {formatGHS(promotion.discount_redeemed_minor)}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<VisibilityRounded />}
              onClick={onView}
              sx={{ mt: 1 }}
            >
              View details
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}

function PromotionDetailForm({
  promotion,
  collections,
  designs,
}: {
  promotion: BusinessPromotion;
  collections: CollectionSummary[];
  designs: Design[];
}) {
  const archived = promotion.status === "archived";
  const currentCollectionID = promotion.target_collection_id ?? "";
  const currentDesignID = promotion.target_design_id ?? "";

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <MiniStat
          icon={<LocalOfferRounded fontSize="small" />}
          label="Discount"
          value={promotionDiscountLabel(promotion)}
          helper={promotionTargetLabel(promotion, collections, designs)}
          tone={promotionStatusTone(promotion.status)}
        />
        <MiniStat
          icon={<PriceCheckRounded fontSize="small" />}
          label="Redemptions"
          value={String(promotion.redemption_count)}
          helper={formatGHS(promotion.discount_redeemed_minor)}
          tone={tokens.success}
        />
        <MiniStat
          icon={<ScheduleRounded fontSize="small" />}
          label="Window"
          value={promotion.status}
          helper={promotionWindowLabel(promotion)}
          tone={promotionStatusTone(promotion.status)}
        />
      </Box>

      {archived ? (
        <InfoStrip
          icon={<WarningAmberRounded />}
          tone={tokens.mutedText}
          title="Archived promotion"
          helper="Archived codes stay visible for reporting and cannot be edited here."
        />
      ) : (
        <Stack spacing={1.5}>
          <Form method="post">
            <input type="hidden" name="intent" value="update_promotion" />
            <input
              type="hidden"
              name="promotion_id"
              value={promotion.promotion_id}
            />
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(4, minmax(0, 1fr))",
                },
              }}
            >
              <TextField
                name="code"
                label="Code"
                size="small"
                defaultValue={promotion.code}
                required
              />
              <TextField
                name="title"
                label="Title"
                size="small"
                defaultValue={promotion.title}
                required
              />
              <TextField
                name="discount_type"
                label="Type"
                select
                size="small"
                defaultValue={
                  promotion.discount_type === "fixed" ? "fixed" : "percentage"
                }
              >
                <MenuItem value="percentage">Percent</MenuItem>
                <MenuItem value="fixed">Fixed</MenuItem>
              </TextField>
              <TextField
                name="status"
                label="Status"
                select
                size="small"
                defaultValue={
                  promotion.status === "paused" ? "paused" : "active"
                }
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="paused">Paused</MenuItem>
              </TextField>
              <TextField
                name="description"
                label="Note"
                size="small"
                defaultValue={promotion.description}
                sx={{ gridColumn: { lg: "span 2" } }}
              />
              <TextField
                name="percentage_discount"
                label="Percent"
                size="small"
                defaultValue={promotionPercentInputValue(promotion)}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
              />
              <TextField
                name="fixed_discount_ghs"
                label="Fixed"
                size="small"
                defaultValue={
                  promotion.discount_type === "fixed"
                    ? moneyInputValue(promotion.discount_value)
                    : ""
                }
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: "decimal" },
                }}
              />
              <TextField
                name="max_discount_ghs"
                label="Max"
                size="small"
                defaultValue={moneyInputValue(promotion.max_discount_minor)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: "decimal" },
                }}
              />
              <TextField
                name="min_spend_ghs"
                label="Min spend"
                size="small"
                defaultValue={moneyInputValue(promotion.min_spend_minor)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">GHS</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: "decimal" },
                }}
              />
              <TextField
                name="scope"
                label="Applies to"
                select
                size="small"
                defaultValue={
                  ["store", "collection", "design"].includes(promotion.scope)
                    ? promotion.scope
                    : "store"
                }
              >
                <MenuItem value="store">Store</MenuItem>
                <MenuItem value="collection">Collection</MenuItem>
                <MenuItem value="design">Design</MenuItem>
              </TextField>
              <TextField
                name="target_collection_id"
                label="Collection"
                select
                size="small"
                defaultValue={currentCollectionID}
              >
                <MenuItem value="">No collection</MenuItem>
                {collections.map((collection) => (
                  <MenuItem
                    key={collection.collection_id}
                    value={collection.collection_id}
                  >
                    {collection.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                name="target_design_id"
                label="Design"
                select
                size="small"
                defaultValue={currentDesignID}
              >
                <MenuItem value="">No design</MenuItem>
                {designs.map((design) => (
                  <MenuItem key={design.design_id} value={design.design_id}>
                    {design.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                name="usage_limit_global"
                label="Total uses"
                type="number"
                size="small"
                defaultValue={promotion.usage_limit_global ?? ""}
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                name="usage_limit_per_customer"
                label="Uses/customer"
                type="number"
                size="small"
                defaultValue={promotion.usage_limit_per_customer ?? ""}
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <StyledDateTimeField
                name="starts_at"
                label="Starts"
                size="small"
                defaultValue={datetimeLocalValue(promotion.starts_at ?? "")}
              />
              <StyledDateTimeField
                name="ends_at"
                label="Ends"
                size="small"
                defaultValue={datetimeLocalValue(promotion.ends_at ?? "")}
              />
            </Box>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveRounded />}
              sx={{ mt: 1.5 }}
            >
              Save promotion
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="archive_promotion" />
            <input
              type="hidden"
              name="promotion_id"
              value={promotion.promotion_id}
            />
            <Button type="submit" variant="outlined" color="error">
              Archive promotion
            </Button>
          </Form>
        </Stack>
      )}
    </Stack>
  );
}

function TeamPanel({
  users,
  currentUser,
  error,
}: {
  users: BusinessUser[];
  currentUser: CurrentUser;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [detailID, setDetailID] = useState<string | null>(null);
  const activeUsers = users.filter((user) => user.is_active).length;
  const adminUsers = users.filter((user) => user.role === "admin").length;
  const staffUsers = users.filter((user) => user.role === "staff").length;
  const inactiveUsers = users.filter((user) => !user.is_active).length;
  const filteredUsers = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.is_active : !user.is_active);
      const searchable = [
        user.display_name,
        user.email,
        user.role,
        user.is_active ? "active" : "inactive",
        businessUserJoinedLabel(user),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesRole &&
        matchesStatus &&
        (!normalisedQuery || searchable.includes(normalisedQuery))
      );
    });
  }, [query, roleFilter, statusFilter, users]);
  const selectedUser =
    users.find((user) => user.business_user_id === detailID) ?? null;

  return (
    <Panel id="team">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <PeopleAltRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Team access</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Admins can manage the studio; staff can work assigned production
                desks.
              </Typography>
            </Box>
          </Stack>
          <ToneChip label={`${activeUsers} active`} tone={tokens.success} />
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          }}
        >
          <MiniStat
            icon={<CheckCircleRounded fontSize="small" />}
            label="Active"
            value={String(activeUsers)}
            helper={`${users.length} total accounts`}
            tone={tokens.success}
          />
          <MiniStat
            icon={<VerifiedUserRounded fontSize="small" />}
            label="Admins"
            value={String(adminUsers)}
            helper="Can manage workspace settings"
            tone={tokens.info}
          />
          <MiniStat
            icon={<PeopleAltRounded fontSize="small" />}
            label="Staff"
            value={String(staffUsers)}
            helper="Production desk access"
            tone={tokens.burgundy}
          />
          <MiniStat
            icon={<WarningAmberRounded fontSize="small" />}
            label="Inactive"
            value={String(inactiveUsers)}
            helper="Blocked from signing in"
            tone={tokens.warning}
          />
        </Box>

        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box
          sx={{
            mt: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "rgba(var(--surface-rgb), 0.72)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) repeat(2, minmax(140px, 0.35fr)) auto auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              label="Search accounts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Role"
              select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All roles</MenuItem>
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="staff">Staff</MenuItem>
            </TextField>
            <TextField
              label="Status"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              size="small"
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              startIcon={<VerifiedUserRounded />}
              onClick={() => setTransferOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              Transfer owner
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCreateOpen(true)}
              sx={{ minHeight: 42, whiteSpace: "nowrap" }}
            >
              New user
            </Button>
          </Box>
          <Divider />
          <Box
            sx={{
              p: { xs: 2, md: 2.25 },
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Account list</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {filteredUsers.length} of {users.length} people shown
              </Typography>
            </Box>
            <ToneChip
              label={`${inactiveUsers} inactive`}
              tone={inactiveUsers > 0 ? tokens.warning : tokens.success}
            />
          </Box>
          {users.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<PeopleAltRounded sx={{ fontSize: 38 }} />}
                title="No team accounts"
                helper="The owner account will appear here after the API returns business users."
              />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <InlineEmptyState
                icon={<SearchRounded sx={{ fontSize: 38 }} />}
                title="No matching accounts"
                helper="Adjust the search or filters to bring more users back into view."
              />
            </Box>
          ) : (
            filteredUsers.map((user) => (
              <BusinessUserRow
                key={user.business_user_id}
                user={user}
                currentUser={currentUser}
                onView={() => setDetailID(user.business_user_id)}
              />
            ))
          )}
        </Box>
      </Box>
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Create access</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Add an admin or staff sign-in.
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <BusinessUserCreateForm error={error} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">Owner transfer</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Move owner access to another active admin.
              </Typography>
            </Box>
            <IconButton
              onClick={() => setTransferOpen(false)}
              aria-label="Close"
            >
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <OwnerTransferPanel users={users} currentUser={currentUser} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedUser)}
        onClose={() => setDetailID(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6">
                {selectedUser?.display_name || selectedUser?.email || "Account"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Review access, role, status, and password controls.
              </Typography>
            </Box>
            <IconButton onClick={() => setDetailID(null)} aria-label="Close">
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser ? (
            <BusinessUserDetailForm
              user={selectedUser}
              currentUser={currentUser}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function BusinessUserCreateForm({ error }: { error?: string }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="create_business_user" />
      <Stack spacing={1.5}>
        {error ? <Alert severity="warning">{error}</Alert> : null}
        <TextField
          name="display_name"
          label="Name"
          size="small"
          required
          fullWidth
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          size="small"
          required
          fullWidth
        />
        <TextField
          name="password"
          label="Temporary password"
          type="password"
          size="small"
          required
          fullWidth
          slotProps={{ htmlInput: { minLength: 8, maxLength: 72 } }}
        />
        <TextField
          name="role"
          label="Role"
          select
          defaultValue="staff"
          size="small"
        >
          {businessUserRoleOptions.map((role) => (
            <MenuItem key={role.value} value={role.value}>
              {role.label}
            </MenuItem>
          ))}
        </TextField>
        <Button type="submit" variant="contained" startIcon={<AddRounded />}>
          Add team member
        </Button>
      </Stack>
    </Form>
  );
}

function OwnerTransferPanel({
  users,
  currentUser,
}: {
  users: BusinessUser[];
  currentUser: CurrentUser;
}) {
  const isOwner = currentUser.role === "owner";
  const activeAdmins = users.filter(
    (user) =>
      user.role === "admin" &&
      user.is_active &&
      user.business_user_id !== currentUser.user_id,
  );
  const disabled = !isOwner || activeAdmins.length === 0;
  const helper = !isOwner
    ? "Only the current owner can transfer ownership."
    : activeAdmins.length === 0
      ? "Create an active admin account before transferring ownership."
      : "Transfers demote the current owner to admin and require everyone involved to sign in again.";

  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.25 },
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.22),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.74)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.burgundy, 0.06)}, transparent 52%)`,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ color: "primary.main" }}>
          <VerifiedUserRounded />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>Owner transfer</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {helper}
          </Typography>
        </Box>
      </Stack>

      {!isOwner || activeAdmins.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {helper}
        </Alert>
      ) : null}

      <Form method="post">
        <input type="hidden" name="intent" value="transfer_owner" />
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <TextField
            name="new_owner_user_id"
            label="New owner"
            select
            size="small"
            defaultValue={activeAdmins[0]?.business_user_id ?? ""}
            disabled={disabled}
            required
            fullWidth
          >
            {activeAdmins.length === 0 ? (
              <MenuItem value="">No active admins available</MenuItem>
            ) : (
              activeAdmins.map((user) => (
                <MenuItem
                  key={user.business_user_id}
                  value={user.business_user_id}
                >
                  {user.display_name || user.email}
                </MenuItem>
              ))
            )}
          </TextField>
          <TextField
            name="confirmation"
            label='Type "TRANSFER OWNER"'
            size="small"
            disabled={disabled}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="outlined"
            color="error"
            startIcon={<VerifiedUserRounded />}
            disabled={disabled}
          >
            Transfer ownership
          </Button>
        </Stack>
      </Form>
    </Box>
  );
}

function BusinessUserRow({
  user,
  currentUser,
  onView,
}: {
  user: BusinessUser;
  currentUser: CurrentUser;
  onView: () => void;
}) {
  const isCurrentUser = user.business_user_id === currentUser.user_id;
  const tone = roleTone(user.role);

  return (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.6,
        borderTop: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: { xs: 1.5, md: 2 },
        transition: "background-color 160ms ease",
        "&:hover": {
          bgcolor: alpha(tokens.burgundy, 0.02),
        },
      }}
    >
      <Box
        sx={{
          width: { xs: 44, md: 50 },
          height: { xs: 44, md: 50 },
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          bgcolor: alpha(tone, 0.1),
          color: tone,
          fontWeight: 900,
          fontSize: { xs: "0.95rem", md: "1rem" },
          border: "1px solid",
          borderColor: alpha(tone, 0.18),
          boxShadow: `0 8px 20px ${alpha(tone, 0.08)}`,
        }}
      >
        {businessUserInitials(user)}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.6 }}
        >
          <Typography sx={{ fontWeight: 900 }} noWrap>
            {user.display_name || user.email}
          </Typography>
          <ToneChip label={roleLabel(user.role)} tone={tone} />
          <ToneChip
            label={user.is_active ? "Active" : "Inactive"}
            tone={user.is_active ? tokens.success : tokens.warning}
          />
          {isCurrentUser ? (
            <Chip size="small" variant="outlined" label="You" />
          ) : null}
        </Stack>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", overflowWrap: "anywhere", mt: 0.25 }}
        >
          {user.email}
        </Typography>
      </Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 0.5, md: 1.5 }}
        sx={{
          alignItems: { xs: "flex-end", md: "center" },
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 800,
            whiteSpace: "nowrap",
            textAlign: { xs: "right", md: "left" },
          }}
        >
          {businessUserJoinedLabel(user)}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<VisibilityRounded fontSize="small" />}
          onClick={onView}
          sx={{
            minWidth: 0,
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            fontWeight: 800,
            textTransform: "none",
          }}
        >
          View
        </Button>
      </Stack>
    </Box>
  );
}

function BusinessUserDetailForm({
  user,
  currentUser,
}: {
  user: BusinessUser;
  currentUser: CurrentUser;
}) {
  const isOwner = user.role === "owner";
  const isCurrentUser = user.business_user_id === currentUser.user_id;
  const tone = roleTone(user.role);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        }}
      >
        <MiniStat
          icon={<PeopleAltRounded fontSize="small" />}
          label="Role"
          value={roleLabel(user.role)}
          helper={isCurrentUser ? "Current session" : "Business user"}
          tone={tone}
        />
        <MiniStat
          icon={<CheckCircleRounded fontSize="small" />}
          label="Status"
          value={user.is_active ? "Active" : "Inactive"}
          helper={businessUserJoinedLabel(user)}
          tone={user.is_active ? tokens.success : tokens.warning}
        />
        <MiniStat
          icon={<VerifiedUserRounded fontSize="small" />}
          label="Identity"
          value={businessUserInitials(user)}
          helper={user.email}
          tone={tokens.info}
        />
      </Box>

      {isOwner ? (
        <InfoStrip
          icon={<VerifiedUserRounded />}
          tone={tokens.burgundy}
          title="Protected owner account"
          helper="Owner role changes stay outside this team desk."
        />
      ) : (
        <Stack spacing={1.5}>
          <Form method="post">
            <input type="hidden" name="intent" value="update_business_user" />
            <input
              type="hidden"
              name="business_user_id"
              value={user.business_user_id}
            />
            <input
              type="hidden"
              name="is_active"
              value={user.is_active ? "true" : "false"}
            />
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "minmax(0, 1fr) 150px auto",
                },
                alignItems: "center",
              }}
            >
              <TextField
                name="display_name"
                label="Name"
                size="small"
                defaultValue={user.display_name}
                required
              />
              <TextField
                name="role"
                label="Role"
                select
                size="small"
                defaultValue={user.role === "admin" ? "admin" : "staff"}
              >
                {businessUserRoleOptions.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveRounded />}
              >
                Save
              </Button>
            </Box>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="update_business_user" />
            <input
              type="hidden"
              name="business_user_id"
              value={user.business_user_id}
            />
            <input
              type="hidden"
              name="display_name"
              value={user.display_name}
            />
            <input
              type="hidden"
              name="role"
              value={user.role === "admin" ? "admin" : "staff"}
            />
            <input
              type="hidden"
              name="is_active"
              value={user.is_active ? "false" : "true"}
            />
            <Button
              type="submit"
              variant="outlined"
              color={user.is_active ? "error" : "success"}
              disabled={isCurrentUser}
            >
              {user.is_active ? "Deactivate user" : "Reactivate user"}
            </Button>
          </Form>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="reset_business_user_password"
            />
            <input
              type="hidden"
              name="business_user_id"
              value={user.business_user_id}
            />
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
              }}
            >
              <TextField
                name="password"
                label="New temporary password"
                type="password"
                size="small"
                required
                slotProps={{ htmlInput: { minLength: 8, maxLength: 72 } }}
              />
              <Button
                type="submit"
                variant="outlined"
                startIcon={<LockResetRounded />}
              >
                Reset password
              </Button>
            </Box>
          </Form>
        </Stack>
      )}
    </Stack>
  );
}

function BookingQueuePanel({
  bookings,
  error,
}: {
  bookings: BookingSummary[];
  error?: string;
}) {
  return (
    <Panel id="visits">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <CalendarMonthRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Visit queue</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Home-visit bookings, reschedule controls, and cancellations.
            </Typography>
          </Box>
        </Stack>
        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </Box>

      {bookings.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <InlineEmptyState
            icon={<EventAvailableRounded sx={{ fontSize: 38 }} />}
            title="No booked visits"
            helper="Customer home-visit bookings will appear here after checkout confirms the deposit."
          />
        </Box>
      ) : (
        bookings.map((booking) => {
          const manage = canManageBooking(booking.status);
          const canReschedule = booking.status === "booked";
          return (
            <Box
              key={booking.booking_id}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.75,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {booking.customer_name || "Customer"} ·{" "}
                      {booking.design_title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {shortDateTime(booking.slot_start)} to{" "}
                      {shortDateTime(booking.slot_end)}
                    </Typography>
                  </Box>
                  <ToneChip
                    label={booking.status}
                    tone={bookingTone(booking.status)}
                  />
                </Stack>
                <InfoStrip
                  icon={<PhoneRounded />}
                  tone={tokens.info}
                  title={booking.customer_phone || "No phone captured"}
                  helper={booking.address || "No address captured"}
                />
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  sx={{ alignItems: { xs: "stretch", md: "center" } }}
                >
                  <Form method="post" style={{ flex: 1 }}>
                    <input
                      type="hidden"
                      name="intent"
                      value="reschedule_booking"
                    />
                    <input
                      type="hidden"
                      name="booking_id"
                      value={booking.booking_id}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <StyledDateTimeField
                        name="slot_start"
                        label="New slot"
                        size="small"
                        defaultValue={datetimeLocalValue(booking.slot_start)}
                        disabled={!canReschedule}
                        fullWidth
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        disabled={!canReschedule}
                      >
                        Reschedule
                      </Button>
                    </Stack>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="cancel_booking" />
                    <input
                      type="hidden"
                      name="booking_id"
                      value={booking.booking_id}
                    />
                    <Button
                      type="submit"
                      color="error"
                      variant="outlined"
                      disabled={!manage}
                      fullWidth
                    >
                      Cancel
                    </Button>
                  </Form>
                </Stack>
              </Stack>
            </Box>
          );
        })
      )}
    </Panel>
  );
}

function HandoverPanel({
  handovers,
  orders,
  error,
}: {
  handovers: HandoverSummary[];
  orders: OrderSummary[];
  error?: string;
}) {
  const handoverOrders = fulfilledOrdersWithoutOpenHandover(orders, handovers);

  return (
    <Panel id="handovers">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <LocalShippingRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Handover desk</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Arrange pickup or delivery once an order is fulfilled.
            </Typography>
          </Box>
        </Stack>

        <Form method="post">
          <input type="hidden" name="intent" value="arrange_handover" />
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {error ? <Alert severity="warning">{error}</Alert> : null}
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(0, 1.2fr) minmax(130px, 0.5fr)",
                },
              }}
            >
              <TextField
                name="order_id"
                label="Fulfilled order"
                select
                size="small"
                defaultValue={handoverOrders[0]?.order_id ?? ""}
                disabled={handoverOrders.length === 0}
                required
              >
                {handoverOrders.length === 0 ? (
                  <MenuItem value="">No fulfilled orders ready</MenuItem>
                ) : null}
                {handoverOrders.map((order) => (
                  <MenuItem key={order.order_id} value={order.order_id}>
                    {order.design_title} · {order.customer_name || "Customer"}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                name="method"
                label="Method"
                select
                defaultValue="pickup"
                size="small"
              >
                {handoverMethods.map((method) => (
                  <MenuItem key={method.value} value={method.value}>
                    {method.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              }}
            >
              <TextField name="recipient_name" label="Recipient" size="small" />
              <TextField
                name="recipient_phone"
                label="Recipient phone"
                size="small"
              />
              <TextField name="courier" label="Courier or rider" size="small" />
              <TextField name="note" label="Note" size="small" />
            </Box>
            <TextField
              name="address"
              label="Delivery address"
              size="small"
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddRounded />}
              disabled={handoverOrders.length === 0}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              Arrange handover
            </Button>
          </Stack>
        </Form>
      </Box>

      {handovers.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <InlineEmptyState
            icon={<LocalShippingRounded sx={{ fontSize: 38 }} />}
            title="No handovers yet"
            helper="Fulfilled orders can be turned into pickup or delivery handovers from this desk."
          />
        </Box>
      ) : (
        handovers.map((handover) => {
          const active = canAdvanceHandover(handover.status);
          return (
            <Box
              key={handover.handover_id}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.75,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {handover.customer_name || "Customer"} ·{" "}
                      {handover.design_title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {formatMethod(handover.method)} ·{" "}
                      {shortDateTime(handover.created_at)}
                    </Typography>
                  </Box>
                  <ToneChip
                    label={handover.status}
                    tone={handoverTone(handover.status)}
                  />
                </Stack>
                <InfoStrip
                  icon={<PhoneRounded />}
                  tone={tokens.info}
                  title={
                    handover.recipient_phone ||
                    handover.customer_phone ||
                    "No phone captured"
                  }
                  helper={
                    handover.address ||
                    handover.recipient_name ||
                    handover.note ||
                    "Pickup from shop"
                  }
                />
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  sx={{ alignItems: { xs: "stretch", md: "center" } }}
                >
                  <Form method="post" style={{ flex: 1 }}>
                    <input
                      type="hidden"
                      name="intent"
                      value="advance_handover"
                    />
                    <input
                      type="hidden"
                      name="handover_id"
                      value={handover.handover_id}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        name="courier"
                        label="Courier"
                        size="small"
                        defaultValue={handover.courier}
                        disabled={!active}
                        fullWidth
                      />
                      <TextField
                        name="note"
                        label="Note"
                        size="small"
                        defaultValue={handover.note}
                        disabled={!active}
                        fullWidth
                      />
                      <Button
                        type="submit"
                        variant="outlined"
                        disabled={!active}
                        sx={{ minWidth: 150 }}
                      >
                        {handoverActionLabel(handover)}
                      </Button>
                    </Stack>
                  </Form>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="cancel_handover"
                    />
                    <input
                      type="hidden"
                      name="handover_id"
                      value={handover.handover_id}
                    />
                    <Button
                      type="submit"
                      variant="outlined"
                      color="error"
                      disabled={!active}
                      fullWidth
                    >
                      Cancel
                    </Button>
                  </Form>
                </Stack>
              </Stack>
            </Box>
          );
        })
      )}
    </Panel>
  );
}

function AvailabilityPanel({
  windows,
  error,
}: {
  windows: AvailabilityWindow[];
  error?: string;
}) {
  const sortedWindows = [...windows].sort(
    (a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute,
  );

  return (
    <Panel id="availability">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <ScheduleRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Visit hours</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Weekly windows that produce customer home-visit slots.
            </Typography>
          </Box>
        </Stack>
        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Form method="post">
          <input type="hidden" name="intent" value="save_availability" />
          <Stack spacing={1.25} sx={{ mt: 2 }}>
            {sortedWindows.map((window, index) => (
              <AvailabilityWindowFields
                key={`${window.weekday}-${window.start_minute}-${index}`}
                window={window}
              />
            ))}
            <AvailabilityWindowFields />
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveRounded />}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              Save hours
            </Button>
          </Stack>
        </Form>
      </Box>
    </Panel>
  );
}

function AvailabilityWindowFields({ window }: { window?: AvailabilityWindow }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        p: { xs: 1.5, sm: 1.75 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: alpha(tokens.panel, 0.5),
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          alignItems: "start",
          gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 136px" },
        }}
      >
        <TextField
          name="weekday"
          label="Day"
          select
          size="small"
          defaultValue={window?.weekday ?? 1}
        >
          {weekdays.map((weekday) => (
            <MenuItem key={weekday.value} value={weekday.value}>
              {weekday.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="slot_minutes"
          label="Slot (min)"
          type="number"
          size="small"
          defaultValue={window?.slot_minutes ?? 60}
          slotProps={{ htmlInput: { min: 15, max: 480, step: 15 } }}
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          alignItems: "start",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <StyledTimeField
          name="start"
          label="Start time"
          size="small"
          defaultValue={window ? minutesToTime(window.start_minute) : ""}
        />
        <StyledTimeField
          name="end"
          label="End time"
          size="small"
          defaultValue={window ? minutesToTime(window.end_minute) : ""}
        />
      </Box>
    </Box>
  );
}

function NotificationPanel({
  notifications,
}: {
  notifications: NotificationSummary[];
}) {
  return (
    <Panel id="messages">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <NotificationsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Message log</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Outbound WhatsApp/SMS intents created by order events.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${notifications.length} total`}
            tone={tokens.burgundy}
          />
        </Stack>
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <InlineEmptyState
            icon={<NotificationsRounded sx={{ fontSize: 38 }} />}
            title="No messages yet"
            helper="Order, booking, payment, and handover events will create entries in this outbox log."
          />
        </Box>
      ) : (
        notifications.slice(0, 8).map((message) => (
          <Box
            key={message.message_id}
            sx={{
              px: { xs: 2, md: 2.5 },
              py: 1.4,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
              alignItems: "center",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900 }} noWrap>
                {messageKindLabel(message.kind)}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
              >
                {message.channel.toUpperCase()} to {message.recipient} ·{" "}
                {shortDateTime(message.created_at)}
              </Typography>
            </Box>
            <ToneChip
              label={`${message.status} · ${message.attempts}`}
              tone={notificationTone(message.status)}
            />
          </Box>
        ))
      )}
    </Panel>
  );
}

export default function Dashboard({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    profile,
    currentUser,
    designs,
    orders,
    measurementFields,
    moneySummary,
    manualTakings,
    bookings,
    handovers,
    notifications,
    availabilityWindows,
    businessUsers,
    storeSettings,
    collections,
    sizeBands,
    promotions,
    section,
    orderFilter,
    dataWarnings,
  } = loaderData;
  const action = (actionData ?? {}) as DashboardActionData;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const { isDark: darkChrome, toggleMode } = useThemeMode();
  const [catalogueView, setCatalogueView] = useState<"all" | "add">("all");
  const [openDesignId, setOpenDesignId] = useState<string | null>(null);
  const openCatalogueDesign =
    openDesignId === null
      ? null
      : (designs.find((design) => design.design_id === openDesignId) ?? null);
  const verified = profile.verification_status === "verified";
  const canManage = canManageDashboard(currentUser.role);
  const workspaceGroups = canManage
    ? managementWorkspaceGroups
    : staffWorkspaceGroups;
  const filteredOrders = filterOrders(orders, orderFilter);
  const returnTo = `/dashboard/orders?orders=${orderFilter}`;
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
    const target = order.agreed_total_minor ?? order.payment_amount_minor ?? 0;
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
  const storefrontURL = `https://${profile.handle}.xtiitch.com`;
  const nextFieldSequence =
    measurementFields.length === 0
      ? 1
      : Math.max(...measurementFields.map((field) => field.sequence)) + 1;
  const pageMeta = dashboardPageMeta(section);
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
      done: !storeSettings.measurements_enabled || measurementFields.length > 0,
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
  const railBadges: Partial<Record<DashboardSection, string | undefined>> =
    canManage
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: darkChrome ? alpha(tokens.ink, 0.96) : "background.default",
        backgroundImage: darkChrome
          ? `
            radial-gradient(circle at 100% 0%, ${alpha(tokens.burgundy, 0.2)}, transparent 30%),
            radial-gradient(circle at 58% 12%, ${alpha(tokens.info, 0.16)}, transparent 28%),
            linear-gradient(180deg, ${tokens.ink}, ${tokens.charcoal})
          `
          : `linear-gradient(${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px)`,
        backgroundSize: darkChrome ? "auto" : "36px 36px",
        overflowX: "hidden",
        "@keyframes dashboardRailSlide": {
          from: { opacity: 0, transform: "translateX(-16px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "@keyframes dashboardRailDrop": {
          from: { opacity: 0, transform: "translateY(-10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes dashboardSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      <Box
        sx={{
          maxWidth: 1500,
          width: "100%",
          boxSizing: "border-box",
          mx: "auto",
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          pl: {
            xs: 1.5,
            sm: 2.5,
            md: `calc(${railCollapsed ? dashboardRailCollapsedWidth : dashboardRailWidth}px + 40px)`,
            lg: `calc(${railCollapsed ? dashboardRailCollapsedWidth : dashboardRailWidth}px + 56px)`,
          },
          py: { xs: 1.5, lg: 3 },
          display: "grid",
          gap: { xs: 2, lg: 3 },
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "minmax(0, 1fr)",
          },
        }}
      >
        <WorkspaceRail
          profile={profile}
          currentUser={currentUser}
          verified={verified}
          workspaceGroups={workspaceGroups}
          section={section}
          storefrontURL={storefrontURL}
          badges={railBadges}
          collapsed={railCollapsed}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <Box
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "hidden",
            "@media (prefers-reduced-motion: no-preference)": {
              animation: "dashboardSurfaceIn 500ms ease both",
            },
          }}
        >
          <WorkspaceTopBar
            profile={profile}
            currentUser={currentUser}
            meta={pageMeta}
            verified={verified}
            collapsed={railCollapsed}
            darkChrome={darkChrome}
            notificationCount={pendingMessages}
            storefrontURL={storefrontURL}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onToggleCollapsed={() => setRailCollapsed((value) => !value)}
            onToggleDarkChrome={toggleMode}
          />

          <Box
            sx={{
              pt: { xs: 2, md: 2.5 },
              minWidth: 0,
              maxWidth: "100%",
              overflowX: "hidden",
            }}
          >
            <WorkspaceHeader
              meta={pageMeta}
              canManage={canManage}
              currentUser={currentUser}
              verified={verified}
              moneySummary={moneySummary}
              liveOrders={liveOrders}
              activeBookings={activeBookings}
              availabilityWindows={availabilityWindows}
              pendingPayments={pendingPayments}
              needsMeasurements={needsMeasurements}
              openHandovers={openHandovers}
              pendingMessages={pendingMessages}
            />

            {action.permissionError ? (
              <Alert severity="warning" sx={{ mb: 2.5 }}>
                {action.permissionError}
              </Alert>
            ) : null}
            {dataWarnings.length > 0 ? (
              <Stack spacing={1} sx={{ mb: 2.5 }}>
                {dataWarnings.slice(0, 5).map((warning) => (
                  <Alert key={warning} severity="warning">
                    {warning}
                  </Alert>
                ))}
              </Stack>
            ) : null}

            {section === "overview" || section === "tasks" ? (
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    xl: "repeat(4, 1fr)",
                  },
                }}
              >
                <MetricCard
                  icon={<ReceiptLongRounded />}
                  label="Live orders"
                  value={String(liveOrders.length)}
                  helper={
                    canManage
                      ? `${pendingPayments} awaiting payment`
                      : "Active production and fitting work"
                  }
                />
                {canManage ? (
                  <MetricCard
                    icon={<AccountBalanceWalletRounded />}
                    label="Net income"
                    value={formatGHS(moneySummary.net_income_minor)}
                    helper="Platform and manual takings"
                    tone={tokens.success}
                  />
                ) : (
                  <MetricCard
                    icon={<StraightenRounded />}
                    label="Measurements"
                    value={String(needsMeasurements)}
                    helper="Visit or shop captures waiting"
                    tone={tokens.burgundy}
                  />
                )}
                <MetricCard
                  icon={<CalendarMonthRounded />}
                  label="Visit queue"
                  value={String(activeBookings)}
                  helper="Held or booked home visits"
                  tone={tokens.info}
                />
                <MetricCard
                  icon={<LocalShippingRounded />}
                  label="Open handovers"
                  value={String(openHandovers)}
                  helper={`${readyForHandover} fulfilled orders ready`}
                  tone={tokens.warning}
                />
              </Box>
            ) : null}

            <Box sx={{ mt: 2.5 }}>
              {canManage && section === "reports" ? (
                <ReportsPanel
                  revenueBuckets={revenueBuckets}
                  stageMetrics={stageMetrics}
                  followUps={followUps}
                  totalRevenueMinor={sevenDayRevenueMinor}
                  completionRate={completionRate}
                  collectionRate={collectionRate}
                />
              ) : null}
              {!canManage && section === "tasks" ? (
                <StaffTaskPanel
                  orders={orders}
                  bookings={bookings}
                  handovers={handovers}
                  followUps={followUps}
                  needsMeasurements={needsMeasurements}
                  activeBookings={activeBookings}
                  openHandovers={openHandovers}
                  readyForHandover={readyForHandover}
                  pendingMessages={pendingMessages}
                />
              ) : null}
            </Box>

            <Box
              sx={{
                mt: 2.5,
                display: "grid",
                gap: { xs: 2.5, xl: 3 },
                gridTemplateColumns: {
                  xs: "1fr",
                  xl:
                    canManage && section === "overview"
                      ? "minmax(0, 1.35fr) minmax(320px, 0.65fr)"
                      : "1fr",
                },
                alignItems: "start",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack spacing={2.5}>
                  {canManage && section === "overview" ? (
                    <ManagementOverviewPanel rooms={overviewRooms} />
                  ) : null}

                  {canManage && section === "money" ? (
                    <MoneyPanel
                      summary={moneySummary}
                      takings={manualTakings}
                      orders={orders}
                      error={action.moneyError}
                    />
                  ) : null}

                  {canManage && section === "promotions" ? (
                    <PromotionPanel
                      promotions={promotions}
                      collections={collections}
                      designs={designs}
                      activeCount={activePromotions}
                      redeemedMinor={promoRedeemedMinor}
                      error={action.promotionError}
                    />
                  ) : null}

                  {section === "visits" ? (
                    <BookingQueuePanel
                      bookings={bookings}
                      error={action.bookingError}
                    />
                  ) : null}

                  {section === "orders" ? (
                    <Box id="orders">
                      <SectionHeader
                        eyebrow="Orders"
                        title="Production board"
                        helper={`${filteredOrders.length} of ${orders.length} orders in this view. Advance only confirmed orders; drafts wait for payment.`}
                        action={
                          <Stack
                            direction="row"
                            spacing={0.85}
                            useFlexGap
                            sx={{
                              maxWidth: "100%",
                              flexWrap: { xs: "nowrap", sm: "wrap" },
                              overflowX: { xs: "auto", sm: "visible" },
                              pb: { xs: 0.4, sm: 0 },
                              scrollbarWidth: "none",
                              "&::-webkit-scrollbar": { display: "none" },
                            }}
                          >
                            {orderFilters.map((filter) => {
                              const selected = orderFilter === filter.value;
                              const count = countOrders(orders, filter.value);
                              return (
                                <Button
                                  key={filter.value}
                                  component={RouterLink}
                                  to={`/dashboard/orders?orders=${filter.value}`}
                                  disableElevation
                                  sx={{
                                    flexShrink: 0,
                                    px: 1.5,
                                    py: 0.55,
                                    minHeight: 36,
                                    borderRadius: 999,
                                    textTransform: "none",
                                    fontWeight: 800,
                                    fontSize: 13,
                                    lineHeight: 1,
                                    color: selected ? tokens.white : tokens.ink,
                                    bgcolor: selected
                                      ? tokens.burgundy
                                      : alpha(tokens.ink, 0.045),
                                    border: "1px solid",
                                    borderColor: selected
                                      ? tokens.burgundy
                                      : alpha(tokens.ink, 0.1),
                                    boxShadow: selected
                                      ? `0 6px 16px ${alpha(tokens.burgundy, 0.26)}`
                                      : "none",
                                    transition:
                                      "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
                                    "&:hover": {
                                      bgcolor: selected
                                        ? tokens.burgundy
                                        : alpha(tokens.burgundy, 0.08),
                                      borderColor: selected
                                        ? tokens.burgundy
                                        : alpha(tokens.burgundy, 0.3),
                                    },
                                  }}
                                >
                                  <Stack
                                    direction="row"
                                    spacing={0.75}
                                    sx={{ alignItems: "center" }}
                                  >
                                    <Box component="span">{filter.label}</Box>
                                    <Box
                                      component="span"
                                      sx={{
                                        minWidth: 20,
                                        height: 20,
                                        px: 0.5,
                                        borderRadius: 999,
                                        display: "grid",
                                        placeItems: "center",
                                        fontSize: 11,
                                        fontWeight: 900,
                                        color: selected
                                          ? tokens.white
                                          : alpha(tokens.ink, 0.55),
                                        bgcolor: selected
                                          ? alpha(tokens.white, 0.24)
                                          : alpha(tokens.ink, 0.08),
                                      }}
                                    >
                                      {count}
                                    </Box>
                                  </Stack>
                                </Button>
                              );
                            })}
                          </Stack>
                        }
                      />

                      {canManage ? (
                        <Box sx={{ mt: 2 }}>
                          <WalkInOrderPanel
                            designs={designs}
                            sizeBands={sizeBands}
                            error={action.walkInError}
                          />
                        </Box>
                      ) : null}

                      <Box
                        sx={{
                          mt: 2,
                          display: "grid",
                          gap: 1.25,
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, minmax(0, 1fr))",
                            xl: "repeat(4, minmax(0, 1fr))",
                          },
                        }}
                      >
                        <MiniStat
                          icon={<ReceiptLongRounded fontSize="small" />}
                          label="In this view"
                          value={String(filteredOrders.length)}
                          helper={`${orders.length} total orders`}
                          tone={tokens.burgundy}
                        />
                        <MiniStat
                          icon={<PaymentsRounded fontSize="small" />}
                          label="Draft pay"
                          value={String(pendingPayments)}
                          helper="Waiting for checkout"
                          tone={tokens.warning}
                        />
                        <MiniStat
                          icon={<StraightenRounded fontSize="small" />}
                          label="Measurements"
                          value={String(needsMeasurements)}
                          helper="Visit or shop captures"
                          tone={tokens.info}
                        />
                        <MiniStat
                          icon={<LocalShippingRounded fontSize="small" />}
                          label="Ready handover"
                          value={String(readyForHandover)}
                          helper="Fulfilled and waiting"
                          tone={tokens.success}
                        />
                      </Box>

                      <Stack spacing={1.5} sx={{ mt: 2 }}>
                        {action.orderError ? (
                          <Alert severity="warning">{action.orderError}</Alert>
                        ) : null}
                        {action.measurementError ? (
                          <Alert severity="warning">
                            {action.measurementError}
                          </Alert>
                        ) : null}
                        {filteredOrders.length === 0 ? (
                          <EmptyState
                            icon={<CheckCircleRounded sx={{ fontSize: 42 }} />}
                            title="No orders in this view"
                            helper="New checkout, custom, and walk-in orders will land here as soon as they are created."
                          />
                        ) : (
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1.75,
                              alignItems: "stretch",
                              gridTemplateColumns: {
                                xs: "1fr",
                                lg: "repeat(auto-fit, minmax(min(430px, 100%), 1fr))",
                              },
                            }}
                          >
                            {filteredOrders.map((order) => (
                              <OrderCard
                                key={order.order_id}
                                order={order}
                                returnTo={returnTo}
                                measurementFields={measurementFields}
                                showMoneyDetails={canManage}
                              />
                            ))}
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  ) : null}

                  {section === "handovers" ? (
                    <HandoverPanel
                      handovers={handovers}
                      orders={orders}
                      error={action.handoverError}
                    />
                  ) : null}

                  {canManage && section === "catalogue" ? (
                    <Box id="catalogue">
                      <SectionHeader
                        eyebrow="Catalogue"
                        title="Design studio"
                        helper="Add storefront designs, retire unavailable pieces, and keep product imagery tidy."
                      />
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          mt: 2,
                          flexWrap: "wrap",
                          gap: 1,
                          alignItems: "center",
                        }}
                      >
                        <Button
                          variant={
                            !openCatalogueDesign && catalogueView === "all"
                              ? "contained"
                              : "outlined"
                          }
                          onClick={() => {
                            setOpenDesignId(null);
                            setCatalogueView("all");
                          }}
                          startIcon={<DesignServicesRounded />}
                        >
                          All designs ({designs.length})
                        </Button>
                        <Button
                          variant={
                            !openCatalogueDesign && catalogueView === "add"
                              ? "contained"
                              : "outlined"
                          }
                          onClick={() => {
                            setOpenDesignId(null);
                            setCatalogueView("add");
                          }}
                          startIcon={<AddRounded />}
                        >
                          Add design
                        </Button>
                        {openCatalogueDesign ? (
                          <ToneChip
                            label={`Editing: ${openCatalogueDesign.title}`}
                            tone={tokens.burgundy}
                          />
                        ) : null}
                      </Stack>

                      {openCatalogueDesign ? (
                        <Box sx={{ mt: 2 }}>
                          <Button
                            onClick={() => setOpenDesignId(null)}
                            startIcon={<ArrowBackRounded />}
                            sx={{ mb: 1.5 }}
                          >
                            All designs
                          </Button>
                          <Panel>
                            <Box sx={{ p: { xs: 2, md: 2.5 }, pb: 1 }}>
                              <Typography
                                sx={{
                                  fontFamily: '"DM Serif Display", serif',
                                  fontSize: 22,
                                  lineHeight: 1.15,
                                }}
                              >
                                {openCatalogueDesign.title}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary" }}
                              >
                                Edit details, imagery, pricing, and availability
                                for this piece.
                              </Typography>
                            </Box>
                            <DesignRow
                              key={openCatalogueDesign.design_id}
                              design={openCatalogueDesign}
                              collections={collections}
                              defaultOpen
                            />
                          </Panel>
                        </Box>
                      ) : catalogueView === "add" ? (
                        <Box
                          sx={{
                            mt: 2,
                            display: "grid",
                            gap: 2,
                            alignItems: "start",
                            gridTemplateColumns: {
                              xs: "1fr",
                              lg: "minmax(0, 0.55fr) minmax(0, 0.45fr)",
                            },
                          }}
                        >
                          <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
                            <Stack
                              direction="row"
                              spacing={1.25}
                              sx={{ alignItems: "center", mb: 2 }}
                            >
                              <Box sx={{ color: "primary.main" }}>
                                <ContentCutRounded />
                              </Box>
                              <Box>
                                <Typography sx={{ fontWeight: 900 }}>
                                  Add a design
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ color: "text.secondary" }}
                                >
                                  Publish a new piece to the storefront.
                                </Typography>
                              </Box>
                            </Stack>
                            <Form method="post" encType="multipart/form-data">
                              <input
                                type="hidden"
                                name="intent"
                                value="create"
                              />
                              <Stack spacing={1.75}>
                                {action.designError ? (
                                  <Alert severity="error">
                                    {action.designError}
                                  </Alert>
                                ) : null}
                                <TextField
                                  name="title"
                                  label="Title"
                                  required
                                  fullWidth
                                />
                                <TextField
                                  name="collection_id"
                                  label="Collection"
                                  select
                                  defaultValue=""
                                  fullWidth
                                >
                                  <MenuItem value="">No collection</MenuItem>
                                  {collections
                                    .filter(
                                      (collection) =>
                                        collection.status === "active",
                                    )
                                    .map((collection) => (
                                      <MenuItem
                                        key={collection.collection_id}
                                        value={collection.collection_id}
                                      >
                                        {collection.name}
                                      </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                  name="description"
                                  label="Description"
                                  fullWidth
                                  multiline
                                  minRows={3}
                                />
                                <Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: "text.secondary",
                                      fontWeight: 700,
                                      display: "block",
                                      mb: 0.5,
                                    }}
                                  >
                                    Design image
                                  </Typography>
                                  <ImageDropzone
                                    name="image_file"
                                    helper="JPG, PNG, or WebP up to 10 MB — uploaded to your gallery as the first catalogue image."
                                  />
                                </Box>
                                <Box
                                  sx={{
                                    display: "grid",
                                    gap: 1.25,
                                    gridTemplateColumns: {
                                      xs: "1fr",
                                      sm: "repeat(2, 1fr)",
                                    },
                                  }}
                                >
                                  <TextField
                                    name="sequence"
                                    label="Display order"
                                    type="number"
                                    defaultValue={designs.length + 1}
                                    slotProps={{ htmlInput: { min: 0 } }}
                                  />
                                  <TextField
                                    name="deposit_ghs"
                                    label="Custom deposit"
                                    slotProps={{
                                      input: {
                                        startAdornment: (
                                          <InputAdornment position="start">
                                            GHS
                                          </InputAdornment>
                                        ),
                                      },
                                      htmlInput: { inputMode: "decimal" },
                                    }}
                                  />
                                </Box>
                                <FormControlLabel
                                  control={<Checkbox name="customisation" />}
                                  label="Allow customisation"
                                />
                                <Button
                                  type="submit"
                                  variant="contained"
                                  startIcon={<AddRounded />}
                                >
                                  Add design
                                </Button>
                              </Stack>
                            </Form>
                          </Panel>
                          <DesignImageUploadPanel
                            designs={designs}
                            error={action.mediaError}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ mt: 2 }}>
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1.25,
                              gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2, minmax(0, 1fr))",
                                xl: "repeat(4, minmax(0, 1fr))",
                              },
                            }}
                          >
                            <MiniStat
                              icon={<StorefrontRounded fontSize="small" />}
                              label="Active pieces"
                              value={String(
                                designs.filter(
                                  (design) => design.status === "active",
                                ).length,
                              )}
                              helper={`${designs.length} total designs`}
                              tone={tokens.success}
                            />
                            <MiniStat
                              icon={<VisibilityRounded fontSize="small" />}
                              label="Collections"
                              value={String(publishedCollections)}
                              helper={`${collections.length} total collections`}
                              tone={tokens.info}
                            />
                            <MiniStat
                              icon={<ContentCutRounded fontSize="small" />}
                              label="Customisable"
                              value={String(
                                designs.filter(
                                  (design) => design.customisation_allowed,
                                ).length,
                              )}
                              helper="Available for bespoke requests"
                              tone={tokens.burgundy}
                            />
                            <MiniStat
                              icon={<StraightenRounded fontSize="small" />}
                              label="Size bands"
                              value={String(sizeBands.length)}
                              helper={`${cataloguePriceCount} prices set`}
                              tone={tokens.warning}
                            />
                          </Box>
                          {designs.length === 0 ? (
                            <Panel sx={{ mt: 2, p: { xs: 2.5, md: 3 } }}>
                              <EmptyState
                                icon={
                                  <DesignServicesRounded
                                    sx={{ fontSize: 38 }}
                                  />
                                }
                                title="No designs yet"
                                helper="Add your first design with an uploaded image so customers can browse the store."
                              />
                              <Box
                                sx={{
                                  mt: 2,
                                  display: "flex",
                                  justifyContent: "center",
                                }}
                              >
                                <Button
                                  variant="contained"
                                  startIcon={<AddRounded />}
                                  onClick={() => setCatalogueView("add")}
                                >
                                  Add a design
                                </Button>
                              </Box>
                            </Panel>
                          ) : (
                            <Box
                              sx={{
                                mt: 2,
                                display: "grid",
                                gap: 1.5,
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  sm: "repeat(2, minmax(0, 1fr))",
                                  md: "repeat(3, minmax(0, 1fr))",
                                  xl: "repeat(4, minmax(0, 1fr))",
                                },
                              }}
                            >
                              {designs.map((design) => (
                                <DesignCard
                                  key={design.design_id}
                                  design={design}
                                  collections={collections}
                                  onOpen={() =>
                                    setOpenDesignId(design.design_id)
                                  }
                                />
                              ))}
                            </Box>
                          )}
                          <Box sx={{ mt: 2 }}>
                            <CatalogueSetupPanel
                              collections={collections}
                              sizeBands={sizeBands}
                              collectionError={action.collectionError}
                              sizeBandError={action.sizeBandError}
                            />
                          </Box>
                          <Box sx={{ mt: 2 }}>
                            <PriceBoardPanel
                              designs={designs}
                              sizeBands={sizeBands}
                              error={action.priceError}
                            />
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : null}
                </Stack>
              </Box>

              <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                {canManage && section === "measurements" ? (
                  <Panel id="measurements">
                    <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{ alignItems: "center" }}
                      >
                        <Box sx={{ color: "primary.main" }}>
                          <StraightenRounded />
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 900 }}>
                            Measurement setup
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            Define the fields used for self, visit, and shop
                            measurements.
                          </Typography>
                        </Box>
                      </Stack>
                      {action.fieldError ? (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                          {action.fieldError}
                        </Alert>
                      ) : null}
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="create_measurement_field"
                        />
                        <Box
                          sx={{
                            mt: 2,
                            display: "grid",
                            gap: 1.25,
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "minmax(0, 1fr) 96px 96px",
                            },
                          }}
                        >
                          <TextField
                            name="label"
                            label="Field label"
                            placeholder="Chest"
                            size="small"
                            required
                          />
                          <TextField
                            name="unit"
                            label="Unit"
                            select
                            defaultValue="in"
                            size="small"
                          >
                            {fieldUnits.map((unit) => (
                              <MenuItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            name="sequence"
                            label="Order"
                            type="number"
                            defaultValue={nextFieldSequence}
                            size="small"
                            slotProps={{ htmlInput: { min: 0 } }}
                            required
                          />
                        </Box>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<AddRounded />}
                          sx={{ mt: 1.5 }}
                        >
                          Add field
                        </Button>
                      </Form>
                    </Box>

                    {measurementFields.length === 0 ? (
                      <Box sx={{ px: 2.5, pb: 2.5 }}>
                        <EmptyState
                          icon={<StraightenRounded sx={{ fontSize: 38 }} />}
                          title="No measurement fields yet"
                          helper="Add fields such as chest, waist, sleeve, and length before staff record visit or shop measurements."
                        />
                      </Box>
                    ) : (
                      measurementFields.map((field) => (
                        <MeasurementFieldRow
                          key={field.field_id}
                          field={field}
                        />
                      ))
                    )}
                  </Panel>
                ) : null}

                {canManage && section === "availability" ? (
                  <AvailabilityPanel
                    windows={availabilityWindows}
                    error={action.availabilityError}
                  />
                ) : null}

                {canManage && section === "settings" ? (
                  <StoreSettingsPanel
                    settings={storeSettings}
                    profile={profile}
                    error={action.settingsError}
                  />
                ) : null}

                {canManage && section === "team" ? (
                  <TeamPanel
                    users={businessUsers}
                    currentUser={currentUser}
                    error={action.teamError}
                  />
                ) : null}

                {section === "messages" ? (
                  <NotificationPanel notifications={notifications} />
                ) : null}

                {canManage && section === "overview" ? (
                  <>
                    <StoreReadinessPanel
                      steps={setupSteps}
                      storefrontURL={storefrontURL}
                    />
                    <TodayFocusPanel
                      pendingPayments={pendingPayments}
                      needsMeasurements={needsMeasurements}
                      openHandovers={openHandovers}
                      pendingMessages={pendingMessages}
                    />
                  </>
                ) : null}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
