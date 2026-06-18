import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { formatGHS } from "../../src/api";
import { loadSession, logout, type BusinessSession } from "../../src/auth";
import {
  businessApi,
  isOrderOpen,
  type BusinessOrder,
  type BusinessProfile,
} from "../../src/businessApi";
import { CenterState, OrderRow } from "../../src/ui";
import { fonts, palette, radius, spacing } from "../../src/theme";

export default function BusinessDashboardScreen() {
  const router = useRouter();
  const [session, setSession] = useState<BusinessSession | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [orders, setOrders] = useState<BusinessOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    const [ordersResult, meResult] = await Promise.all([
      businessApi.orders(),
      businessApi.me(),
    ]);
    if (
      (!ordersResult.ok && ordersResult.expired) ||
      (!meResult.ok && meResult.expired)
    ) {
      toLogin();
      return;
    }
    if (ordersResult.ok) setOrders(ordersResult.data.orders);
    if (meResult.ok) setProfile(meResult.data);
  }, [toLogin]);

  // Guard the route and load on focus so a fresh login lands here populated.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((current) => {
        if (!active) return;
        if (!current) {
          toLogin();
          return;
        }
        setSession(current);
        fetchData().finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [fetchData, toLogin]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const onLogout = async () => {
    await logout();
    toLogin();
  };

  if (loading) return <CenterState loading />;

  const list = orders ?? [];
  const openCount = list.filter(isOrderOpen).length;
  const settledMinor = list.reduce((sum, order) => sum + order.settled_minor, 0);
  const recent = list.slice(0, 4);

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
          title: session?.business_handle ?? "Studio",
          headerRight: () => (
            <Pressable onPress={onLogout} hitSlop={10}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.greeting}>
        <Text style={styles.hello}>{session?.business_handle}</Text>
        <Text style={styles.role}>
          Signed in{profile?.role ? ` · ${profile.role}` : ""}
        </Text>
      </View>

      <View style={styles.kpiRow}>
        <Kpi label="Total orders" value={String(list.length)} />
        <Kpi label="Open" value={String(openCount)} tone={palette.warning} />
        <Kpi label="Settled" value={formatGHS(settledMinor)} tone={palette.success} wide />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Recent orders</Text>
        <Pressable onPress={() => router.push("/business/orders")}>
          <Text style={styles.viewAll}>View all ›</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyHint}>
            New orders from your storefront will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.orderList}>
          {recent.map((order) => (
            <OrderRow key={order.order_id} order={order} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Kpi({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: string;
  tone?: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.kpi, wide && styles.kpiWide]}>
      <Text style={[styles.kpiValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing(3), paddingBottom: spacing(6) },
  signOut: {
    color: palette.white,
    fontFamily: fonts.body,
    fontWeight: "700",
    fontSize: 14,
  },
  greeting: { marginBottom: spacing(2.5) },
  hello: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: palette.ink,
    fontWeight: "700",
  },
  role: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.mutedText,
    textTransform: "capitalize",
    marginTop: spacing(0.25),
  },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.5) },
  kpi: {
    flexGrow: 1,
    flexBasis: "30%",
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.softBorder,
    padding: spacing(2),
  },
  kpiWide: { flexBasis: "100%" },
  kpiValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: "700",
    color: palette.ink,
  },
  kpiLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: palette.mutedText,
    marginTop: spacing(0.5),
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing(3.5),
    marginBottom: spacing(1.5),
  },
  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: palette.mutedText,
  },
  viewAll: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    color: palette.burgundy,
  },
  orderList: { gap: spacing(1.5) },
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
    textAlign: "center",
    marginTop: spacing(0.75),
    lineHeight: 20,
  },
});
