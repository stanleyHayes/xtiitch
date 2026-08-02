import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import {
  MONEY_PERIOD_LABELS,
  type MoneyPeriod,
} from "../../../../src/businessOpsApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// "custom" is excluded: the mobile UI has no date-range picker.
const PERIODS = (Object.keys(MONEY_PERIOD_LABELS) as MoneyPeriod[]).filter(
  (value) => value !== "custom",
);

export function PeriodChips({
  period,
  onSelect,
}: {
  period: MoneyPeriod;
  onSelect: (next: MoneyPeriod) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {PERIODS.map((value) => {
        const active = value === period;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {MONEY_PERIOD_LABELS[value]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    row: { gap: spacing(1), paddingRight: spacing(1) },
    chip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      backgroundColor: palette.white,
    },
    chipActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.wineTint,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    chipTextActive: { color: palette.burgundy },
  });
