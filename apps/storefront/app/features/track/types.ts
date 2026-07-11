import type { Tracking } from "../../lib/api";

export type Palette = { main: string; soft: string };

export type TrackingHandover = {
  method: "pickup" | "delivery" | string;
  status: "pending" | "dispatched" | "completed" | "cancelled" | string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  courier: string;
  note: string;
  updated_at: string;
};

export type TrackingWithHandover = Tracking & {
  handover?: TrackingHandover | null;
};
