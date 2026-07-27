import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

export type NewOrderType = "ready" | "bespoke";

const OPTIONS: { value: NewOrderType; label: string }[] = [
  { value: "ready", label: "Ready-made" },
  { value: "bespoke", label: "Bespoke" },
];

// Segmented pill toggle between a standard (ready-made) walk-in and a
// bespoke (made-to-measure) walk-in order.
export function OrderTypeToggle({
  value,
  onChange,
}: {
  value: NewOrderType;
  onChange: (next: NewOrderType) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: spacing(1) },
    pill: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.25),
      alignItems: "center",
      backgroundColor: palette.white,
    },
    pillActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    pillText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    pillTextActive: { color: palette.burgundy },
  });
