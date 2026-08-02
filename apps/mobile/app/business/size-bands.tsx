import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect } from "expo-router";
import { businessApi, type SizeBand } from "../../src/businessApi";
import { fonts, radius, shadow, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";

const chartText = (band: SizeBand) =>
  (band.chart ?? [])
    .map((item) => `${item.name}: ${item.value} ${item.unit}`.trim())
    .join("\n");
const parseChart = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", detail = ""] = line.split(":", 2);
      const bits = detail.trim().split(/\s+/);
      const unit = bits.length > 1 ? (bits.pop() ?? "") : "";
      return { name: name.trim(), value: bits.join(" "), unit };
    })
    .filter((item) => item.name && item.value);

// eslint-disable-next-line max-lines-per-function -- size chart CRUD workspace
export default function SizeBandsScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => styles(palette), [palette]);
  const [items, setItems] = useState<SizeBand[]>([]);
  const [editing, setEditing] = useState<SizeBand | null>(null);
  const [label, setLabel] = useState("");
  const [sequence, setSequence] = useState("");
  const [chart, setChart] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await businessApi.sizeBands();
    if (result.ok)
      setItems(result.data.size_bands.sort((a, b) => a.sequence - b.sequence));
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const reset = () => {
    setEditing(null);
    setLabel("");
    setSequence("");
    setChart("");
  };
  const edit = (item: SizeBand) => {
    setEditing(item);
    setLabel(item.label);
    setSequence(String(item.sequence));
    setChart(chartText(item));
  };
  const save = async () => {
    if (!label.trim()) return;
    setBusy(true);
    const input = {
      label: label.trim(),
      sequence: Number(sequence || items.length),
      chart: parseChart(chart),
    };
    const result = editing
      ? await businessApi.updateSizeBand(editing.size_band_id, input)
      : await businessApi.createSizeBand(input);
    setBusy(false);
    if (result.ok) {
      reset();
      await load();
    } else
      Alert.alert(
        "Couldn’t save size",
        "Check the label, order, and chart rows.",
      );
  };
  const remove = (item: SizeBand) =>
    Alert.alert(
      "Delete size?",
      "Existing design and order history may prevent removal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await businessApi.deleteSizeBand(item.size_band_id);
            if (result.ok) await load();
            else
              Alert.alert(
                "Size is in use",
                "Retain it for existing catalogue prices.",
              );
          },
        },
      ],
    );
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Ready-to-wear sizes" }} />
      <View style={s.hero}>
        <Ionicons
          name="shirt-outline"
          size={145}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>SIZE BOOK</Text>
        <Text style={s.title}>Ready-to-wear sizes</Text>
        <Text style={s.subtitle}>
          Define the size bands and customer-facing chart used across catalogue
          pricing.
        </Text>
      </View>
      <Text style={s.section}>{editing ? "Edit size" : "Add a size"}</Text>
      <View style={s.card}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Label, e.g. Medium"
          placeholderTextColor={palette.mutedText}
          style={s.input}
        />
        <TextInput
          value={sequence}
          onChangeText={setSequence}
          placeholder="Display order"
          placeholderTextColor={palette.mutedText}
          keyboardType="number-pad"
          style={s.input}
        />
        <TextInput
          value={chart}
          onChangeText={setChart}
          placeholder={"One measurement per line\nChest: 38 in\nWaist: 32 in"}
          placeholderTextColor={palette.mutedText}
          multiline
          style={[s.input, s.chart]}
        />
        <View style={s.actions}>
          {editing ? (
            <Pressable onPress={reset} style={s.secondary}>
              <Text style={s.secondaryText}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={busy || !label.trim()}
            onPress={() => void save()}
            style={s.primary}
          >
            <Text style={s.primaryText}>{busy ? "Saving…" : "Save size"}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={s.section}>Current size book</Text>
      <View style={s.list}>
        {items.map((item) => (
          <View key={item.size_band_id} style={s.card}>
            <View style={s.row}>
              <View style={s.copy}>
                <Text style={s.cardTitle}>{item.label}</Text>
                <Text style={s.hint}>
                  {item.chart?.length ?? 0} chart measurements · position{" "}
                  {item.sequence}
                </Text>
              </View>
              <Pressable onPress={() => edit(item)} style={s.secondary}>
                <Text style={s.secondaryText}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => remove(item)} style={s.secondary}>
                <Text style={s.secondaryText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
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
    watermark: { position: "absolute", right: -15, bottom: -28, opacity: 0.1 },
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
    section: {
      color: p.ink,
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "800",
      marginTop: spacing(3),
      marginBottom: spacing(1.25),
    },
    card: {
      backgroundColor: p.white,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing(1),
      padding: spacing(1.75),
      ...shadow.card,
    },
    list: { gap: spacing(1) },
    input: {
      backgroundColor: p.sunken,
      borderColor: p.softBorder,
      borderRadius: radius.sm,
      borderWidth: 1,
      color: p.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(1.2),
    },
    chart: { minHeight: 105, textAlignVertical: "top" },
    actions: {
      flexDirection: "row",
      gap: spacing(0.75),
      justifyContent: "flex-end",
    },
    primary: {
      backgroundColor: p.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.05),
    },
    primaryText: {
      color: p.onAccent,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },
    secondary: {
      borderColor: p.burgundy,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing(1),
      paddingVertical: spacing(0.75),
    },
    secondaryText: {
      color: p.burgundy,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
    },
    row: { alignItems: "center", flexDirection: "row", gap: spacing(0.6) },
    copy: { flex: 1 },
    cardTitle: {
      color: p.ink,
      fontFamily: fonts.display,
      fontSize: 17,
      fontWeight: "800",
    },
    hint: {
      color: p.mutedText,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 18,
    },
  });
