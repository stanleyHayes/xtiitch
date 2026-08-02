import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { type MeasurementField } from "../../src/api";
import { loadSession } from "../../src/auth";
import { businessApi } from "../../src/businessApi";
import { useTheme } from "../../src/theme-mode";
import { CenterState, LoadingButtonLabel } from "../../src/ui";
import { makeStyles } from "./measurements.styles";

// eslint-disable-next-line max-lines-per-function -- complete CRUD workflow kept together for shared form state
export default function MeasurementsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [fields, setFields] = useState<MeasurementField[] | null>(null);
  const [editing, setEditing] = useState<MeasurementField | null>(null);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("in");
  const [sequence, setSequence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!(await loadSession())) {
      router.replace("/business/login");
      return;
    }
    const result = await businessApi.measurementFields();
    if (!result.ok) {
      if (result.expired) router.replace("/business/login");
      else setError("Measurement fields could not be loaded.");
      return;
    }
    setError("");
    setFields(result.data.fields.sort((a, b) => a.sequence - b.sequence));
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const reset = () => {
    setEditing(null);
    setLabel("");
    setUnit("in");
    setSequence("");
  };
  const edit = (field: MeasurementField) => {
    setEditing(field);
    setLabel(field.label);
    setUnit(field.unit);
    setSequence(String(field.sequence));
  };
  const save = async () => {
    const order = Number(sequence);
    if (!label.trim() || !Number.isInteger(order) || order < 0) {
      Alert.alert(
        "Check the field",
        "Add a label and a zero or positive display order.",
      );
      return;
    }
    setBusy(true);
    const input = {
      label: label.trim(),
      unit: unit.trim() || "in",
      sequence: order,
    };
    const result = editing
      ? await businessApi.updateMeasurementField(editing.field_id, input)
      : await businessApi.createMeasurementField(input);
    setBusy(false);
    if (!result.ok) {
      Alert.alert(
        "Couldn't save field",
        "Another field may already use that display order.",
      );
      return;
    }
    reset();
    await load();
  };
  const remove = (field: MeasurementField) =>
    Alert.alert(
      "Delete measurement field?",
      `Remove “${field.label}” from future measurement forms? Existing order records remain intact.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await businessApi.deleteMeasurementField(
              field.field_id,
            );
            if (result.ok) await load();
            else Alert.alert("Couldn't delete field", "Try again.");
          },
        },
      ],
    );
  if (!fields && !error) return <CenterState loading />;
  if (!fields)
    return (
      <CenterState
        title="Measurements unavailable"
        hint={error}
        onRetry={load}
      />
    );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Measurements" }} />
      <View style={styles.hero}>
        <Ionicons
          name="resize-outline"
          size={145}
          color={palette.onAccent}
          style={styles.watermark}
        />
        <Text style={styles.eyebrow}>FIT TEMPLATE</Text>
        <Text style={styles.title}>Measurements that match your work</Text>
        <Text style={styles.subtitle}>
          Define the exact fields shown to customers and staff for bespoke
          orders.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/business/size-bands")}
        style={styles.sizeBandLink}
      >
        <Ionicons name="shirt-outline" size={18} color={palette.onAccent} />
        <Text style={styles.buttonText}>Manage ready-to-wear sizes</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>
        {editing ? "Edit field" : "Add a field"}
      </Text>
      <View style={styles.form}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Field label, e.g. Chest"
          placeholderTextColor={palette.mutedText}
          style={styles.input}
        />
        <View style={[styles.formRow, { marginTop: 8 }]}>
          <TextInput
            value={unit}
            onChangeText={setUnit}
            placeholder="Unit"
            placeholderTextColor={palette.mutedText}
            style={styles.input}
          />
          <TextInput
            value={sequence}
            onChangeText={setSequence}
            placeholder="Order"
            placeholderTextColor={palette.mutedText}
            keyboardType="number-pad"
            style={[styles.input, styles.shortInput]}
          />
        </View>
        <View style={styles.actionRow}>
          {editing ? (
            <Pressable
              onPress={reset}
              style={[styles.button, styles.buttonSecondary]}
            >
              <Text style={[styles.buttonText, styles.secondaryText]}>
                Cancel
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={[styles.button, busy && styles.buttonDisabled]}
          >
            {busy ? (
              <LoadingButtonLabel label="Saving" />
            ) : (
              <Text style={styles.buttonText}>
                {editing ? "Save changes" : "Add field"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
      <Text style={styles.sectionTitle}>
        Current template · {fields.length}
      </Text>
      {fields.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="resize-outline" size={32} color={palette.burgundy} />
          <Text style={styles.emptyTitle}>No fields configured</Text>
          <Text style={styles.emptyHint}>
            Add the measurements your studio needs before enabling bespoke
            requests.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {fields.map((field) => (
            <View key={field.field_id} style={styles.row}>
              <View style={styles.sequence}>
                <Text style={styles.sequenceText}>{field.sequence}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.label}>{field.label}</Text>
                <Text style={styles.unit}>{field.unit || "No unit"}</Text>
              </View>
              <Pressable
                accessibilityLabel={`Edit ${field.label}`}
                onPress={() => edit(field)}
                style={styles.iconAction}
              >
                <Ionicons
                  name="pencil-outline"
                  size={18}
                  color={palette.burgundy}
                />
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete ${field.label}`}
                onPress={() => remove(field)}
                style={styles.iconAction}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={palette.danger}
                />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
