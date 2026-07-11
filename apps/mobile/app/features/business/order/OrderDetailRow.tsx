import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type OrderDetailRowProps = {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
};

export default function OrderDetailRow({
  label,
  value,
  strong,
  tone,
}: OrderDetailRowProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          strong && styles.rowValueStrong,
          tone ? { color: tone } : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(2),
      paddingVertical: spacing(1.5),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.softBorder,
    },
    rowLabel: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
    },
    rowValue: {
      flex: 1,
      textAlign: "right",
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.ink,
    },
    rowValueStrong: { fontWeight: "800" },
  });
