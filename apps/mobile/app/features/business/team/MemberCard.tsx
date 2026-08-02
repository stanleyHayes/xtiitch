import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { BusinessUser } from "../../../../src/businessAdminApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type RoleTone = { background: string; text: string };

function roleTone(role: string, palette: Palette): RoleTone {
  if (role === "owner") {
    return { background: palette.burgundy, text: palette.onAccent };
  }
  if (role === "admin") {
    return { background: "rgba(49,95,143,0.12)", text: palette.info };
  }
  return { background: "rgba(86,91,99,0.12)", text: palette.mutedText };
}

export function MemberCard({
  member,
  busy,
  onToggleActive,
}: {
  member: BusinessUser;
  busy: boolean;
  onToggleActive: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = roleTone(member.role, palette);
  const isOwner = member.role === "owner";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <Text style={styles.name}>{member.display_name}</Text>
          <Text style={styles.contact}>{member.email}</Text>
          {member.phone ? (
            <Text style={styles.contact}>{member.phone}</Text>
          ) : null}
        </View>
        <View style={styles.badges}>
          <View style={[styles.pill, { backgroundColor: tone.background }]}>
            <Text style={[styles.pillText, { color: tone.text }]}>
              {member.role}
            </Text>
          </View>
          {!member.is_active ? (
            <View style={[styles.pill, styles.inactivePill]}>
              <Text style={[styles.pillText, { color: palette.danger }]}>
                Inactive
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {!isOwner ? (
        <Pressable
          disabled={busy}
          onPress={onToggleActive}
          hitSlop={6}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text
            style={[
              styles.toggleText,
              member.is_active
                ? { color: palette.danger }
                : { color: palette.burgundy },
              busy && { opacity: 0.5 },
            ]}
          >
            {busy
              ? "Updating…"
              : member.is_active
                ? "Deactivate"
                : "Reactivate"}
          </Text>
        </Pressable>
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
      justifyContent: "space-between",
      gap: spacing(1.5),
    },
    identity: { flex: 1, gap: spacing(0.25) },
    name: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    contact: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    badges: { alignItems: "flex-end", gap: spacing(0.75) },
    pill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    inactivePill: { backgroundColor: "rgba(192,57,43,0.12)" },
    pillText: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    toggleText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      marginTop: spacing(1.5),
    },
  });
