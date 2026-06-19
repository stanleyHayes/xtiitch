import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { ThemeProvider, type SxProps, type Theme } from "@mui/material/styles";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import { createAppTheme, tokens, type AppThemeMode } from "./theme";

const storageKey = "xtiitch.theme-mode";

type ThemeModeContextValue = {
  mode: AppThemeMode;
  isDark: boolean;
  setMode: (mode: AppThemeMode) => void;
  toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(
  undefined,
);

function isThemeMode(value: string | null): value is AppThemeMode {
  return value === "light" || value === "dark";
}

function readPreferredMode(): AppThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedMode = window.localStorage.getItem(storageKey);
  if (isThemeMode(storedMode)) {
    return storedMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppThemeMode>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(readPreferredMode());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;

    const themeColor = mode === "dark" ? "#120d14" : tokens.burgundy;
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", themeColor);

    if (hydrated) {
      window.localStorage.setItem(storageKey, mode);
    }
  }, [hydrated, mode]);

  const setMode = useCallback((nextMode: AppThemeMode) => {
    setModeState(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nextMode);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current: AppThemeMode) => {
      const nextMode = current === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, nextMode);
      }
      return nextMode;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(
    () => ({ mode, isDark: mode === "dark", setMode, toggleMode }),
    [mode, setMode, toggleMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const value = useContext(ThemeModeContext);
  if (!value) {
    throw new Error("useThemeMode must be used inside ThemeModeProvider");
  }
  return value;
}

// Sun/moon switch wired to the provider. Safe to SSR: the provider starts in
// "light" on both server and first client paint, so the icon only flips inside
// a post-hydration effect — no hydration mismatch.
export function ThemeModeToggle({ sx }: { sx?: SxProps<Theme> }) {
  const { isDark, toggleMode } = useThemeMode();
  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton
        onClick={toggleMode}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        size="small"
        sx={{ color: "text.secondary", ...sx }}
      >
        {isDark ? (
          <LightModeRounded fontSize="small" />
        ) : (
          <DarkModeRounded fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
