import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatGHS, type BandPrice } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type DesignSizeBandSelectorProps = {
  prices: BandPrice[];
  selectedBandId: string | null;
  onSelect: (sizeBandId: string) => void;
};

export default function DesignSizeBandSelector({
  prices,
  selectedBandId,
  onSelect,
}: DesignSizeBandSelectorProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  if (prices.length === 0) {
    return <Text style={styles.muted}>Price on request</Text>;
  }

  return (
    <View style={styles.bandRow}>
      {prices.map((band) => {
        const active = band.size_band_id === selectedBandId;
        const chart = band.chart ?? [];
        return (
          <Pressable
            key={band.size_band_id}
            onPress={() => onSelect(band.size_band_id)}
            style={[styles.band, active && styles.bandActive]}
          >
            <Text style={[styles.bandLabel, active && styles.bandLabelActive]}>
              {band.label}
            </Text>
            <Text style={[styles.bandPrice, active && styles.bandLabelActive]}>
              {formatGHS(band.price_minor)}
            </Text>
            {chart.length > 0 ? (
              <View style={styles.chartRow}>
                {chart.map((item, index) => (
                  <View key={`${item.name}-${index}`} style={styles.chartChip}>
                    <Text style={styles.chartChipText}>
                      {item.name}: {item.value} {item.unit}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    muted: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
    },
    bandRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.25) },
    band: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      backgroundColor: palette.white,
      minWidth: 96,
    },
    bandActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    bandLabel: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    bandLabelActive: { color: palette.burgundy },
    bandPrice: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: 2,
    },
    chartRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(0.75),
      marginTop: spacing(1),
    },
    chartChip: {
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.sm,
      paddingHorizontal: spacing(0.75),
      paddingVertical: 2,
    },
    chartChipText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: palette.mutedText,
    },
  });
