import { Form, Link as RouterLink, redirect } from "react-router";
import type { ReactElement, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import QueryStatsRounded from "@mui/icons-material/QueryStatsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
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
import type { Design } from "../lib/api";
import { formatGHS } from "../lib/format";
import { tokens } from "../theme";

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
  | "measurements"
  | "availability"
  | "messages";

type WorkspaceNavItem = {
  href: string;
  section: DashboardSection;
  label: string;
  icon: ReactNode;
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
  fieldError?: string;
  measurementError?: string;
  moneyError?: string;
  bookingError?: string;
  handoverError?: string;
  availabilityError?: string;
};

type DashboardPageMeta = {
  eyebrow: string;
  title: string;
  helper: string;
  icon: ReactNode;
  tone: string;
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
    icon: <TuneRounded />,
  },
  {
    href: "/dashboard/reports",
    section: "reports",
    label: "Reports",
    icon: <QueryStatsRounded />,
  },
  {
    href: "/dashboard/orders",
    section: "orders",
    label: "Orders",
    icon: <TimelineRounded />,
  },
  {
    href: "/dashboard/money",
    section: "money",
    label: "Money",
    icon: <AccountBalanceWalletRounded />,
  },
  {
    href: "/dashboard/visits",
    section: "visits",
    label: "Visits",
    icon: <CalendarMonthRounded />,
  },
  {
    href: "/dashboard/handovers",
    section: "handovers",
    label: "Handovers",
    icon: <LocalShippingRounded />,
  },
  {
    href: "/dashboard/catalogue",
    section: "catalogue",
    label: "Catalogue",
    icon: <DesignServicesRounded />,
  },
  {
    href: "/dashboard/measurements",
    section: "measurements",
    label: "Measurements",
    icon: <StraightenRounded />,
  },
  {
    href: "/dashboard/availability",
    section: "availability",
    label: "Availability",
    icon: <ScheduleRounded />,
  },
  {
    href: "/dashboard/messages",
    section: "messages",
    label: "Messages",
    icon: <NotificationsRounded />,
  },
];

