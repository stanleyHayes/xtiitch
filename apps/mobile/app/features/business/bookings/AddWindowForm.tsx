import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { AvailabilityWindow } from "../../../../src/businessOpsApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import { parseTimeInput } from "./timeInput";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const RECURRENCES: { key: "daily" | "weekly"; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];

type AddWindowFormProps = {
  saving: boolean;
  onAdd: (window: AvailabilityWindow) => void;
  onCancel: () => void;
};

// Inline form for one new availability window. Times are entered as HH:MM and
// converted to minutes-from-midnight before the parent submits the FULL new
// window list via defineAvailabilityWindows.
export default function AddWindowForm({
  saving,
  onAdd,
  onCancel,
}: AddWindowFormProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [recurrence, setRecurrence] = useState<"daily" | "weekly">("weekly");
  const [weekday, setWeekday] = useState(1); // Monday
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [slotInput, setSlotInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const start = parseTimeInput(startInput);
    const end = parseTimeInput(endInput);
    const slot = Number.parseInt(slotInput.trim(), 10);
    if (start === null || end === null) {
      setError("Enter start and end times as HH:MM.");
      return;
    }
    if (end <= start) {
      setError("End time must be after the start time.");
      return;
    }
    if (!Number.isFinite(slot) || slot <= 0) {
      setError("Slot length must be a positive number of minutes.");
      return;
    }
    setError(null);
    onAdd({
      recurrence,
      weekday: recurrence === "weekly" ? weekday : 0,
      start_minute: start,
      end_minute: end,
      slot_minutes: slot,
      day_of_month: 0,
    });
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>Repeats</Text>
      <View style={styles.chips}>
        {RECURRENCES.map((option) => {
          const active = recurrence === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setRecurrence(option.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {recurrence === "weekly" ? (
        <>
          <Text style={styles.formLabel}>Weekday</Text>
          <View style={styles.chips}>
            {WEEKDAYS.map((name, index) => {
              const active = weekday === index;
              return (
                <Pressable
                  key={name}
                  onPress={() => setWeekday(index)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Text style={styles.formLabel}>Start</Text>
          <TextInput
            value={startInput}
            onChangeText={setStartInput}
            placeholder="09:00"
            placeholderTextColor={palette.mutedText}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={styles.input}
          />
        </View>
        <View style={styles.timeField}>
          <Text style={styles.formLabel}>End</Text>
          <TextInput
            value={endInput}
            onChangeText={setEndInput}
            placeholder="17:00"
            placeholderTextColor={palette.mutedText}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={styles.input}
          />
        </View>
        <View style={styles.timeField}>
          <Text style={styles.formLabel}>Slot (min)</Text>
          <TextInput
            value={slotInput}
            onChangeText={setSlotInput}
            placeholder="30"
            placeholderTextColor={palette.mutedText}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={saving}
        onPress={add}
        style={[styles.saveButton, saving && styles.ctaDisabled]}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving…" : "Add window"}
        </Text>
      </Pressable>
      <Pressable disabled={saving} onPress={onCancel}>
        <Text style={styles.linkBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    form: { gap: spacing(1.25) },
    formLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(1),
    },
    chip: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      backgroundColor: palette.white,
    },
    chipActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.burgundy,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
    chipTextActive: { color: palette.onAccent },
    timeRow: { flexDirection: "row", gap: spacing(1.5) },
    timeField: { flex: 1, gap: spacing(0.5) },
    input: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.5),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
    },
    saveButton: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    saveButtonText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    ctaDisabled: { backgroundColor: palette.mauve },
    linkBtnText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.mutedText,
      textAlign: "center",
    },
  });
