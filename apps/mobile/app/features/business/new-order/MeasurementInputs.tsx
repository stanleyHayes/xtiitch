import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { MeasurementField } from "../../../../src/api";
import { fonts, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import { Field } from "./Field";

// Bespoke walk-in measurement section: renders the studio's measurement
// template (label + unit) as labelled numeric inputs into a field_id → value
// map, sorted by sequence — mirrors the design feature's
// DesignMeasurementInputs pattern. Handles its own loading / error / empty
// states; fields === null means the template hasn't loaded yet.
export function MeasurementInputs({
  fields,
  loading,
  error,
  onRetry,
  values,
  onChange,
}: {
  fields: MeasurementField[] | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  values: Record<string, string>;
  onChange: (fieldId: string, next: string) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const sorted = useMemo(
    () => (fields ? [...fields].sort((a, b) => a.sequence - b.sequence) : []),
    [fields],
  );
  return (
    <>
      <Text style={styles.sectionLabel}>Measurements (optional)</Text>
      {loading ? (
        <Text style={styles.hint}>Loading the measurement template…</Text>
      ) : error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>
            Couldn't load the measurement template.
          </Text>
          <Pressable onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : sorted.length > 0 ? (
        <View style={styles.form}>
          {sorted.map((field) => (
            <Field
              key={field.field_id}
              label={`${field.label} (${field.unit})`}
              value={values[field.field_id] ?? ""}
              onChange={(next) => onChange(field.field_id, next)}
              placeholder="0"
              keyboardType="decimal-pad"
            />
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>
          No measurement template is configured for this studio.
        </Text>
      )}
    </>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(2.5),
      marginBottom: spacing(1.5),
    },
    form: { gap: spacing(1.75) },
    hint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1.5),
    },
    errorText: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      flex: 1,
    },
    retryText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      color: palette.burgundy,
    },
  });
