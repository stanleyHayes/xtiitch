import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Pressable, StyleSheet, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { darkPalette, lightPalette, type Palette } from "./theme";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "xtiitch.theme-mode";

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  palette: Palette;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          setOverride(stored);
        }
      })
      .catch(() => {
        /* first run / storage unavailable — fall back to the system scheme */
      });
  }, []);

  // Follow the device scheme until the user explicitly picks a mode.
  const mode: ThemeMode = override ?? (system === "dark" ? "dark" : "light");
  const palette = mode === "dark" ? darkPalette : lightPalette;

  // Dramatic cross-fade: flash a full-screen veil of the incoming background on
  // each theme change so the switch feels deliberate rather than an instant flip.
  const veil = useRef(new Animated.Value(0)).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    veil.setValue(1);
    Animated.timing(veil, {
      toValue: 0,
      duration: 460,
      useNativeDriver: true,
    }).start();
  }, [mode, veil]);

  const value = useMemo<ThemeContextValue>(() => {
    const setMode = (next: ThemeMode) => {
      setOverride(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch((error: unknown) => {
        void error;
      });
    };
    return {
      mode,
      isDark: mode === "dark",
      palette,
      setMode,
      toggle: () => setMode(mode === "dark" ? "light" : "dark"),
    };
  }, [mode, palette]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: palette.cream, opacity: veil, zIndex: 9999 },
        ]}
      />
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeModeProvider");
  }
  return ctx;
}

// Sun/moon switch for the navigation header. Sits on the wine header, so it uses
// onAccent for its icon. The dramatic cross-fade lives in the provider's veil.
export function ThemeToggle() {
  const { isDark, toggle, palette } = useTheme();
  return (
    <Pressable
      onPress={toggle}
      hitSlop={12}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ paddingHorizontal: 10, paddingVertical: 6 }}
    >
      <Ionicons
        name={isDark ? "sunny-outline" : "moon-outline"}
        size={21}
        color={palette.onAccent}
      />
    </Pressable>
  );
}
