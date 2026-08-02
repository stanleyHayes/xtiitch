import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { formatOrderDate } from "../../../../src/businessApi";
import {
  businessOpsApi,
  type AvailabilityWindow,
} from "../../../../src/businessOpsApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import AddWindowForm from "./AddWindowForm";
import { minutesToHHMM, parseDateInput } from "./timeInput";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type AvailabilitySectionProps = {
  windows: AvailabilityWindow[];
  blackouts: string[];
  onChanged: () => Promise<void>;
  onExpired: () => void;
};

// Availability tab: the studio's current windows (add/remove always re-posts
// the FULL list — the API replaces the whole set) plus blackout dates.
// eslint-disable-next-line max-lines-per-function -- complete availability editor
export default function AvailabilitySection({
  windows,
  blackouts,
  onChanged,
  onExpired,
}: AvailabilitySectionProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [blackoutInput, setBlackoutInput] = useState("");
  const [blackoutError, setBlackoutError] = useState<string | null>(null);

  // The API replaces the studio's full window set, so every mutation re-posts
  // the complete list: existing ± the change. The prop may be stale (the tab
  // skips refetch once cached), so re-fetch first and compute the next list
  // from that fresh set.
  const submitWindows = async (
    change: (current: AvailabilityWindow[]) => AvailabilityWindow[],
  ) => {
    setBusy(true);
    setError(null);
    const current = await businessOpsApi.availabilityWindows();
    if (!current.ok) {
      setBusy(false);
      if (current.expired) {
        onExpired();
        return false;
      }
      setError("Couldn't load the latest windows. Try again.");
      return false;
    }
    const result = await businessOpsApi.defineAvailabilityWindows(
      change(current.data.windows),
    );
    setBusy(false);
    if (result.ok) {
      await onChanged();
      return true;
    }
    if (result.expired) {
      onExpired();
      return false;
    }
    setError("Couldn't save the windows. Check your connection and try again.");
    return false;
  };

  const addWindow = async (window: AvailabilityWindow) => {
    const saved = await submitWindows((current) => [...current, window]);
    if (saved) setShowAddForm(false);
  };

  const removeWindow = (index: number) => {
    // Match by value, not index: the fresh list may differ from the cached one.
    const target = windows[index];
    void submitWindows((current) =>
      current.filter((candidate) => !sameWindow(candidate, target)),
    );
  };

  const addBlackout = async () => {
    const parsed = parseDateInput(blackoutInput);
    if (!parsed) {
      setBlackoutError("Enter a valid date (YYYY-MM-DD).");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsed.getTime() < today.getTime()) {
      setBlackoutError("Pick today or a future date.");
      return;
    }
    setBusy(true);
    setBlackoutError(null);
    const result = await businessOpsApi.addBlackout(blackoutInput.trim());
    setBusy(false);
    if (result.ok) {
      setBlackoutInput("");
      await onChanged();
    } else if (result.expired) {
      onExpired();
    } else {
      setBlackoutError("Couldn't add that date. Try again.");
    }
  };

  const removeBlackout = async (date: string) => {
    setBusy(true);
    const result = await businessOpsApi.removeBlackout(date);
    setBusy(false);
    if (result.ok) {
      await onChanged();
    } else if (result.expired) {
      onExpired();
    }
  };

  return (
    <View style={styles.sections}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Windows</Text>
      </View>

      {windows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No windows yet</Text>
          <Text style={styles.emptyHint}>
            Add a window so customers can book appointments.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {windows.map((window, index) => (
            <View key={index} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{windowTitle(window)}</Text>
                <Text style={styles.rowMeta}>
                  {minutesToHHMM(window.start_minute)}–
                  {minutesToHHMM(window.end_minute)} · {window.slot_minutes} min
                  slots
                </Text>
              </View>
              <Pressable
                disabled={busy}
                hitSlop={8}
                onPress={() => removeWindow(index)}
              >
                <Text style={styles.removeAction}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {showAddForm ? (
        <View style={styles.card}>
          <AddWindowForm
            saving={busy}
            onAdd={(window) => void addWindow(window)}
            onCancel={() => setShowAddForm(false)}
          />
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.addCta, pressed && { opacity: 0.9 }]}
          onPress={() => setShowAddForm(true)}
        >
          <Text style={styles.addCtaText}>+ Add window</Text>
        </Pressable>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Blackout dates</Text>
      </View>

      {blackouts.length === 0 ? (
        <Text style={styles.hint}>No blackout dates.</Text>
      ) : (
        <View style={styles.list}>
          {blackouts.map((date) => (
            <View key={date} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{formatOrderDate(date)}</Text>
                <Text style={styles.rowMeta}>{date}</Text>
              </View>
              <Pressable
                disabled={busy}
                hitSlop={8}
                onPress={() => void removeBlackout(date)}
              >
                <Text style={styles.removeAction}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.formLabel}>Close the studio on</Text>
        <TextInput
          value={blackoutInput}
          onChangeText={setBlackoutInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={palette.mutedText}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          style={styles.input}
        />
        {blackoutError ? (
          <Text style={styles.error}>{blackoutError}</Text>
        ) : null}
        <Pressable
          disabled={busy}
          onPress={() => void addBlackout()}
          style={[styles.saveButton, busy && styles.ctaDisabled]}
        >
          <Text style={styles.saveButtonText}>
            {busy ? "Saving…" : "Add blackout date"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Field-for-field window equality (no id on the wire type), used to find the
// displayed window inside the freshly fetched list before removing it.
function sameWindow(a: AvailabilityWindow, b: AvailabilityWindow): boolean {
  return (
    a.weekday === b.weekday &&
    a.start_minute === b.start_minute &&
    a.end_minute === b.end_minute &&
    a.slot_minutes === b.slot_minutes &&
    a.recurrence === b.recurrence &&
    a.day_of_month === b.day_of_month &&
    a.specific_date === b.specific_date
  );
}

// Recurrence label: weekly names its weekday (0 = Sunday); the other
// recurrences the API knows get a readable fallback.
function windowTitle(window: AvailabilityWindow): string {
  switch (window.recurrence) {
    case "daily":
      return "Daily";
    case "weekly":
      return `Weekly · ${WEEKDAYS[window.weekday] ?? "—"}`;
    case "monthly":
      return `Monthly · day ${window.day_of_month}`;
    case "date":
      return `One-off · ${window.specific_date ?? ""}`;
    case "ongoing":
      return "Every day";
    default:
      return (
        window.recurrence.charAt(0).toUpperCase() + window.recurrence.slice(1)
      );
  }
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    sections: { gap: spacing(1.5) },
    sectionHead: { marginTop: spacing(1.5) },
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
    },
    list: { gap: spacing(1.5) },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1),
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
    },
    rowBody: { flex: 1, gap: spacing(0.5) },
    rowTitle: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    rowMeta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    removeAction: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.danger,
    },
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
      gap: spacing(1.25),
    },
    addCta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    addCtaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    formLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
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
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    empty: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(3),
      alignItems: "center",
    },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: palette.ink,
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(0.75),
      lineHeight: 20,
    },
  });
