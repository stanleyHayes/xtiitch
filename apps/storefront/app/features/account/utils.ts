import type { OtpChannel } from "./types";

export function normalizeChannel(raw: unknown): OtpChannel {
  return String(raw ?? "") === "email" ? "email" : "whatsapp";
}

// safeRedirect blocks open redirects: only same-site absolute paths are allowed.
// Default destination after sign-in/registration is the customer's own account
// interface (never the discover/AI-search page).
export function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/account";
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Deterministic UTC date format — avoids locale-driven SSR/client hydration drift.
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export type OrderStatusTone = "success" | "warning" | "primary" | "neutral";

export function orderStatus(status: string): {
  label: string;
  tone: OrderStatusTone;
} {
  const s = status.toLowerCase();
  if (["completed", "delivered", "fulfilled", "handed_over"].includes(s)) {
    return { label: "Completed", tone: "success" };
  }
  if (["cancelled", "canceled", "discarded", "refunded"].includes(s)) {
    return { label: "Cancelled", tone: "neutral" };
  }
  if (s === "draft") {
    return { label: "Awaiting payment", tone: "warning" };
  }
  return {
    label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    tone: "primary",
  };
}
