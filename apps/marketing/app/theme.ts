import { createTheme, type Theme } from "@mui/material/styles";
import {
  getXtiitchThemeColors,
  xtiitchColors,
  xtiitchFonts,
  type XtiitchThemeMode,
} from "@xtiitch/design-tokens";

// Xtiitch brand tokens. These mirror packages/design-tokens (the cross-app
// source of truth) and docs/design/style-guide.md. Kept local so the marketing
// app builds without a workspace package build step; values must stay in sync.
// Aligned to Xtiitch-Brand-Guidelines v1.0. Wine leads; Graphite is secondary
// text; Line is the border; red/amber/green are reserved for order status.
export const tokens = {
  ...xtiitchColors,
  cocoa: "#35242d",
  brass: xtiitchColors.warning,
  leaf: xtiitchColors.success,
} as const;

export type AppThemeMode = XtiitchThemeMode;
export const fontStylesheetHref = xtiitchFonts.googleFontsHref;

const controlRadius = 8;
const buttonRadius = 999;

export function createAppTheme(mode: AppThemeMode = "light"): Theme {
  const colors = getXtiitchThemeColors(mode);

  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: colors.primary,
        dark: colors.primaryDark,
        contrastText: tokens.white,
      },
      secondary: { main: colors.secondary, contrastText: tokens.white },
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.danger },
      info: { main: colors.info },
      background: { default: colors.background, paper: colors.surface },
      text: { primary: colors.text, secondary: colors.textMuted },
      divider: colors.border,
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: xtiitchFonts.body,
      // The style guide forbids negative letter spacing and viewport-scaled type.
      h1: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        fontSize: "3rem",
        lineHeight: 1,
        letterSpacing: 0,
      },
      h2: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        fontSize: "2.35rem",
        lineHeight: 1.05,
        letterSpacing: 0,
      },
      h3: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        fontSize: "1.8rem",
        lineHeight: 1.08,
        letterSpacing: 0,
      },
      h4: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        fontSize: "1.25rem",
        lineHeight: 1.25,
        letterSpacing: 0,
      },
      h5: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        fontSize: "1.125rem",
        lineHeight: 1.3,
        letterSpacing: 0,
      },
      h6: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
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
          html: {
            overflowX: "hidden",
            // Glass-card fills read this; flips so the same rgba(var(--surface-rgb), a)
            // is near-white on light and a lifted dark panel on dark.
            "--surface-rgb": mode === "dark" ? "36, 27, 41" : "255, 255, 255",
          },
          body: {
            overflowX: "hidden",
            backgroundColor: colors.background,
            background: `linear-gradient(90deg, ${colors.gridLine} 1px, transparent 1px), linear-gradient(180deg, ${colors.gridLine} 1px, transparent 1px)`,
            backgroundSize: "34px 34px",
            color: colors.text,
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
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
            backgroundColor: colors.selectionBg,
            color: colors.selectionText,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            position: "relative",
            overflow: "hidden",
            borderRadius: buttonRadius,
            paddingInline: 20,
            minHeight: 44,
            boxShadow: "none",
            transition:
              "transform 200ms ease, box-shadow 220ms ease, background-color 180ms ease, border-color 180ms ease, color 180ms ease",
            "&:not(.Mui-disabled):hover": {
              transform: "translateY(-2px)",
            },
            "&:not(.Mui-disabled):active": {
              transform: "translateY(0)",
            },
            // outline (not box-shadow) so the focus ring isn't clipped by the
            // overflow:hidden that contains the shine sweep.
            "&.Mui-focusVisible": {
              outline: `3px solid ${colors.focusRing}`,
              outlineOffset: 2,
            },
            "@media (prefers-reduced-motion: reduce)": {
              transition: "background-color 180ms ease, color 180ms ease",
              "&:not(.Mui-disabled):hover": { transform: "none" },
            },
          },
          // A diagonal light sweep that glides across filled buttons on hover.
          contained: {
            "&::after": {
              content: '""',
              position: "absolute",
              top: 0,
              left: "-140%",
              width: "55%",
              height: "100%",
              background:
                "linear-gradient(120deg, transparent, rgba(255,255,255,0.42), transparent)",
              transform: "skewX(-18deg)",
              transition: "left 620ms cubic-bezier(0.4, 0, 0.2, 1)",
              pointerEvents: "none",
            },
            "&:not(.Mui-disabled):hover": {
              boxShadow: `0 16px 34px -18px ${colors.shadow}`,
              "&::after": { left: "150%" },
            },
            "@media (prefers-reduced-motion: reduce)": {
              "&::after": { display: "none" },
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
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            backgroundColor: colors.surface,
            boxShadow: `0 22px 60px -42px ${colors.shadow}`,
            transition:
              "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 240ms ease, border-color 240ms ease",
            // Baseline lift + wine-tinted glow on hover; components with their own
            // hover treatment override this.
            "&:hover": {
              transform: "translateY(-4px)",
              boxShadow: `0 32px 72px -44px ${colors.shadow}`,
              borderColor: "rgba(128,0,32,0.22)",
            },
            "@media (prefers-reduced-motion: reduce)": {
              transition: "border-color 200ms ease",
              "&:hover": { transform: "none" },
            },
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
              backgroundColor: colors.field,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: controlRadius,
            backgroundColor: colors.field,
            minHeight: 46,
            transition:
              "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
            "&.MuiInputBase-sizeSmall": { minHeight: 40 },
            "&.MuiInputBase-multiline": {
              minHeight: "auto",
              alignItems: "flex-start",
            },
            "&.Mui-focused": {
              boxShadow: `0 0 0 3px ${colors.focusRing}`,
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
}

export const theme: Theme = createAppTheme();
