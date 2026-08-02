import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { makeStyles } from "./index.styles";

export function HeroStat({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: "rgba(255,255,255,0.58)",
          fontSize: 11,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: palette.onAccent,
          fontSize: 15,
          fontWeight: "800",
          marginTop: 3,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={20} color={palette.burgundy} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={styles.sectionAction}>{action} ›</Text>
      </Pressable>
    </View>
  );
}

export function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={23} color={palette.gold} />
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

export function EmptyCopy({ text }: { text: string }) {
  const { palette } = useTheme();
  return (
    <Text
      style={{
        color: palette.mutedText,
        padding: spacing(2.5),
        textAlign: "center",
        lineHeight: 20,
      }}
    >
      {text}
    </Text>
  );
}
