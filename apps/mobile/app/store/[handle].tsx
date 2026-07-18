import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useNavigation, useRouter } from "expo-router";

import { api, type StorePage } from "../../src/api";
import { CenterState } from "../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import StoreCollectionsStrip from "../features/store/StoreCollectionsStrip";
import StoreDesignGrid from "../features/store/StoreDesignGrid";
import StoreDiscoverStrip from "../features/store/StoreDiscoverStrip";
import StoreHeader from "../features/store/StoreHeader";
import StorePoweredByBadge from "../features/store/StorePoweredByBadge";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; page: StorePage };

export default function StoreScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);

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
      // Override the global brand-logo headerTitle with this store's name.
      navigation.setOptions({
        title: state.page.store.name,
        headerTitle: state.page.store.name,
      });
    }
  }, [navigation, state]);

  const runSearch = async () => {
    if (!handle) return;
    const clean = query.trim();
    setSearching(true);
    setSearchError(null);
    const result = clean
      ? await api.search(handle, clean)
      : await api.store(handle);
    setSearching(false);
    if (result.ok) {
      setState({ phase: "ready", page: result.data });
    } else {
      setSearchError(
        result.status === 0
          ? "Network error — search didn't go through. Try again."
          : "Search didn't go through. Try again.",
      );
    }
  };

  if (state.phase === "loading") {
    return <CenterState loading />;
  }

  if (state.phase === "error") {
    return (
      <CenterState
        title="Store unavailable"
        hint={state.message}
        onRetry={load}
      />
    );
  }

  const { store, collections, designs } = state.page;
  const brandColor = store.brand_color || palette.burgundy;
  const showCollections =
    store.settings.collections_enabled && collections.length > 0;
  const visibleDesigns = collectionId
    ? designs.filter((design) => design.collection_id === collectionId)
    : designs;
  // Paid plans get a clean, distraction-free store with no cross-promotion.
  const showDiscover = store.plan_code === "free";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: store.name }} />

      <StoreHeader store={store} designCount={visibleDesigns.length} />

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

      {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}

      {showCollections ? (
        <StoreCollectionsStrip
          collections={collections}
          brandColor={brandColor}
          selectedId={collectionId}
          onSelect={setCollectionId}
        />
      ) : null}

      <StoreDesignGrid
        designs={visibleDesigns}
        onOpen={(design) => router.push(`/design/${design.handle}`)}
      />

      {showDiscover ? (
        <StoreDiscoverStrip onExplore={() => router.push("/")} />
      ) : null}

      {/* The API resolves this from the plan's entitlement, so an older payload
          that omits it shows the badge — the safe default is attribution. */}
      {store.show_powered_by_badge !== false ? (
        <StorePoweredByBadge brand={brandColor} />
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing(3), paddingBottom: spacing(5) },
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
    color: palette.onAccent,
    fontFamily: fonts.body,
    fontWeight: "800",
    fontSize: 15,
  },
  searchError: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.danger,
    marginTop: -spacing(1.25),
    marginBottom: spacing(2),
  },
});
