import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { ThemeProvider, type SxProps, type Theme } from "@mui/material/styles";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import { createAppTheme, tokens, type AppThemeMode } from "./theme";

const storageKey = "xtiitch.theme-mode";

type ThemeTransitionOrigin = { x: number; y: number };

type ThemeModeContextValue = {
  mode: AppThemeMode;
  isDark: boolean;
  setMode: (mode: AppThemeMode) => void;
  // origin (a click point) drives the dramatic circular reveal between themes.
  toggleMode: (origin?: ThemeTransitionOrigin) => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

// applyThemeTransition commits the new mode. When the browser supports the View
// Transitions API (and motion is allowed), it wipes the new theme in as a circle
// expanding from the toggle, instead of an instant flip.
function applyThemeTransition(
  commit: () => void,
  origin: ThemeTransitionOrigin | undefined,
) {
  const doc = typeof document !== "undefined" ? (document as ViewTransitionDocument) : undefined;
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!doc?.startViewTransition || prefersReduced || !origin) {
    commit();
    return;
  }

  const { x, y } = origin;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = doc.startViewTransition(() => {
    flushSync(commit);
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 560,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      /* transition was skipped/interrupted — the theme already committed */
    });
}

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

  // Light is the product default on every Xtiitch surface. We deliberately do
  // NOT fall back to the OS `prefers-color-scheme`: dark is opt-in, and only
  // ever via the theme toggle (which writes `storageKey` above).
  return "light";
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

  const commitMode = useCallback((nextMode: AppThemeMode) => {
    setModeState(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nextMode);
    }
  }, []);

  const setMode = useCallback(
    (nextMode: AppThemeMode) => commitMode(nextMode),
    [commitMode],
  );

  const toggleMode = useCallback(
    (origin?: ThemeTransitionOrigin) => {
      const nextMode = mode === "dark" ? "light" : "dark";
      applyThemeTransition(() => commitMode(nextMode), origin);
    },
    [commitMode, mode],
  );

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(
    () => ({ mode, isDark: mode === "dark", setMode, toggleMode }),
    [mode, setMode, toggleMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* Drive the circular reveal: suppress the default cross-fade so only
            our clip-path animation on the incoming snapshot shows. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              ::view-transition-old(root),
              ::view-transition-new(root) {
                animation: none;
                mix-blend-mode: normal;
              }
              ::view-transition-old(root) { z-index: 1; }
              ::view-transition-new(root) { z-index: 2147483646; }
            `,
          }}
        />
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
        onClick={(event) =>
          toggleMode({ x: event.clientX, y: event.clientY })
        }
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        size="small"
        sx={{
          color: "text.primary",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "50%",
          overflow: "hidden",
          "&:hover": { color: "primary.main", borderColor: "primary.main" },
          "& .MuiSvgIcon-root": {
            transition:
              "transform 560ms cubic-bezier(0.4, 0, 0.2, 1), opacity 240ms ease",
          },
          "&:active .MuiSvgIcon-root": { transform: "rotate(-30deg) scale(0.9)" },
          "@media (prefers-reduced-motion: reduce)": {
            "& .MuiSvgIcon-root": { transition: "none" },
          },
          ...sx,
        }}
      >
        {isDark ? (
          <LightModeRounded
            fontSize="small"
            sx={{ transform: "rotate(0deg)" }}
          />
        ) : (
          <DarkModeRounded
            fontSize="small"
            sx={{ transform: "rotate(360deg)" }}
          />
        )}
      </IconButton>
    </Tooltip>
  );
}
