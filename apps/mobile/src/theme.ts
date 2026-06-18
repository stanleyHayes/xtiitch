// Xtiitch brand system for the native customer surface. Mirrors the burgundy /
// cream / gold palette used across the web apps (apps/*/app/theme.ts) so the
// phone app reads as the same product. Fonts fall back to the platform system
// face — the display weight is carried by size + weight, not a bundled font, to
// keep the runtime lean.
import { Platform } from "react-native";

export const palette = {
  burgundy: "#800020",
  burgundyDeep: "#5e0018",
  ink: "#15111a",
  cream: "#faf6f2",
  panel: "#fffaf7",
  white: "#ffffff",
  softBorder: "#e9ded6",
  mutedText: "#6f6672",
  gold: "#c58b2c",
  success: "#237a4b",
  warning: "#b87914",
  danger: "#a92727",
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

// A serif-leaning display stack for headings; the body stack stays neutral.
export const fonts = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Georgia, 'Times New Roman', serif",
  }) as string,
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  }) as string,
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
