import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../../src/api";
import type { MoneySummary } from "../../../../src/businessOpsApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

export function SummaryCards({ summary }: { summary: MoneySummary }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.grid}>
      <View style={styles.netCard}>
        <Text style={styles.netValue}>
          {formatGHS(summary.net_income_minor)}
        </Text>
        <Text style={styles.netLabel}>Net income</Text>
      </View>
      <View style={styles.kpiRow}>
        <Kpi
          label="Through platform"
          value={formatGHS(summary.through_platform_minor)}
        />
        <Kpi label="Commission" value={formatGHS(summary.commission_minor)} />
        <Kpi
          label="Manual takings"
          value={formatGHS(summary.manual_takings_minor)}
        />
        <Kpi
          label="Settled payouts"
          value={formatGHS(summary.settled_payouts_minor)}
        />
      </View>
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    grid: { gap: spacing(1.5) },
    netCard: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2.5),
      alignItems: "center",
    },
    netValue: {
      fontFamily: fonts.display,
      fontSize: 32,
      fontWeight: "700",
      color: palette.success,
    },
    netLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
    kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) },
    kpi: {
      flexGrow: 1,
      flexBasis: "44%",
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
    },
    kpiValue: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "700",
      color: palette.ink,
    },
    kpiLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
  });
