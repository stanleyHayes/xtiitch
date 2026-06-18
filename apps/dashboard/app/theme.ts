import { createTheme, type Theme } from "@mui/material/styles";

// Mirrors packages/design-tokens and docs/design/style-guide.md. The storefront
// base is calm and trustworthy; each store applies its own brand colour on top.
export const tokens = {
  burgundy: "#800020",
  ink: "#15111a",
  cream: "#faf6f2",
  white: "#ffffff",
  softBorder: "#e9ded6",
  mutedText: "#6f6672",
  success: "#237a4b",
  warning: "#b87914",
  danger: "#a92727",
  info: "#315f8f",
  panel: "#fffaf7",
  charcoal: "#201923",
  gold: "#c58b2c",
} as const;

const bodyFontStack = [
  "Instrument Sans",
  "Roboto",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

const displayFontStack = [
  "DM Serif Display",
  "Instrument Sans",
  "Roboto",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

const controlRadius = 16;
const buttonRadius = 999;

export const theme: Theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: { main: tokens.burgundy, contrastText: tokens.white },
    secondary: { main: tokens.ink, contrastText: tokens.white },
    success: { main: tokens.success },
    warning: { main: tokens.warning },
    error: { main: tokens.danger },
    info: { main: tokens.info },
    background: { default: tokens.cream, paper: tokens.white },
    text: { primary: tokens.ink, secondary: tokens.mutedText },
    divider: tokens.softBorder,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: bodyFontStack,
    h1: { fontFamily: displayFontStack, fontWeight: 400, letterSpacing: 0 },
    h2: { fontFamily: displayFontStack, fontWeight: 400, letterSpacing: 0 },
    h3: { fontFamily: displayFontStack, fontWeight: 400, letterSpacing: 0 },
    h4: { fontFamily: displayFontStack, fontWeight: 400, letterSpacing: 0 },
    h5: { fontFamily: displayFontStack, fontWeight: 400, letterSpacing: 0 },
    h6: { fontFamily: displayFontStack, fontWeight: 400, letterSpacing: 0 },
    button: { textTransform: "none", fontWeight: 760 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: buttonRadius, minHeight: 42 } },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.cream,
          textRendering: "optimizeLegibility",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          scrollbarColor: `${tokens.burgundy} ${tokens.cream}`,
        },
        "::selection": {
          backgroundColor: "rgba(128, 0, 32, 0.18)",
          color: tokens.ink,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${tokens.softBorder}`, borderRadius: 8 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 8, fontWeight: 760 } },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: controlRadius,
          backgroundColor: tokens.white,
          minHeight: 46,
          transition:
            "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
          "&.MuiInputBase-sizeSmall": { minHeight: 40 },
          "&.MuiInputBase-multiline": {
            minHeight: "auto",
            alignItems: "flex-start",
          },
          "&.Mui-focused": {
            boxShadow: `0 0 0 3px ${tokens.burgundy}1f`,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          borderRadius: controlRadius,
          overflow: "hidden",
          minHeight: 46,
          "&.MuiInputBase-sizeSmall": { minHeight: 40 },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": { borderRadius: controlRadius },
        },
      },
    },
    MuiContainer: { defaultProps: { maxWidth: "lg" } },
  },
});
