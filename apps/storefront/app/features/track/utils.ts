import type { Palette } from "./types";

// Colour is the primary signal; it is always paired with a word and an icon so
// it never depends on colour alone (Spec 16.6).
const redPalette: Palette = { main: "#a92727", soft: "rgba(169,39,39,0.12)" };

const palettes: Record<string, Palette> = {
  red: redPalette,
  yellow: { main: "#b87914", soft: "rgba(184,121,20,0.14)" },
  green: { main: "#237a4b", soft: "rgba(35,122,75,0.14)" },
};

export const headline: Record<string, string> = {
  red: "Order received",
  yellow: "Being made",
  green: "Ready",
};

export const handoverStatusLabels: Record<string, string> = {
  pending: "Arranged",
  dispatched: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function paletteFor(colour: string): Palette {
  return palettes[colour] ?? redPalette;
}

export function formatHandoverMethod(method: string) {
  return method === "delivery" ? "Delivery" : "Pickup";
}

export function formatHandoverStatus(status: string) {
  return handoverStatusLabels[status] ?? "Handover";
}

