import { useMemo } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../../src/theme-mode";
import { makeStyles } from "./business-dashboard.styles";

export function Kpi({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: string;
  tone?: string;
  wide?: boolean;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={[styles.kpi, wide && styles.kpiWide]}>
      <Text style={[styles.kpiValue, tone ? { color: tone } : null]}>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}
