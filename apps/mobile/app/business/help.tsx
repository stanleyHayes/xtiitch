import { useMemo } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { fonts, radius, shadow, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";

const guides = [
  [
    "Orders",
    "Record online, walk-in, or custom work, then move every piece through the production stages.",
  ],
  [
    "Catalogue",
    "Create pieces, set size prices, group collections, and retire work without deleting its history.",
  ],
  [
    "Money",
    "Review settled income, log offline takings, follow payouts, and verify the wallet that receives funds.",
  ],
  [
    "Bookings",
    "Manage visits, recurring availability, one-off windows, and days when the studio is closed.",
  ],
  [
    "Customers",
    "Open the auto-built CRM to contact customers and review their order and measurement history.",
  ],
  [
    "Security",
    "Keep your profile current, change your password, and protect sign-in with authenticator MFA.",
  ],
] as const;

export default function HelpScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => styles(palette), [palette]);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: "Help centre" }} />
      <View style={s.hero}>
        <Ionicons
          name="help-buoy-outline"
          size={145}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>STUDIO PLAYBOOK</Text>
        <Text style={s.title}>Know what to do next</Text>
        <Text style={s.subtitle}>
          Short, practical guidance for the workspaces your team uses every day.
        </Text>
      </View>
      <View style={s.list}>
        {guides.map(([title, copy], index) => (
          <View key={title} style={s.card}>
            <Text style={s.number}>{String(index + 1).padStart(2, "0")}</Text>
            <View style={s.cardCopy}>
              <Text style={s.cardTitle}>{title}</Text>
              <Text style={s.hint}>{copy}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() =>
          void Linking.openURL(
            "mailto:support@xtiitch.com?subject=Xtiitch%20mobile%20support",
          )
        }
        style={s.support}
      >
        <Ionicons name="mail-outline" size={20} color={palette.onAccent} />
        <Text style={s.supportText}>Email Xtiitch support</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = (p: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.cream },
    content: { padding: spacing(3), paddingBottom: spacing(7) },
    hero: {
      backgroundColor: p.burgundyDeep,
      borderRadius: radius.lg,
      overflow: "hidden",
      padding: spacing(2.5),
    },
    watermark: { position: "absolute", right: -14, bottom: -28, opacity: 0.1 },
    eyebrow: {
      color: p.gold,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.8,
    },
    title: {
      color: p.onAccent,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "800",
      marginTop: spacing(0.75),
    },
    subtitle: {
      color: "rgba(255,255,255,0.68)",
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 21,
      marginTop: spacing(0.75),
    },
    list: { gap: spacing(1.25), marginTop: spacing(2) },
    card: {
      alignItems: "flex-start",
      backgroundColor: p.white,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing(1.5),
      padding: spacing(1.75),
      ...shadow.card,
    },
    number: {
      color: p.burgundy,
      fontFamily: fonts.display,
      fontSize: 17,
      fontWeight: "900",
    },
    cardCopy: { flex: 1 },
    cardTitle: {
      color: p.ink,
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "800",
    },
    hint: {
      color: p.mutedText,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 3,
    },
    support: {
      alignItems: "center",
      backgroundColor: p.burgundy,
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: spacing(0.75),
      justifyContent: "center",
      marginTop: spacing(2),
      paddingVertical: spacing(1.5),
    },
    supportText: {
      color: p.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "900",
    },
  });