const staffWorkspaceNav: WorkspaceNavItem[] = [
  {
    href: "/dashboard",
    section: "tasks",
    label: "Tasks",
    icon: <TuneRounded />,
  },
  {
    href: "/dashboard/orders",
    section: "orders",
    label: "Orders",
    icon: <TimelineRounded />,
  },
  {
    href: "/dashboard/visits",
    section: "visits",
    label: "Visits",
    icon: <CalendarMonthRounded />,
  },
  {
    href: "/dashboard/handovers",
    section: "handovers",
    label: "Handovers",
    icon: <LocalShippingRounded />,
  },
  {
    href: "/dashboard/messages",
    section: "messages",
    label: "Messages",
    icon: <NotificationsRounded />,
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

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const orderFilter = parseOrderFilter(url.searchParams.get("orders"));
  const [profileResponse, currentUserResponse] = await Promise.all([
    apiFetch(request, "/businesses/me"),
    apiFetch(request, "/auth/business/me"),
  ]);
  const profile = (await profileResponse.json()) as Profile;
  const currentUser = (await currentUserResponse.json()) as CurrentUser;
  const canManage = canManageDashboard(currentUser.role);
  const section = parseDashboardSection(params.section, canManage);

  const [
    ordersResponse,
    fieldsResponse,
    bookingsResponse,
    handoversResponse,
    notificationsResponse,
  ] = await Promise.all([
    apiFetch(request, "/orders"),
    apiFetch(request, "/measurement-fields"),
    apiFetch(request, "/bookings"),
    apiFetch(request, "/handovers"),
    apiFetch(request, "/notifications"),
  ]);
  const ordersData = (await ordersResponse.json()) as {
    orders: OrderSummary[];
  };
  const fieldsData = (await fieldsResponse.json()) as {
    fields: MeasurementField[];
  };
  const bookingsData = (await bookingsResponse.json()) as {
    bookings: BookingSummary[];
  };
  const handoversData = (await handoversResponse.json()) as {
    handovers: HandoverSummary[];
  };
  const notificationsData = (await notificationsResponse.json()) as {
    notifications: NotificationSummary[];
  };

  let designs: Design[] = [];
  let moneySummary: MoneySummary = {
    through_platform_minor: 0,
    commission_minor: 0,
    manual_takings_minor: 0,
    net_income_minor: 0,
  };
  let manualTakings: ManualTaking[] = [];
  let availabilityWindows: AvailabilityWindow[] = [];
  const orders = ordersData.orders ?? [];

  if (canManage) {
    const [
      designsResponse,
      moneySummaryResponse,
      takingsResponse,
      availabilityResponse,
    ] = await Promise.all([
      apiFetch(request, "/designs"),
      apiFetch(request, "/money/summary"),
      apiFetch(request, "/money/takings"),
      apiFetch(request, "/availability"),
    ]);
    const designsData = (await designsResponse.json()) as {
      designs: Design[];
    };
    const moneySummaryData =
      (await moneySummaryResponse.json()) as MoneySummary;
    const takingsData = (await takingsResponse.json()) as {
      takings: ManualTaking[];
    };
    const availabilityData = (await availabilityResponse.json()) as {
      windows: AvailabilityWindow[];
    };

    designs = designsData.designs ?? [];
    moneySummary = {
      through_platform_minor: moneySummaryData.through_platform_minor ?? 0,
      commission_minor: moneySummaryData.commission_minor ?? 0,
      manual_takings_minor: moneySummaryData.manual_takings_minor ?? 0,
      net_income_minor: moneySummaryData.net_income_minor ?? 0,
    };
    manualTakings = takingsData.takings ?? [];
    availabilityWindows = availabilityData.windows ?? [];
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
    section,
    orderFilter,
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

  if (intent === "create") {
    const imageUrl = String(form.get("image_url") ?? "").trim();
    const response = await apiFetch(request, "/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(form.get("title") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        customisation_allowed: form.get("customisation") === "on",
        images: imageUrl ? [imageUrl] : [],
      }),
    });
    if (!response.ok) {
      return {
        designError: "Could not create the design. A title is required.",
      };
    }
    return redirect("/dashboard/catalogue");
  }

  if (intent === "retire" || intent === "restore") {
    await apiFetch(
      request,
      `/designs/${String(form.get("id") ?? "")}/${intent}`,
      { method: "POST" },
    );
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
    "measurements",
    "availability",
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

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
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
        backgroundImage: `linear-gradient(135deg, ${alpha(tone, 0.075)}, transparent 42%)`,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto auto 0",
          width: "100%",
          height: 3,
          bgcolor: tone,
        },
      }}
    >
      <Stack
        spacing={2}
        sx={{ height: "100%", justifyContent: "space-between" }}
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
  workspaceItems,
  section,
  storefrontURL,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  verified: boolean;
  workspaceItems: WorkspaceNavItem[];
  section: DashboardSection;
  storefrontURL: string;
}) {
  return (
    <Panel
      sx={{
        p: 1.5,
        position: { lg: "sticky" },
        top: { lg: 24 },
        alignSelf: "start",
        minHeight: { lg: "calc(100vh - 48px)" },
        display: "flex",
        flexDirection: "column",
        bgcolor: alpha(tokens.white, 0.94),
        backdropFilter: "blur(14px)",
      }}
    >
      <Stack spacing={2} sx={{ flexGrow: 1 }}>
        <Box
          sx={{
            p: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: tokens.panel,
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(tokens.burgundy, 0.1),
                color: "primary.main",
                flexShrink: 0,
              }}
            >
              <StorefrontRounded />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900 }} noWrap>
                {profile.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                {profile.plan} plan · {profile.handle}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }}>
            <ToneChip
              label={verified ? "Verified" : "Needs review"}
              tone={verified ? tokens.success : tokens.warning}
              icon={
                verified ? <VerifiedUserRounded /> : <WarningAmberRounded />
              }
            />
            <ToneChip
              label={roleLabel(currentUser.role)}
              tone={roleTone(currentUser.role)}
            />
          </Stack>
        </Box>

        <Box>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: 900,
              px: 1,
              textTransform: "uppercase",
            }}
          >
            Workspace
          </Typography>
          <Stack spacing={0.65} sx={{ mt: 0.9 }}>
            {workspaceItems.map((item) => {
              const active = item.section === section;
              return (
                <Button
                  key={item.href}
                  component={RouterLink}
                  to={item.href}
                  startIcon={item.icon}
                  aria-current={active ? "page" : undefined}
                  sx={{
                    minHeight: 44,
                    justifyContent: "flex-start",
                    position: "relative",
                    overflow: "hidden",
                    color: active ? "primary.main" : "text.primary",
                    bgcolor: active
                      ? alpha(tokens.burgundy, 0.11)
                      : "transparent",
                    border: "1px solid",
                    borderColor: active
                      ? alpha(tokens.burgundy, 0.24)
                      : "transparent",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 7,
                      bottom: 7,
                      width: 3,
                      borderRadius: 4,
                      bgcolor: active ? tokens.burgundy : "transparent",
                    },
                    "& .MuiButton-startIcon": {
                      color: active ? "primary.main" : "text.secondary",
                    },
                    "&:hover": {
                      bgcolor: alpha(tokens.burgundy, 0.08),
                      borderColor: alpha(tokens.burgundy, 0.16),
                      color: "primary.main",
                      "& .MuiButton-startIcon": { color: "primary.main" },
                    },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Box>

        <Box sx={{ mt: "auto" }}>
          <Button
            component={MuiLink}
            href={storefrontURL}
            target="_blank"
            rel="noreferrer"
            variant="outlined"
            startIcon={<VisibilityRounded />}
            fullWidth
          >
            View storefront
          </Button>
          <Form method="post">
            <input type="hidden" name="intent" value="logout" />
            <Button
              type="submit"
              color="inherit"
              startIcon={<LogoutRounded />}
              fullWidth
              sx={{ mt: 1 }}
            >
              Log out
            </Button>
          </Form>
        </Box>
      </Stack>
    </Panel>
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
                bgcolor: alpha(tokens.white, 0.12),
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
        bgcolor: alpha(tokens.white, 0.085),
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

function ManagementOverviewPanel({ rooms }: { rooms: OverviewRoom[] }) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
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
          <Box
            key={room.href}
            sx={{
              p: 1.6,
              border: "1px solid",
              borderColor: alpha(room.tone, 0.2),
              borderRadius: 2,
              bgcolor: alpha(room.tone, 0.045),
              minWidth: 0,
              display: "grid",
              gap: 1.25,
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
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
              <Button
                component={RouterLink}
                to={room.href}
                size="small"
                endIcon={<ArrowForwardRounded />}
              >
                {room.actionLabel}
              </Button>
            </Stack>
          </Box>
        ))}
      </Box>
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
    <Panel sx={{ p: { xs: 2, md: 2.5 }, bgcolor: tokens.panel }}>
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              color: "primary.main",
              bgcolor: alpha(tokens.burgundy, 0.1),
              flexShrink: 0,
            }}
          >
            <TuneRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Today's focus</Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.75, color: "text.secondary" }}
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
            variant="outlined"
          >
            Drafts
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
      sx={{ p: { xs: 3, md: 5 }, textAlign: "center", borderStyle: "dashed" }}
    >
      <Box sx={{ color: "primary.main", mb: 1 }}>{icon}</Box>
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

  return (
    <Panel id={`order-${order.order_id}`} sx={{ p: { xs: 2, md: 2.5 } }}>
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
              <Form method="post">
                <input
                  type="hidden"
                  name="intent"
                  value="record_measurements"
                />
                <input type="hidden" name="order_id" value={order.order_id} />
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
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography sx={{ fontWeight: 800 }}>
                      {measurementSource === "visit"
                        ? "Visit measurements"
                        : "Shop measurements"}
                    </Typography>
                    <ToneChip
                      label={
                        measurementSource === "visit"
                          ? "Home visit"
                          : "Come to shop"
                      }
                      tone={tokens.info}
                    />
                  </Stack>
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
                        slotProps={{ htmlInput: { inputMode: "decimal" } }}
                      />
                    ))}
                  </Box>
                  <Button
                    type="submit"
                    variant="outlined"
                    startIcon={<SaveRounded />}
                    sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
                  >
                    Save measurements
                  </Button>
                </Stack>
              </Form>
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
        bgcolor: alpha(tone, 0.055),
        minWidth: 0,
      }}
    >
      <Box sx={{ color: tone, pt: 0.15 }}>{icon}</Box>
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

