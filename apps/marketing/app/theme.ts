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
  blush: "#f3e5df",
  cocoa: "#35242d",
  brass: "#b87914",
  leaf: "#2f6b4f",
  success: "#237a4b",
  warning: "#b87914",
  danger: "#a92727",
  info: "#315f8f",
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
    fontFamily: bodyFontStack,
    // The style guide forbids negative letter spacing and viewport-scaled type.
    h1: {
      fontFamily: displayFontStack,
      fontWeight: 400,
      fontSize: "3rem",
      lineHeight: 1,
      letterSpacing: 0,
    },
    h2: {
      fontFamily: displayFontStack,
      fontWeight: 400,
      fontSize: "2.35rem",
      lineHeight: 1.05,
      letterSpacing: 0,
    },
    h3: {
      fontFamily: displayFontStack,
      fontWeight: 400,
      fontSize: "1.8rem",
      lineHeight: 1.08,
      letterSpacing: 0,
    },
    h4: {
      fontFamily: displayFontStack,
      fontWeight: 400,
      fontSize: "1.25rem",
      lineHeight: 1.25,
      letterSpacing: 0,
    },
    h5: {
      fontFamily: displayFontStack,
      fontWeight: 400,
      fontSize: "1.125rem",
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    h6: {
      fontFamily: displayFontStack,
      fontWeight: 400,
      fontSize: "1rem",
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    body1: { fontSize: "1rem", lineHeight: 1.7 },
    body2: { fontSize: "0.95rem", lineHeight: 1.65 },
    button: { textTransform: "none", fontWeight: 800, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { overflowX: "hidden" },
        body: {
          overflowX: "hidden",
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.025) 1px, transparent 1px), linear-gradient(180deg, rgba(21,17,26,0.018) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        },
        "@keyframes xtiitch-rise-in": {
          "0%": { opacity: 0, transform: "translate3d(0, 18px, 0)" },
          "100%": { opacity: 1, transform: "translate3d(0, 0, 0)" },
        },
        "@keyframes xtiitch-fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "@keyframes xtiitch-thread-drift": {
          "0%": { backgroundPosition: "0 0, 0 0, 0 0" },
          "100%": { backgroundPosition: "42px 0, 0 42px, 14px 14px" },
        },
        "@keyframes xtiitch-hero-zoom": {
          "0%": { transform: "scale(1.035)" },
          "100%": { transform: "scale(1)" },
        },
        "@keyframes xtiitch-float-mark": {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" },
        },
        "@keyframes xtiitch-status-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(184,121,20,0.2)" },
          "50%": { boxShadow: "0 0 0 9px rgba(184,121,20,0)" },
        },
        "@keyframes xtiitch-spotlight-drift": {
          "0%, 100%": { transform: "translate3d(-8%, 3%, 0) scale(1)" },
          "50%": { transform: "translate3d(8%, -4%, 0) scale(1.08)" },
        },
        "@keyframes xtiitch-ticker": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-50%, 0, 0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.001ms !important",
            animationIterationCount: "1 !important",
            scrollBehavior: "auto !important",
            transitionDuration: "0.001ms !important",
          },
        },
        "::selection": {
          backgroundColor: tokens.burgundy,
          color: tokens.white,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: buttonRadius,
          paddingInline: 20,
          minHeight: 44,
          boxShadow: "none",
          transition:
            "transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease, color 180ms ease",
          "&:not(.Mui-disabled):hover": {
            transform: "translateY(-1px)",
          },
          "&.Mui-focusVisible": {
            boxShadow: `0 0 0 3px ${tokens.burgundy}24`,
          },
        },
        sizeLarge: {
          borderRadius: buttonRadius,
          minHeight: 52,
          fontSize: "1rem",
          paddingInline: 28,
        },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: "lg" },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.softBorder}`,
          borderRadius: 8,
          boxShadow: "0 22px 60px -42px rgba(21,17,26,0.42)",
          transition:
            "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 800, borderRadius: 8 } },
    },
    MuiLink: {
      defaultProps: { underline: "hover" },
      styleOverrides: {
        root: {
          transition: "color 180ms ease, background-color 180ms ease",
        },
      },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: controlRadius,
            backgroundColor: tokens.white,
          },
        },
      },
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
  },
});
