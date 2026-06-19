import { createTheme, type Theme } from "@mui/material/styles";
import {
  getXtiitchThemeColors,
  xtiitchColors,
  xtiitchFonts,
  type XtiitchThemeMode,
} from "@xtiitch/design-tokens";

// Mirrors packages/design-tokens and docs/design/style-guide.md. The storefront
// base is calm and trustworthy; each store applies its own brand colour on top.
// Aligned to Xtiitch-Brand-Guidelines v1.0. Order status (success/warning/
// danger) maps to the brand Ready/In-progress/Received colours.
export const tokens = {
  ...xtiitchColors,
} as const;

export type AppThemeMode = XtiitchThemeMode;
export const fontStylesheetHref = xtiitchFonts.googleFontsHref;

const controlRadius = 16;
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
      h1: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        letterSpacing: 0,
      },
      h2: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        letterSpacing: 0,
      },
      h3: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        letterSpacing: 0,
      },
      h4: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        letterSpacing: 0,
      },
      h5: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        letterSpacing: 0,
      },
      h6: {
        fontFamily: xtiitchFonts.display,
        fontWeight: 800,
        letterSpacing: 0,
      },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode },
          body: {
            backgroundColor: colors.background,
            color: colors.text,
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          },
          "::selection": {
            backgroundColor: colors.selectionBg,
            color: colors.selectionText,
          },
        },
      },
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
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { border: `1px solid ${colors.border}`, borderRadius: 12 },
        },
      },
      MuiContainer: { defaultProps: { maxWidth: "lg" } },
    },
  });
}

export const theme: Theme = createAppTheme();
