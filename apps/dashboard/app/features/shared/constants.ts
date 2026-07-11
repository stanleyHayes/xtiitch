import { tokens } from "../../theme";
import { StoreSettings, MoneySummary, OrderFilter } from "./types";

export const dashboardRailWidth = 304;

export const dashboardRailCollapsedWidth = 88;

export const dashboardFallbackDesignImages = [
  "/images/dashboard-atelier-review.webp",
  "/images/dashboard-fitting.webp",
  "/images/dashboard-atelier-hero.webp",
];

export const defaultStoreSettings: StoreSettings = {
  bespoke_enabled: false,
  measurements_enabled: false,
  customisation_enabled: false,
  collections_enabled: false,
  delivery_enabled: false,
  dispatch_enabled: false,
  fee_pass_to_buyer: false,
  brand_color: tokens.burgundy,
  logo_url: "",
  banner_url: "",
  layout_variant: "standard",
};

export const defaultMoneySummary: MoneySummary = {
  through_platform_minor: 0,
  commission_minor: 0,
  manual_takings_minor: 0,
  offline_commission_due_minor: 0,
  net_income_minor: 0,
};

export const orderFilters: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
  { value: "draft", label: "Awaiting pay" },
  { value: "confirmed", label: "In studio" },
  { value: "fulfilled", label: "Fulfilled" },
];

export const dayMs = 24 * 60 * 60 * 1000;

export const DASHBOARD_PAGE_SIZE = 8;

export const SIZE_CHART_UNITS = ["cm", "in", "inches", "mm", "m", "ft"];

export const fieldUnits = [
  { value: "in", label: "in" },
  { value: "cm", label: "cm" },
];

export const manualTakingMethods = [
  { value: "cash", label: "Cash" },
  { value: "momo", label: "Mobile money" },
  { value: "other", label: "Other" },
];

export const businessUserRoleOptions = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
];

export const handoverMethods = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
];

export const weekdays = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const AVAILABILITY_RECURRENCES = [
  "daily",
  "weekly",
  "monthly",
  "ongoing",
  "date",
];

export const monthOptions = [
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

export const hourOptions = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);

export const defaultMinuteOptions = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);

export const periodOptions = ["AM", "PM"] as const;

export const ORDER_STAGE_RANK: Record<string, number> = {
  "Order placed": 10,
  "Order received": 11,
  Preparing: 20,
  "Being made": 21,
  "Ready for fitting": 30,
  "Ready / delivered": 40,
};

export const staffAllowedIntents = new Set([
  "advance",
  "record_measurements",
  "cancel_booking",
  "reschedule_booking",
  "arrange_handover",
  "advance_handover",
  "cancel_handover",
]);

export const dashboardActionIntents = new Set([
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
  "mark_blackout",
  "clear_blackout",
  "create_measurement_field",
  "update_measurement_field",
  "delete_measurement_field",
  "update_waitlist_status",
  "create_business_user",
  "update_business_user",
  "reset_business_user_password",
  "transfer_owner",
  "save_store_settings",
  "create_delivery_zone",
  "update_delivery_zone",
  "delete_delivery_zone",
  "submit_identity_verification",
  "setup_payout",
  "create_collection",
  "retire_collection",
  "restore_collection",
  "update_collection",
  "delete_collection",
  "create_size_band",
  "update_size_band",
  "delete_size_band",
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