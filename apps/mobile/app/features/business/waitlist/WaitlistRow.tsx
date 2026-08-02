import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WaitlistEntry } from "../../../../src/businessAdminApi";
import { formatOrderDate } from "../../../../src/businessApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// Pill tone per lifecycle state; anything unexpected renders muted.
function statusTone(status: string, palette: Palette): string {
  if (status === "waiting") return palette.warning;
  if (status === "notified") return palette.info;
  return palette.mutedText;
}

export function WaitlistRow({
  entry,
  busy,
  onMarkNotified,
  onClose,
}: {
  entry: WaitlistEntry;
  busy: boolean;
  onMarkNotified: () => void;
  onClose: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = statusTone(entry.status, palette);
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{entry.design_title}</Text>
        <View style={[styles.pill, { backgroundColor: `${tone}1f` }]}>
          <Text style={[styles.pillText, { color: tone }]}>{entry.status}</Text>
        </View>
      </View>
      <Text style={styles.customer}>
        {entry.customer_name} · {entry.customer_contact}
      </Text>
      {entry.note ? <Text style={styles.note}>“{entry.note}”</Text> : null}
      <Text style={styles.date}>
        Joined {formatOrderDate(entry.created_at)}
      </Text>
      {entry.status !== "closed" ? (
        <View style={styles.actions}>
          {entry.status === "waiting" ? (
            <Pressable
              disabled={busy}
              onPress={onMarkNotified}
              style={({ pressed }) => [
                styles.actionPrimary,
                (pressed || busy) && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.actionPrimaryText}>Mark notified</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={busy}
            onPress={onClose}
            style={({ pressed }) => [
              styles.actionSecondary,
              (pressed || busy) && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.actionSecondaryText}>Close</Text>
          </Pressable>
        </View>
      ) : null}
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
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    title: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    pill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    pillText: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    customer: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
    note: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.ink,
      fontStyle: "italic",
      marginTop: spacing(1),
      lineHeight: 19,
    },
    date: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(1),
    },
    actions: {
      flexDirection: "row",
      gap: spacing(1),
      marginTop: spacing(1.5),
    },
    actionPrimary: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
    },
    actionPrimaryText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
    actionSecondary: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: palette.danger,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
    },
    actionSecondaryText: {
      color: palette.danger,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
  });
