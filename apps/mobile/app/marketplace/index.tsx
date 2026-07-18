import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";

import {
  marketplaceApi,
  type Shop,
  type ShopDesign,
} from "../../src/marketplaceApi";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { CenterState } from "../../src/ui";
import MarketplaceDesignCard from "../features/marketplace/MarketplaceDesignCard";
import MarketplaceFilterBar from "../features/marketplace/MarketplaceFilterBar";
import StudioCard from "../features/marketplace/StudioCard";
import {
  emptyCopy,
  flattenDesigns,
  visibleDesigns,
  visibleStudios,
  type FlatDesign,
  type MarketplaceTab,
  type SortKey,
} from "../features/marketplace/marketplaceUtils";

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; shops: Shop[] };

export default function MarketplaceScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [tab, setTab] = useState<MarketplaceTab>("studios");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    const result = await marketplaceApi.shops();
    if (result.ok) {
      setState({ phase: "ready", shops: result.data.shops });
    } else {
      setState({ phase: "error" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const designs = useMemo(
    () => flattenDesigns(state.phase === "ready" ? state.shops : []),
    [state],
  );
  const studios = useMemo(
    () => visibleStudios(state.phase === "ready" ? state.shops : [], search, sort),
    [state, search, sort],
  );
  const designList = useMemo(
    () => visibleDesigns(designs, search, sort),
    [designs, search, sort],
  );

  const changeTab = (next: MarketplaceTab) => {
    setTab(next);
    // Price sorts only apply to designs; reset so no hidden chip stays active.
    setSort("popular");
  };

  const openShop = (shop: Shop) => {
    router.push(`/store/${encodeURIComponent(shop.handle)}`);
  };
  const openDesign = (design: ShopDesign | FlatDesign) => {
    router.push(`/design/${encodeURIComponent(design.handle)}`);
  };

  if (state.phase === "loading") {
    return <CenterState loading />;
  }

  if (state.phase === "error") {
    return (
      <CenterState
        title="Marketplace unavailable"
        hint="Couldn't reach the marketplace. Check your connection and retry."
        onRetry={load}
      />
    );
  }

  const list = tab === "studios" ? studios : designList;
  const copy = emptyCopy(tab, search);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Marketplace" }} />
      <View style={styles.hero}>
        <Text style={styles.kicker}>MARKETPLACE</Text>
        <Text style={styles.heroTitle}>
          Ghana&apos;s fashion studios, in one place.
        </Text>
        <Text style={styles.heroLead}>
          Browse studios and their designs — no account needed to look.
        </Text>
      </View>

      <View style={styles.body}>
        <MarketplaceFilterBar
          tab={tab}
          onTabChange={changeTab}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
        />

        {list.length === 0 ? (
          <CenterState
            title={copy.title}
            hint={copy.hint}
            onRetry={search.trim() ? () => setSearch("") : undefined}
            retryLabel="Clear search"
          />
        ) : tab === "studios" ? (
          <View style={styles.studioList}>
            {studios.map((shop) => (
              <StudioCard
                key={shop.handle}
                shop={shop}
                onOpenShop={openShop}
                onOpenDesign={openDesign}
              />
            ))}
          </View>
        ) : (
          <View style={styles.designGrid}>
            {designList.map((design) => (
              <MarketplaceDesignCard
                key={`${design.store_handle}-${design.handle}`}
                design={design}
                onOpen={openDesign}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { paddingBottom: spacing(5) },
    hero: {
      backgroundColor: palette.burgundy,
      paddingHorizontal: spacing(3),
      paddingTop: spacing(3),
      paddingBottom: spacing(4),
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
    },
    kicker: {
      color: palette.gold,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 2,
    },
    heroTitle: {
      color: palette.onAccent,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "800",
      lineHeight: 32,
      marginTop: spacing(1),
    },
    heroLead: {
      color: "rgba(255,255,255,0.86)",
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      marginTop: spacing(1.5),
    },
    body: {
      paddingHorizontal: spacing(3),
      paddingTop: spacing(3),
      gap: spacing(2.5),
    },
    studioList: { gap: spacing(2.5) },
    designGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(2),
    },
  });
