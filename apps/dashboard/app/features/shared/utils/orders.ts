import type { Design } from "../../../lib/api";
import { tokens } from "../../../theme";
import { staffAllowedIntents, dashboardFallbackDesignImages } from "../constants";
import type { BusinessUser, HandoverSummary, OrderSummary } from "../types";
import { shortDate } from "./formatting";

export function canManageDashboard(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function canUseDashboardIntent(role: string, intent: string): boolean {
  if (canManageDashboard(role)) {
    return true;
  }
  return role === "staff" && staffAllowedIntents.has(intent);
}

export function stripStaffMoneyDetails(orders: OrderSummary[]): OrderSummary[] {
  return orders.map((order) => ({
    ...order,
    agreed_total_minor: null,
    settled_minor: 0,
    payment_amount_minor: null,
  }));
}

export function roleLabel(role: string): string {
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

export function roleTone(role: string): string {
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

export function rolePermissionMessage(role: string): string {
  if (role === "staff") {
    return "Staff can work orders, visits, measurements, and handovers. Money, catalogue, measurement setup, availability, and reports stay with owners or admins.";
  }
  return "Your current role cannot perform that dashboard action.";
}

export function businessUserErrorMessage(
  status: number,
  action: "create" | "update" | "reset" | "transfer",
  // The API's error code. Two different failures now answer 409, so status alone
  // cannot tell them apart: a duplicate email and the plan's seat cap. Callers
  // that do not pass it keep the previous duplicate-email wording.
  code?: string,
): string {
  if (status === 403) {
    return action === "transfer"
      ? "Only the current owner can transfer business ownership."
      : "Only owners and admins can manage team access.";
  }
  if (status === 409) {
    if (code === "plan_limit_exceeded") {
      return "You've reached your plan's limit on team members. Upgrade your plan to add more.";
    }
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

export function railBadge(count: number): string | undefined {
  return count > 0 ? String(count) : undefined;
}

export function fallbackDesignImage(design: Design): string {
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

export function whatsappHref(whatsapp: string, phone: string): string | null {
  const raw = (whatsapp || phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  let intl = digits;
  if (digits.startsWith("233") && digits.length === 12) {
    intl = digits;
  } else if (digits.startsWith("0") && digits.length === 10) {
    intl = "233" + digits.slice(1);
  } else if (digits.length === 9) {
    intl = "233" + digits;
  }
  return `https://wa.me/${intl}`;
}

export function orderInitials(order: OrderSummary): string {
  return (order.customer_name || order.design_title || "Order")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function businessUserInitials(user: BusinessUser): string {
  return (user.display_name || user.email || "Team")
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function businessUserJoinedLabel(user: BusinessUser): string {
  const created = shortDate(user.created_at);
  return created ? `Joined ${created}` : "Join date missing";
}

export function bookingTone(status: string): string {
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

export function handoverTone(status: string): string {
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

export function notificationTone(status: string): string {
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

export function messageKindLabel(kind: string): string {
  return kind
    .split("_")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

export function handoverActionLabel(handover: HandoverSummary): string {
  if (handover.method === "delivery" && handover.status === "pending") {
    return "Mark dispatched";
  }
  return "Mark completed";
}

export function canManageBooking(status: string): boolean {
  return status === "held" || status === "booked";
}

export function canAdvanceHandover(status: string): boolean {
  return status === "pending" || status === "dispatched";
}

export function optionListWithSelected(options: string[], selected: string): string[] {
  return selected && !options.includes(selected)
    ? [...options, selected].sort((a, b) => Number(a) - Number(b))
    : options;
}
