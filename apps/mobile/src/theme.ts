// Xtiitch brand system for the native customer surface, aligned to
// Xtiitch-Brand-Guidelines v1.0 (see apps/*/app/theme.ts). Wine leads; Graphite
// is secondary text; Line is the border; red/amber/green are reserved for order
// status. Web uses Fraunces for titles and Outfit for body/UI; native keeps
// platform fallbacks until those fonts are bundled through expo-font.
// The light/default palette. `onAccent` is text/icons that sit ON a brand or
// status colour (white on wine) — it stays light in dark mode, unlike `white`,
// which is a surface/card fill that flips dark.
export const lightPalette = {
  burgundy: "#800020", // Wine
  burgundyDeep: "#5c0118", // Deep Wine
  wineTint: "#f3e1e5",
  ink: "#15111a",
  cream: "#faf6f2",
  panel: "#fffaf7",
  white: "#ffffff",
  onAccent: "#ffffff",
  softBorder: "#e7ded7", // Line
  mutedText: "#565b63", // Graphite
  mauve: "#9a7a80",
  gold: "#c58b2c",
  success: "#1e8e4e", // order status · Ready
  warning: "#b8860b", // order status · In progress
  danger: "#c0392b", // order status · Received
  info: "#315f8f",
  elevated: "#ffffff",
  sunken: "#f2ebe6",
  scrim: "rgba(21,17,26,0.48)",
  hairline: "rgba(128,0,32,0.10)",
} as const;

export type Palette = { [K in keyof typeof lightPalette]: string };

// Dark palette. Surfaces (cream/panel/white) go dark, text (ink/mutedText) goes
// light, the wine accent lifts to a rosé so it reads on dark, and onAccent +
// status colours stay legible. Keys match lightPalette exactly.
export const darkPalette: Palette = {
  burgundy: "#c2546f",
  burgundyDeep: "#a83f5a",
  wineTint: "#2a1820",
  ink: "#f4eef0",
  cream: "#120d14",
  panel: "#1c151f",
  white: "#241b28",
  onAccent: "#ffffff",
  softBorder: "#33293a",
  mutedText: "#a99ba2",
  mauve: "#b08c93",
  gold: "#d9a648",
  success: "#3fae6c",
  warning: "#d2a32a",
  danger: "#e0685a",
  info: "#5b8cc0",
  elevated: "#2a202e",
  sunken: "#0d0910",
  scrim: "rgba(0,0,0,0.68)",
  hairline: "rgba(255,255,255,0.09)",
};

// Backwards-compatible default: modules that still import `palette` get the light
// values. Theme-aware screens read the active palette via useTheme() instead.
export const palette = lightPalette;

export const radius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const spacing = (units: number) => units * 8;

export const shadow = {
  card: {
    shadowColor: "#3b0010",
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  floating: {
    shadowColor: "#3b0010",
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 9,
  },
} as const;

export const typeScale = {
  display: { fontSize: 36, lineHeight: 40, letterSpacing: -1.2 },
  title: { fontSize: 26, lineHeight: 31, letterSpacing: -0.55 },
  heading: { fontSize: 20, lineHeight: 25, letterSpacing: -0.25 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 17, letterSpacing: 0.15 },
} as const;

export const motion = {
  pressScale: 0.975,
  quick: 140,
  standard: 260,
  deliberate: 380,
} as const;

export const fonts = {
  display: "Fraunces_700Bold",
  body: "Outfit_400Regular",
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
