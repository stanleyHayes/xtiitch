import { useCallback, useState, useMemo } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../src/auth";
import {
  businessApi,
  isOrderOpen,
  type BusinessOrder,
} from "../../src/businessApi";
import { CenterState, OrderRow } from "../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";

type Filter = "all" | "open" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "done", label: "Fulfilled" },
];

export default function BusinessOrdersScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [orders, setOrders] = useState<BusinessOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchOrders = useCallback(async () => {
    const result = await businessApi.orders();
    if (!result.ok) {
      if (result.expired) {
        router.replace("/business/login");
        return;
      }
      setFetchError(true);
      return;
    }
    setFetchError(false);
    setOrders(result.data.orders);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((session) => {
        if (!active) return;
        if (!session) {
          router.replace("/business/login");
          return;
        }
        fetchOrders().finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [fetchOrders, router]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void fetchOrders().finally(() => setLoading(false));
  };

  if (loading) return <CenterState loading />;

  if (fetchError && orders === null) {
    return (
      <CenterState
        title="Couldn't load orders"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const all = orders ?? [];
  const visible = all.filter((order) => {
    if (filter === "open") return isOrderOpen(order);
    if (filter === "done") return !isOrderOpen(order);
    return true;
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.burgundy} />
      }
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("/business/new-order")} hitSlop={10}>
              <Text style={styles.headerAction}>+ New</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.tabs}>
        {FILTERS.map((tab) => {
          const active = filter === tab.key;
          const count =
            tab.key === "all"
              ? all.length
              : tab.key === "open"
                ? all.filter(isOrderOpen).length
                : all.filter((order) => !isOrderOpen(order)).length;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
              <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing here</Text>
          <Text style={styles.emptyHint}>No orders match this filter.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((order) => (
            <OrderRow
              key={order.order_id}
              order={order}
              onPress={() => router.push(`/business/order/${order.order_id}`)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing(3), paddingBottom: spacing(6) },
  headerAction: {
    color: palette.onAccent,
    fontFamily: fonts.body,
    fontWeight: "800",
    fontSize: 14,
  },
  tabs: { flexDirection: "row", gap: spacing(1), marginBottom: spacing(2.5) },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.softBorder,
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(0.75),
    backgroundColor: palette.white,
  },
  tabActive: { borderColor: palette.burgundy, backgroundColor: palette.burgundy },
  tabText: { fontFamily: fonts.body, fontSize: 14, fontWeight: "700", color: palette.ink },
  tabTextActive: { color: palette.onAccent },
  tabBadge: {
    minWidth: 20,
    alignItems: "center",
    borderRadius: radius.pill,
    paddingHorizontal: spacing(0.5),
    backgroundColor: "rgba(21,17,26,0.08)",
  },
  tabBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabBadgeText: { fontFamily: fonts.body, fontSize: 12, fontWeight: "800", color: palette.ink },
  tabBadgeTextActive: { color: palette.onAccent },
  list: { gap: spacing(1.5) },
  empty: {
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.softBorder,
    padding: spacing(3),
    alignItems: "center",
  },
  emptyTitle: { fontFamily: fonts.display, fontSize: 18, color: palette.ink },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.mutedText,
    marginTop: spacing(0.75),
  },
});
