import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MeasurementField } from "../../../../src/api";
import { formatOrderDate } from "../../../../src/businessApi";
import type { CrmCustomerProfile } from "../../../../src/businessAdminApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type CrmMeasurement = CrmCustomerProfile["measurements"][number];

// Human label for where a measurement set was captured.
function measurementSourceLabel(source: string): string {
  switch (source) {
    case "self_measure":
      return "Self-measured";
    case "visit":
      return "Home visit";
    case "shop":
      return "In shop";
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

// One recorded measurement set. values keys are template field IDs, so labels
// come from the studio's measurement fields; unknown IDs fall back to the raw
// key so nothing is silently dropped.
export default function MeasurementCard({
  measurement,
  fields,
}: {
  measurement: CrmMeasurement;
  fields: MeasurementField[];
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const labelFor = useMemo(() => {
    const map = new Map(fields.map((field) => [field.field_id, field.label]));
    return (fieldId: string) => map.get(fieldId) ?? fieldId;
  }, [fields]);

  const entries = Object.entries(measurement.values);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.source}>
          {measurementSourceLabel(measurement.source)}
        </Text>
        <Text style={styles.date}>{formatOrderDate(measurement.created_at)}</Text>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.emptyValues}>No values recorded.</Text>
      ) : (
        <View style={styles.values}>
          {entries.map(([fieldId, value]) => (
            <View key={fieldId} style={styles.valueRow}>
              <Text style={styles.valueLabel}>{labelFor(fieldId)}</Text>
              <Text style={styles.valueText}>{value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
      gap: spacing(1),
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    source: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      color: palette.ink,
    },
    date: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
    },
    values: { gap: spacing(0.75) },
    valueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing(2),
    },
    valueLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    valueText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    emptyValues: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
  });
