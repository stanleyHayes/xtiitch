import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

export default function HomeAudienceEntry({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${hint}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.icon}>
        <Ionicons name={icon} size={21} color={palette.gold} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minHeight: 112,
      borderRadius: radius.md,
      padding: spacing(1.75),
      backgroundColor: palette.ink,
    },
    pressed: { opacity: 0.88, transform: [{ scale: 0.975 }] },
    icon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    label: {
      color: palette.onAccent,
      fontWeight: "800",
      fontSize: 15,
      marginTop: spacing(1),
    },
    hint: { color: "rgba(255,255,255,0.58)", fontSize: 11, marginTop: 2 },
  });
