import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { MeasurementField } from "../../../../src/api";
import { businessApi, type MeasurementSource } from "../../../../src/businessApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type OrderMeasurementsCardProps = {
  orderId: string;
  source: MeasurementSource;
  onLoad: () => Promise<void>;
  onExpired: () => void;
};

// Staff capture of bespoke measurements, mirroring the web dashboard's
// MeasurementsDialog: the studio's template fields, one input each, posted to
// POST /orders/{id}/measurements with the visit/shop source. The parent only
// renders this card when measurementSourceFor(order) gates it in.
export default function OrderMeasurementsCard({
  orderId,
  source,
  onLoad,
  onExpired,
}: OrderMeasurementsCardProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [fields, setFields] = useState<MeasurementField[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    businessApi.measurementFields().then((result) => {
      if (!active) return;
      if (result.ok) setFields(result.data.fields);
      else if (result.expired) onExpired();
      else setFields([]);
    });
    return () => {
      active = false;
    };
  }, [onExpired]);

  const save = async () => {
    const entered: Record<string, string> = {};
    for (const field of fields ?? []) {
      const value = (values[field.field_id] ?? "").trim();
      if (value) entered[field.field_id] = value;
    }
    // The API 400s an empty values map — require at least one entry first.
    if (Object.keys(entered).length === 0) {
      setError("Add at least one measurement value before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await businessApi.recordMeasurements(orderId, source, entered);
    setSaving(false);
    if (result.ok) {
      setExpanded(false);
      setValues({});
      setSaved(true);
      await onLoad();
    } else if (result.expired) {
      onExpired();
    } else {
      setError("Couldn't save those measurements. Check the values and try again.");
    }
  };

  if (fields === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.hint}>Loading measurement fields…</Text>
      </View>
    );
  }

  if (fields.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.hint}>
          Add measurement fields in Settings before recording measurements.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {saved && !expanded ? (
        <Text style={styles.settled}>Measurements saved.</Text>
      ) : null}
      {expanded ? (
        <MeasurementsForm
          fields={fields}
          values={values}
          saving={saving}
          error={error}
          onChange={(fieldId, next) =>
            setValues((current) => ({ ...current, [fieldId]: next }))
          }
          onSave={save}
          onCancel={() => {
            setExpanded(false);
            setError(null);
          }}
        />
      ) : (
        <Pressable
          style={styles.actionRow}
          onPress={() => {
            setSaved(false);
            setExpanded(true);
          }}
        >
          <Text style={styles.actionTitle}>Record measurements</Text>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>
      )}
    </View>
  );
}

// One input per template field, labelled like the web dialog: "Label (unit)".
function MeasurementsForm({
  fields,
  values,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  fields: MeasurementField[];
  values: Record<string, string>;
  saving: boolean;
  error: string | null;
  onChange: (fieldId: string, next: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.editBlock}>
      {fields.map((field) => (
        <View key={field.field_id}>
          <Text style={styles.editLabel}>
            {field.label} ({field.unit})
          </Text>
          <TextInput
            value={values[field.field_id] ?? ""}
            onChangeText={(next) => onChange(field.field_id, next)}
            keyboardType="decimal-pad"
            placeholder={field.unit}
            placeholderTextColor={palette.mutedText}
            style={styles.input}
          />
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={saving}
        onPress={onSave}
        style={[styles.smallPrimaryWide, saving && styles.ctaDisabled]}
      >
        <Text style={styles.smallPrimaryText}>
          {saving ? "Saving…" : "Save measurements"}
        </Text>
      </Pressable>
      <Pressable onPress={onCancel} disabled={saving}>
        <Text style={styles.linkBtnText}>Cancel</Text>
      </Pressable>
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
      paddingHorizontal: spacing(2),
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing(1.75),
    },
    actionTitle: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "700",
      color: palette.burgundy,
    },
    actionArrow: { fontSize: 22, fontWeight: "700", color: palette.burgundy },
    editBlock: { paddingVertical: spacing(1.75), gap: spacing(1.25) },
    editLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
      marginBottom: spacing(0.75),
    },
    input: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
    smallPrimaryWide: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    smallPrimaryText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    linkBtnText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.mutedText,
      textAlign: "center",
    },
    settled: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.success,
      fontWeight: "700",
      paddingTop: spacing(1.75),
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      lineHeight: 19,
      paddingVertical: spacing(1.75),
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
    },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
  });