function DesignRow({ design }: { design: Design }) {
  const retired = design.status === "retired";
  return (
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
        borderTop: "1px solid",
        borderColor: "divider",
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
        {design.images[0] ? (
          <Box
            component="img"
            src={design.images[0]}
            alt=""
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <DesignServicesRounded />
        )}
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
          {design.customisation_allowed ? (
            <Chip size="small" variant="outlined" label="Customisable" />
          ) : null}
        </Stack>
      </Box>
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
          fullWidth
        >
          {retired ? "Restore" : "Retire"}
        </Button>
      </Form>
    </Box>
  );
}

function MeasurementFieldRow({ field }: { field: MeasurementField }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1fr) 96px 110px auto",
        },
        alignItems: "center",
        py: 1.5,
        px: { xs: 2, md: 2.5 },
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Form method="post" style={{ display: "contents" }}>
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
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}
        >
          <Tooltip title="Save field">
            <IconButton
              type="submit"
              color="primary"
              aria-label={`Save ${field.label}`}
            >
              <SaveRounded />
            </IconButton>
          </Tooltip>
        </Stack>
      </Form>
      <Form method="post">
        <input type="hidden" name="intent" value="delete_measurement_field" />
        <input type="hidden" name="field_id" value={field.field_id} />
        <Tooltip title="Delete field">
          <IconButton
            type="submit"
            color="error"
            aria-label={`Delete ${field.label}`}
          >
            <DeleteOutlineRounded />
          </IconButton>
        </Tooltip>
      </Form>
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
        bgcolor: alpha(tone, 0.055),
        minWidth: 0,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box sx={{ color: tone, display: "grid" }}>{icon}</Box>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 900 }}
        >
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ mt: 0.75, fontWeight: 900, overflowWrap: "anywhere" }}>
        {value}
      </Typography>
      {helper ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
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
        borderColor: "divider",
        borderRadius: 2,
        textAlign: "center",
        bgcolor: alpha(tokens.ink, 0.02),
      }}
    >
      <Box sx={{ color: "primary.main", mb: 0.75 }}>{icon}</Box>
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
                  href={item.href}
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
            <Button href="/dashboard/orders" size="small" variant="contained">
              Orders
            </Button>
            <Button href="/dashboard/visits" size="small" variant="outlined">
              Visits
            </Button>
            <Button href="/dashboard/handovers" size="small" variant="outlined">
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
                <Button href={item.href} size="small" variant="outlined">
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
          <ToneChip
            label={`${takings.length} manual entries`}
            tone={tokens.info}
          />
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

        <Divider sx={{ my: 2.25 }} />

        <Form method="post">
          <input type="hidden" name="intent" value="log_taking" />
          <Stack spacing={1.5}>
            {error ? <Alert severity="warning">{error}</Alert> : null}
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "minmax(120px, 0.22fr) minmax(140px, 0.22fr) minmax(0, 0.28fr) minmax(0, 0.28fr)",
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
                    {order.design_title} · {order.customer_name || "Customer"}
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
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddRounded />}
              sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
            >
              Log taking
            </Button>
          </Stack>
        </Form>
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
                      <TextField
                        name="slot_start"
                        label="New slot"
                        type="datetime-local"
                        size="small"
                        defaultValue={datetimeLocalValue(booking.slot_start)}
                        disabled={!canReschedule}
                        slotProps={{ inputLabel: { shrink: true } }}
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
        gap: 1,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "minmax(0, 1fr) 105px 105px 110px",
        },
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
        name="start"
        label="Start"
        type="time"
        size="small"
        defaultValue={window ? minutesToTime(window.start_minute) : ""}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        name="end"
        label="End"
        type="time"
        size="small"
        defaultValue={window ? minutesToTime(window.end_minute) : ""}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        name="slot_minutes"
        label="Slot"
        type="number"
        size="small"
        defaultValue={window?.slot_minutes ?? 60}
        slotProps={{ htmlInput: { min: 15, max: 480, step: 15 } }}
      />
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
    section,
    orderFilter,
  } = loaderData;
  const action = (actionData ?? {}) as DashboardActionData;
  const verified = profile.verification_status === "verified";
  const canManage = canManageDashboard(currentUser.role);
  const workspaceItems = canManage ? managementWorkspaceNav : staffWorkspaceNav;
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
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px)`,
        backgroundSize: "36px 36px",
      }}
    >
      <Box
        sx={{
          maxWidth: 1500,
          mx: "auto",
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          py: { xs: 1.5, lg: 3 },
          display: "grid",
          gap: { xs: 2, lg: 3 },
          gridTemplateColumns: { xs: "1fr", lg: "270px minmax(0, 1fr)" },
        }}
      >
        <WorkspaceRail
          profile={profile}
          currentUser={currentUser}
          verified={verified}
          workspaceItems={workspaceItems}
          section={section}
          storefrontURL={storefrontURL}
        />

        <Box sx={{ minWidth: 0 }}>
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
          />

          {action.permissionError ? (
            <Alert severity="warning" sx={{ mb: 2.5 }}>
              {action.permissionError}
            </Alert>
          ) : null}

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
                          spacing={1}
                          sx={{ flexWrap: "wrap" }}
                        >
                          {orderFilters.map((filter) => (
                            <Button
                              key={filter.value}
                              component={RouterLink}
                              to={`/dashboard/orders?orders=${filter.value}`}
                              size="small"
                              variant={
                                orderFilter === filter.value
                                  ? "contained"
                                  : "outlined"
                              }
                            >
                              {filter.label} (
                              {countOrders(orders, filter.value)})
                            </Button>
                          ))}
                        </Stack>
                      }
                    />

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
                        filteredOrders.map((order) => (
                          <OrderCard
                            key={order.order_id}
                            order={order}
                            returnTo={returnTo}
                            measurementFields={measurementFields}
                            showMoneyDetails={canManage}
                          />
                        ))
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
                    <Box
                      sx={{
                        mt: 2,
                        display: "grid",
                        gap: 2,
                        gridTemplateColumns: {
                          xs: "1fr",
                          lg: "minmax(320px, 0.44fr) minmax(0, 0.56fr)",
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
                        <Form method="post">
                          <input type="hidden" name="intent" value="create" />
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
                              name="description"
                              label="Description"
                              fullWidth
                              multiline
                              minRows={3}
                            />
                            <TextField
                              name="image_url"
                              label="Image URL"
                              fullWidth
                              placeholder="https://..."
                              slotProps={{
                                input: {
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <DesignServicesRounded fontSize="small" />
                                    </InputAdornment>
                                  ),
                                },
                              }}
                            />
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

                      <Panel>
                        <Box
                          sx={{
                            p: { xs: 2, md: 2.5 },
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 2,
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 900 }}>
                              Designs
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                            >
                              {designs.length} total pieces
                            </Typography>
                          </Box>
                          <ToneChip
                            label={`${designs.filter((design) => design.status === "active").length} active`}
                            tone={tokens.success}
                          />
                        </Box>
                        {designs.length === 0 ? (
                          <Box sx={{ px: 2.5, pb: 2.5 }}>
                            <EmptyState
                              icon={
                                <DesignServicesRounded sx={{ fontSize: 38 }} />
                              }
                              title="No designs yet"
                              helper="Add your first design with an image URL so customers can browse the store."
                            />
                          </Box>
                        ) : (
                          designs.map((design) => (
                            <DesignRow key={design.design_id} design={design} />
                          ))
                        )}
                      </Panel>
                    </Box>
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
                      <MeasurementFieldRow key={field.field_id} field={field} />
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

              {section === "messages" ? (
                <NotificationPanel notifications={notifications} />
              ) : null}

              {canManage && section === "overview" ? (
                <TodayFocusPanel
                  pendingPayments={pendingPayments}
                  needsMeasurements={needsMeasurements}
                  openHandovers={openHandovers}
                  pendingMessages={pendingMessages}
                />
              ) : null}
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
