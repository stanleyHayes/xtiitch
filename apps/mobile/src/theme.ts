// Xtiitch brand system for the native customer surface, aligned to
// Xtiitch-Brand-Guidelines v1.0 (see apps/*/app/theme.ts). Wine leads; Graphite
// is secondary text; Line is the border; red/amber/green are reserved for order
// status. Web uses Fraunces for titles and Outfit for body/UI; native keeps
// platform fallbacks until those fonts are bundled through expo-font.
import { Platform } from "react-native";

export const palette = {
  burgundy: "#800020", // Wine
  burgundyDeep: "#5c0118", // Deep Wine
  wineTint: "#f3e1e5",
  ink: "#15111a",
  cream: "#faf6f2",
  panel: "#fffaf7",
  white: "#ffffff",
  softBorder: "#e7ded7", // Line
  mutedText: "#565b63", // Graphite
  mauve: "#9a7a80",
  gold: "#c58b2c",
  success: "#1e8e4e", // order status · Ready
  warning: "#b8860b", // order status · In progress
  danger: "#c0392b", // order status · Received
  info: "#315f8f",
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const spacing = (units: number) => units * 8;

export const shadow = {
  card: {
    shadowColor: palette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
} as const;

// Native-safe platform fallbacks. Web carries the actual Fraunces/Outfit pair.
const sansStack = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
}) as string;

export const fonts = {
  display: sansStack,
  body: sansStack,
} as const;

// Brand-coloured swatches used when a store has no images yet, so cards still
// feel intentional rather than empty.
export const swatches = [
  ["#800020", "#5e0018"],
  ["#c58b2c", "#9a6a1f"],
  ["#315f8f", "#22456a"],
  ["#237a4b", "#185737"],
  ["#7a4a8f", "#583268"],
] as const;

export function swatchFor(seed: string): readonly [string, string] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return swatches[hash % swatches.length];
}
