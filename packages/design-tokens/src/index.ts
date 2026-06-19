// Aligned to Xtiitch-Brand-Guidelines v1.0 (XCreativs Technologies). Wine
// leads; Graphite is secondary text; Line is the border; red/amber/green are
// reserved for in-product order status, never decoration. Legacy names kept as
// aliases so existing app themes keep resolving.
export const xtiitchColors = {
  // Brand
  wine: "#800020",
  burgundy: "#800020",
  deepWine: "#5c0118",
  burgundyDark: "#5c0118",
  wineTint: "#f3e1e5",
  blush: "#f3e1e5",
  ink: "#15111a",
  cream: "#faf6f2",
  // Neutral
  graphite: "#565b63",
  mutedText: "#565b63",
  mauve: "#9a7a80",
  line: "#e7ded7",
  softBorder: "#e7ded7",
  white: "#ffffff",
  paper: "#ffffff",
  panel: "#fffaf7",
  charcoal: "#201923",
  gold: "#c58b2c",
  // Functional · order status (reserved — never decoration)
  statusReceived: "#c0392b",
  statusInProgress: "#b8860b",
  statusReady: "#1e8e4e",
  success: "#1e8e4e",
  warning: "#b8860b",
  danger: "#c0392b",
  info: "#315f8f",
} as const;

export type XtiitchThemeMode = "light" | "dark";

// Inter Tight is the single brand typeface (Brand Guidelines v1.0). Display
// weight is carried by size + weight (ExtraBold 800), not a separate face.
const interTightStack = [
  "Inter Tight",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

export const xtiitchFonts = {
  display: interTightStack,
  body: interTightStack,
  googleFontsHref:
    "https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap",
} as const;

export const xtiitchThemeColors = {
  light: {
    mode: "light",
    background: xtiitchColors.cream,
    surface: xtiitchColors.white,
    elevated: xtiitchColors.white,
    panel: xtiitchColors.panel,
    field: xtiitchColors.white,
    border: xtiitchColors.softBorder,
    borderStrong: "#d7c9c1",
    text: xtiitchColors.ink,
    textMuted: xtiitchColors.mutedText,
    textSubtle: "#746b76",
    primary: xtiitchColors.burgundy,
    primaryDark: xtiitchColors.deepWine,
    primarySoft: xtiitchColors.wineTint,
    secondary: xtiitchColors.ink,
    success: xtiitchColors.success,
    warning: xtiitchColors.warning,
    danger: xtiitchColors.danger,
    info: xtiitchColors.info,
    gold: xtiitchColors.gold,
    focusRing: "rgba(128, 0, 32, 0.12)",
    selectionBg: "rgba(128, 0, 32, 0.18)",
    selectionText: xtiitchColors.ink,
    gridLine: "rgba(128, 0, 32, 0.045)",
    scrollbarTrack: xtiitchColors.cream,
    shadow: "rgba(21, 17, 26, 0.12)",
  },
  dark: {
    mode: "dark",
    background: "#120d14",
    surface: "#1b1420",
    elevated: "#241b29",
    panel: "#201722",
    field: "#211822",
    border: "rgba(255, 247, 242, 0.12)",
    borderStrong: "rgba(255, 247, 242, 0.22)",
    text: "#fff7f2",
    textMuted: "rgba(255, 247, 242, 0.72)",
    textSubtle: "rgba(255, 247, 242, 0.56)",
    primary: "#b82a4b",
    primaryDark: "#7f0928",
    primarySoft: "rgba(184, 42, 75, 0.18)",
    secondary: "#f4d8c8",
    success: "#5dc884",
    warning: "#e0b65a",
    danger: "#f06c64",
    info: "#7fb1e8",
    gold: "#d6a24a",
    focusRing: "rgba(184, 42, 75, 0.28)",
    selectionBg: "rgba(184, 42, 75, 0.34)",
    selectionText: "#fff7f2",
    gridLine: "rgba(255, 247, 242, 0.05)",
    scrollbarTrack: "#120d14",
    shadow: "rgba(0, 0, 0, 0.48)",
  },
} as const satisfies Record<XtiitchThemeMode, Record<string, string>>;

export function getXtiitchThemeColors(mode: XtiitchThemeMode) {
  return xtiitchThemeColors[mode];
}

export const xtiitchRadii = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  control: 16,
  button: 999,
} as const;

export const xtiitchSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const xtiitchTypography = {
  pageTitle: { desktop: 32, mobile: 26 },
  sectionTitle: { desktop: 22, mobile: 20 },
  panelTitle: { desktop: 18, mobile: 17 },
  body: { desktop: 16, mobile: 16 },
  support: { desktop: 14, mobile: 14 },
  metadata: { desktop: 12, mobile: 12 },
} as const;
