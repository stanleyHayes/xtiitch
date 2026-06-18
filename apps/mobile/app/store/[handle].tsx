import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";

import { api, formatGHS, type Design, type StorePage } from "../../src/api";
import { CenterState, ImageTile } from "../../src/ui";
import { fonts, palette, radius, shadow, spacing } from "../../src/theme";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; page: StorePage };

function lowestPriceMinor(design: Design): number | null {
  if (design.prices.length === 0) return null;
  return design.prices.reduce(
    (min, price) => Math.min(min, price.price_minor),
    design.prices[0].price_minor,
  );
}

export default function StoreScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!handle) return;
    setState({ phase: "loading" });
    const result = await api.store(handle);
    if (result.ok) {
      setState({ phase: "ready", page: result.data });
    } else {
      setState({
        phase: "error",
        message:
          result.status === 404
            ? `No store found at "${handle}".`
            : "Couldn't reach this store. Check your connection and retry.",
      });
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state.phase === "ready") {
      navigation.setOptions({ title: state.page.store.name });
    }
  }, [navigation, state]);

  const runSearch = async () => {
    if (!handle) return;
    const clean = query.trim();
    setSearching(true);
    const result = clean
      ? await api.search(handle, clean)
      : await api.store(handle);
    if (result.ok) setState({ phase: "ready", page: result.data });
    setSearching(false);
  };

  if (state.phase === "loading") {
    return <CenterState loading />;
  }

  if (state.phase === "error") {
    return (
      <CenterState title="Store unavailable" hint={state.message} />
    );
  }

  const { store, designs } = state.page;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: store.name }} />

      <View style={styles.storeHeader}>
        <View
          style={[
            styles.brandDot,
            { backgroundColor: store.brand_color || palette.burgundy },
          ]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeHandle}>
            {store.handle}.xtiitch.com · {designs.length} piece
            {designs.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search this studio"
          placeholderTextColor={palette.mutedText}
          autoCapitalize="none"
          style={styles.search}
          returnKeyType="search"
          onSubmitEditing={runSearch}
        />
        <Pressable
          onPress={runSearch}
          style={({ pressed }) => [
            styles.searchButton,
            pressed && { backgroundColor: palette.burgundyDeep },
          ]}
        >
          <Text style={styles.searchButtonText}>
            {searching ? "…" : "Go"}
          </Text>
        </Pressable>
      </View>

      {designs.length === 0 ? (
        <View style={styles.emptyGrid}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyHint}>
            This studio hasn't published any pieces for this view.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {designs.map((design) => {
            const minor = lowestPriceMinor(design);
            return (
              <Pressable
                key={design.design_id}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => router.push(`/design/${design.handle}`)}
              >
                <ImageTile
                  uri={design.images[0]}
                  seed={design.handle}
                  style={styles.cardImage}
                  radiusOverride={0}
                />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {design.title}
                  </Text>
                  <Text style={styles.cardPrice}>
                    {minor === null ? "Ask for price" : `from ${formatGHS(minor)}`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const CARD_GAP = spacing(2);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing(3), paddingBottom: spacing(5) },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    marginBottom: spacing(2.5),
  },
  brandDot: { width: 44, height: 44, borderRadius: radius.pill },
  storeName: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: palette.ink,
    fontWeight: "700",
  },
  storeHandle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.mutedText,
    marginTop: spacing(0.25),
  },
  searchRow: {
    flexDirection: "row",
    gap: spacing(1.25),
    marginBottom: spacing(2.5),
  },
  search: {
    flex: 1,
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
  searchButton: {
    backgroundColor: palette.burgundy,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    justifyContent: "center",
  },
  searchButtonText: {
    color: palette.white,
    fontFamily: fonts.body,
    fontWeight: "800",
    fontSize: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },
  card: {
    flexGrow: 1,
    flexBasis: "46%",
    maxWidth: "48%",
    backgroundColor: palette.white,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadow.card,
  },
  cardImage: { width: "100%", height: 150 },
  cardBody: { padding: spacing(1.5) },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: palette.ink,
    lineHeight: 21,
  },
  cardPrice: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    color: palette.burgundy,
    marginTop: spacing(0.5),
  },
  emptyGrid: {
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
