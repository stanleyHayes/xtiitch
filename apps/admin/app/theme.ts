import { createTheme, type Theme } from "@mui/material/styles";

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
} as const;

const fontStack = [
  "Instrument Sans",
  "Inter",
  "Roboto",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Helvetica",
  "Arial",
  "sans-serif",
].join(", ");

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
    fontFamily: fontStack,
    h1: { fontWeight: 800, letterSpacing: 0 },
    h2: { fontWeight: 760, letterSpacing: 0 },
    h3: { fontWeight: 740, letterSpacing: 0 },
    h4: { fontWeight: 720, letterSpacing: 0 },
    h5: { fontWeight: 700, letterSpacing: 0 },
    h6: { fontWeight: 700, letterSpacing: 0 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8, minHeight: 40 } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
  },
});
