import { createTheme, type Theme } from "@mui/material/styles";

// Xtiitch brand tokens. These mirror packages/design-tokens (the cross-app
// source of truth) and docs/design/style-guide.md. Kept local so the marketing
// app builds without a workspace package build step; values must stay in sync.
export const tokens = {
  burgundy: "#800020",
  burgundyDark: "#5c0017",
  ink: "#15111a",
  cream: "#faf6f2",
  white: "#ffffff",
  softBorder: "#e9ded6",
  mutedText: "#6f6672",
  success: "#237a4b",
  warning: "#b87914",
  danger: "#a92727",
  info: "#315f8f",
} as const;

const fontStack = [
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
    primary: {
      main: tokens.burgundy,
      dark: tokens.burgundyDark,
      contrastText: tokens.white,
    },
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
    // The style guide forbids negative letter spacing and viewport-scaled type.
    h1: {
      fontWeight: 800,
      fontSize: "2.5rem",
      lineHeight: 1.1,
      letterSpacing: 0,
    },
    h2: {
      fontWeight: 700,
      fontSize: "2rem",
      lineHeight: 1.15,
      letterSpacing: 0,
    },
    h3: {
      fontWeight: 700,
      fontSize: "1.5rem",
      lineHeight: 1.2,
      letterSpacing: 0,
    },
    h4: {
      fontWeight: 700,
      fontSize: "1.25rem",
      lineHeight: 1.25,
      letterSpacing: 0,
    },
    h5: {
      fontWeight: 600,
      fontSize: "1.125rem",
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    h6: {
      fontWeight: 600,
      fontSize: "1rem",
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    body1: { fontSize: "1rem", lineHeight: 1.6 },
    body2: { fontSize: "0.95rem", lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { overflowX: "hidden" },
        body: { overflowX: "hidden" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 20, minHeight: 44 },
        sizeLarge: { minHeight: 52, fontSize: "1rem", paddingInline: 28 },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: "lg" },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${tokens.softBorder}`, borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiLink: {
      defaultProps: { underline: "hover" },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true },
    },
  },
});
