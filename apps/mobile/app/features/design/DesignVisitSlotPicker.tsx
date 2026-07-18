import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { AvailabilitySlot } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import {
  formatVisitSlot,
  formatVisitTime,
  groupVisitSlots,
} from "./visit-slots";

type DesignVisitSlotPickerProps = {
  slots: AvailabilitySlot[];
  selectedSlotStart: string;
  onSelect: (slotStart: string) => void;
};

// Day chips across the top, time chips for the chosen day — a compact take on
// the web storefront's VisitSlotFields calendar (visit-slot-fields.tsx). The
// selected slot is controlled by the parent form; the day is local state.
export default function DesignVisitSlotPicker({
  slots,
  selectedSlotStart,
  onSelect,
}: DesignVisitSlotPickerProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const groups = useMemo(() => groupVisitSlots(slots), [slots]);
  const [selectedDay, setSelectedDay] = useState(groups[0]?.key ?? "");
  const activeGroup =
    groups.find((group) => group.key === selectedDay) ?? groups[0];
  const activeSlot =
    activeGroup?.slots.find((slot) => slot.slot_start === selectedSlotStart) ??
    activeGroup?.slots[0];

  // Keep the parent's selection pointed at a real slot: initially, and whenever
  // the day changes, the first slot of the active day is the selection.
  useEffect(() => {
    if (activeSlot && activeSlot.slot_start !== selectedSlotStart) {
      onSelect(activeSlot.slot_start);
    }
  }, [activeSlot, selectedSlotStart, onSelect]);

  if (!activeGroup || !activeSlot) {
    return (
      <Text style={styles.muted}>
        No home-visit slots are open right now. Try self-measure or come to the
        shop.
      </Text>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Choose visit day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.dayRow}>
          {groups.map((group) => {
            const active = group.key === activeGroup.key;
            return (
              <Pressable
                key={group.key}
                onPress={() => {
                  setSelectedDay(group.key);
                  onSelect(group.slots[0]?.slot_start ?? "");
                }}
                style={[styles.dayChip, active && styles.chipActive]}
              >
                <Text style={[styles.dayText, active && styles.textActive]}>
                  {group.label}
                </Text>
                <Text style={[styles.dayCount, active && styles.textActive]}>
                  {group.slots.length} slot{group.slots.length === 1 ? "" : "s"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Text style={styles.heading}>{activeGroup.caption} times</Text>
      <View style={styles.timeRow}>
        {activeGroup.slots.map((slot) => {
          const active = slot.slot_start === activeSlot.slot_start;
          return (
            <Pressable
              key={slot.slot_start}
              onPress={() => onSelect(slot.slot_start)}
              style={[styles.timeChip, active && styles.chipActive]}
            >
              <Text style={[styles.timeText, active && styles.textActive]}>
                {formatVisitTime(slot)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.selected}>Selected: {formatVisitSlot(activeSlot)}</Text>
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
      marginBottom: spacing(1),
      marginTop: spacing(0.5),
    },
    muted: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
    },
    dayRow: { flexDirection: "row", gap: spacing(1) },
    dayChip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      backgroundColor: palette.white,
    },
    chipActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    dayText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
    dayCount: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: palette.mutedText,
      marginTop: 2,
    },
    textActive: { color: palette.burgundy },
    timeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(1),
    },
    timeChip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      backgroundColor: palette.white,
    },
    timeText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
    selected: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(1.25),
    },
  });
