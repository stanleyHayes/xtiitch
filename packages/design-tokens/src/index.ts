// Aligned to Xtiitch-Brand-Guidelines v1.0 (XCreativs Technologies). Wine
// leads; Graphite is secondary text; Line is the border; red/amber/green are
// reserved for in-product order status, never decoration. Legacy names kept as
// aliases so existing app themes keep resolving.
export const xtiitchColors = {
  // Brand
  wine: "#800020",
  burgundy: "#800020",
  deepWine: "#5c0118",
  wineTint: "#f3e1e5",
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
  // Functional · order status (reserved — never decoration)
  statusReceived: "#c0392b",
  statusInProgress: "#b8860b",
  statusReady: "#1e8e4e",
  success: "#1e8e4e",
  warning: "#b8860b",
  danger: "#c0392b",
  info: "#315f8f",
} as const;

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
