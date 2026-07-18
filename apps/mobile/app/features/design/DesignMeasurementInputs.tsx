import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MeasurementField } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignField from "./DesignField";

type DesignMeasurementInputsProps = {
  fields: MeasurementField[];
  values: Record<string, string>;
  onChange: (fieldId: string, next: string) => void;
};

// Self-measure inputs driven by the store's configured measurement fields
// (label + unit), sorted by sequence — ports the web storefront's
// MeasurementInputs (features/design/measurements.tsx).
export default function DesignMeasurementInputs({
  fields,
  values,
  onChange,
}: DesignMeasurementInputsProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const sorted = useMemo(
    () => [...fields].sort((a, b) => a.sequence - b.sequence),
    [fields],
  );
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Add at least one measurement</Text>
      <View style={styles.form}>
        {sorted.map((field) => (
          <DesignField
            key={field.field_id}
            label={`${field.label} (${field.unit})`}
            value={values[field.field_id] ?? ""}
            onChange={(next) => onChange(field.field_id, next)}
            placeholder={`e.g. 86`}
            keyboardType="decimal-pad"
            autoCapitalize="none"
          />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    panel: {
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      backgroundColor: palette.panel,
      padding: spacing(1.75),
    },
    heading: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
      color: palette.ink,
      marginBottom: spacing(1.25),
    },
    form: { gap: spacing(1.5) },
  });
