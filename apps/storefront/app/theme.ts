import { createTheme, type Theme } from "@mui/material/styles";

// Mirrors packages/design-tokens and docs/design/style-guide.md. The storefront
// base is calm and trustworthy; each store applies its own brand colour on top.
// Aligned to Xtiitch-Brand-Guidelines v1.0. Order status (success/warning/
// danger) maps to the brand Ready/In-progress/Received colours.
export const tokens = {
  burgundy: "#800020", // Wine
  ink: "#15111a",
  cream: "#faf6f2",
  white: "#ffffff",
  softBorder: "#e7ded7", // Line
  mutedText: "#565b63", // Graphite
  success: "#1e8e4e", // Ready
  warning: "#b8860b", // In progress
  danger: "#c0392b", // Received
  info: "#315f8f",
  charcoal: "#201923",
} as const;

// Inter Tight is the single brand typeface.
const bodyFontStack = [
  "Inter Tight",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

const displayFontStack = bodyFontStack;

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
    h1: { fontFamily: displayFontStack, fontWeight: 800, letterSpacing: 0 },
    h2: { fontFamily: displayFontStack, fontWeight: 800, letterSpacing: 0 },
    h3: { fontFamily: displayFontStack, fontWeight: 800, letterSpacing: 0 },
    h4: { fontFamily: displayFontStack, fontWeight: 800, letterSpacing: 0 },
    h5: { fontFamily: displayFontStack, fontWeight: 800, letterSpacing: 0 },
    h6: { fontFamily: displayFontStack, fontWeight: 800, letterSpacing: 0 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: buttonRadius, minHeight: 44 } },
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
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${tokens.softBorder}`, borderRadius: 12 },
      },
    },
    MuiContainer: { defaultProps: { maxWidth: "lg" } },
  },
});
