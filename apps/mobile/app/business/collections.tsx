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
import {
  businessCatalogueApi,
  type CatalogueCollection,
} from "../../src/businessCatalogueApi";
import { fonts, radius, shadow, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";

// Collection creation, editing, and lifecycle controls share one compact form.
// eslint-disable-next-line max-lines-per-function
export default function CollectionsScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => styles(palette), [palette]);
  const [items, setItems] = useState<CatalogueCollection[]>([]);
  const [editing, setEditing] = useState<CatalogueCollection | null>(null);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await businessCatalogueApi.collections();
    if (result.ok) setItems(result.data.collections);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const reset = () => {
    setEditing(null);
    setName("");
    setTheme("");
  };
  const edit = (item: CatalogueCollection) => {
    setEditing(item);
    setName(item.name);
    setTheme(item.theme);
  };
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const input = {
      name: name.trim(),
      theme: theme.trim(),
      sequence: editing?.sequence ?? items.length,
    };
    const result = editing
      ? await businessCatalogueApi.updateCollection(
          editing.collection_id,
          input,
        )
      : await businessCatalogueApi.createCollection(input);
    setBusy(false);
    if (result.ok) {
      reset();
      await load();
    } else
      Alert.alert(
        "Couldn’t save collection",
        "Check the name and your plan access.",
      );
  };
  const status = (item: CatalogueCollection) =>
    Alert.alert(
      item.status === "active" ? "Retire collection?" : "Restore collection?",
      "Designs remain in your catalogue; only this grouping changes visibility.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: item.status === "active" ? "Retire" : "Restore",
          onPress: async () => {
            const result =
              item.status === "active"
                ? await businessCatalogueApi.retireCollection(
                    item.collection_id,
                  )
                : await businessCatalogueApi.restoreCollection(
                    item.collection_id,
                  );
            if (result.ok) await load();
          },
        },
      ],
    );
  const remove = (item: CatalogueCollection) =>
    Alert.alert(
      "Delete collection permanently?",
      `${item.name} cannot be recovered. Designs are kept but removed from this collection.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const result = await businessCatalogueApi.deleteCollection(
              item.collection_id,
            );
            if (result.ok) {
              if (editing?.collection_id === item.collection_id) reset();
              await load();
            } else Alert.alert("Couldn’t delete collection");
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
      <Stack.Screen options={{ title: "Collections" }} />
      <View style={s.hero}>
        <Ionicons
          name="albums-outline"
          size={145}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>CURATE THE RAIL</Text>
        <Text style={s.title}>Collections</Text>
        <Text style={s.subtitle}>
          Group related pieces into stories customers can browse together.
        </Text>
      </View>
      <Text style={s.section}>
        {editing ? "Edit collection" : "New collection"}
      </Text>
      <View style={s.card}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Collection name"
          placeholderTextColor={palette.mutedText}
          style={s.input}
        />
        <TextInput
          value={theme}
          onChangeText={setTheme}
          placeholder="Theme or short story"
          placeholderTextColor={palette.mutedText}
          multiline
          style={[s.input, s.multiline]}
        />
        <View style={s.actions}>
          {editing ? (
            <Pressable onPress={reset} style={s.secondary}>
              <Text style={s.secondaryText}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={busy || !name.trim()}
            onPress={() => void save()}
            style={s.primary}
          >
            <Text style={s.primaryText}>
              {busy
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create collection"}
            </Text>
          </Pressable>
        </View>
      </View>
      <Text style={s.section}>Your collections</Text>
      <View style={s.list}>
        {items.map((item) => (
          <View key={item.collection_id} style={s.card}>
            <View style={s.row}>
              <View style={s.copy}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.hint}>
                  {item.theme || "No theme yet"} · {item.status}
                </Text>
              </View>
              <Pressable onPress={() => edit(item)} style={s.secondary}>
                <Text style={s.secondaryText}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => status(item)} style={s.secondary}>
                <Text style={s.secondaryText}>
                  {item.status === "active" ? "Retire" : "Restore"}
                </Text>
              </Pressable>
              <Pressable onPress={() => remove(item)} style={s.danger}>
                <Ionicons
                  name="trash-outline"
                  size={15}
                  color={palette.danger}
                />
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
    list: { gap: spacing(1) },
    card: {
      backgroundColor: p.white,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing(1),
      padding: spacing(1.75),
      ...shadow.card,
    },
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
    multiline: { minHeight: 78, textAlignVertical: "top" },
    actions: {
      flexDirection: "row",
      gap: spacing(0.75),
      justifyContent: "flex-end",
    },
    primary: {
      backgroundColor: p.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.1),
    },
    primaryText: {
      color: p.onAccent,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
    secondary: {
      borderColor: p.burgundy,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing(1.1),
      paddingVertical: spacing(0.8),
    },
    secondaryText: {
      color: p.burgundy,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
    },
    danger: {
      alignItems: "center",
      borderColor: p.danger,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      padding: spacing(0.8),
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
