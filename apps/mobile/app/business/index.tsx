import { useCallback, useState, useMemo, type ComponentProps } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { formatGHS } from "../../src/api";
import { loadSession, logout, type BusinessSession } from "../../src/auth";
import {
  businessApi,
  isOrderOpen,
  type BusinessOrder,
  type BusinessProfile,
} from "../../src/businessApi";
import { CenterState, OrderRow } from "../../src/ui";
import { useTheme } from "../../src/theme-mode";
import { makeStyles } from "./business-dashboard.styles";
import { Kpi } from "./business-dashboard-kpi";

export default function BusinessDashboardScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [session, setSession] = useState<BusinessSession | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [orders, setOrders] = useState<BusinessOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

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
    if (ordersResult.ok) {
      setFetchError(false);
      setOrders(ordersResult.data.orders);
    } else {
      setFetchError(true);
    }
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

  const retry = () => {
    setLoading(true);
    void fetchData().finally(() => setLoading(false));
  };

  const onLogout = async () => {
    await logout();
    toLogin();
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

  const list = orders ?? [];
  const openCount = list.filter(isOrderOpen).length;
  const settledMinor = list.reduce(
    (sum, order) => sum + order.settled_minor,
    0,
  );
  const recent = list.slice(0, 4);
  const canManage = profile?.role === "owner" || profile?.role === "admin";
  const menuItems = MENU_ITEMS.filter((item) => canManage || item.staffVisible);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.burgundy}
        />
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

      <StudioGreeting
        handle={session?.business_handle ?? "Studio"}
        role={profile?.role}
      />

      <View style={styles.kpiRow}>
        <Kpi label="Total orders" value={String(list.length)} />
        <Kpi label="Open" value={String(openCount)} tone={palette.warning} />
        {canManage ? (
          <Kpi
            label="Settled"
            value={formatGHS(settledMinor)}
            tone={palette.success}
            wide
          />
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.newOrderCta,
          pressed && { opacity: 0.9 },
        ]}
        onPress={() => router.push("/business/new-order")}
      >
        <Text style={styles.newOrderCtaText}>+ New walk-in order</Text>
      </Pressable>

      <RecentOrders orders={recent} />

      <ManageGrid items={menuItems} />
    </ScrollView>
  );
}

// Business-lane sections beyond orders — one tile per route under
// app/business/. Keep titles short; the hint says what lives inside.
type IconName = ComponentProps<typeof Ionicons>["name"];
const MENU_ITEMS: {
  href: string;
  title: string;
  hint: string;
  icon: IconName;
  staffVisible?: boolean;
}[] = [
  {
    href: "/business/catalogue",
    title: "Catalogue",
    hint: "Designs & collections",
    icon: "shirt-outline",
  },
  {
    href: "/business/store-settings",
    title: "Store settings",
    hint: "Services, layout & fees",
    icon: "options-outline",
  },
  {
    href: "/business/measurements",
    title: "Measurements",
    hint: "Bespoke fit template",
    icon: "resize-outline",
  },
  {
    href: "/business/money",
    title: "Money",
    hint: "Income, transactions & takings",
    icon: "wallet-outline",
  },
  {
    href: "/business/reports",
    title: "Reports",
    hint: "Sales & studio pulse",
    icon: "stats-chart-outline",
  },
  {
    href: "/business/bookings",
    title: "Bookings",
    hint: "Appointments & availability",
    icon: "calendar-outline",
    staffVisible: true,
  },
  {
    href: "/business/handovers",
    title: "Handovers",
    hint: "Pickups & deliveries",
    icon: "cube-outline",
    staffVisible: true,
  },
  {
    href: "/business/customers",
    title: "Customers",
    hint: "CRM list & profiles",
    icon: "people-outline",
    staffVisible: true,
  },
  {
    href: "/business/promotions",
    title: "Promotions",
    hint: "Discount codes",
    icon: "pricetag-outline",
  },
  {
    href: "/business/affiliates",
    title: "Affiliates",
    hint: "Creator partnerships",
    icon: "megaphone-outline",
  },
  {
    href: "/business/waitlist",
    title: "Waitlist",
    hint: "Design demand",
    icon: "hourglass-outline",
    staffVisible: true,
  },
  {
    href: "/business/team",
    title: "Team",
    hint: "Members & roles",
    icon: "person-add-outline",
  },
  {
    href: "/business/account",
    title: "Account & security",
    hint: "Profile, password & MFA",
    icon: "shield-checkmark-outline",
    staffVisible: true,
  },
  {
    href: "/business/billing",
    title: "Plan & billing",
    hint: "Package and renewal",
    icon: "card-outline",
  },
  {
    href: "/business/notifications",
    title: "Notifications",
    hint: "Message log",
    icon: "notifications-outline",
    staffVisible: true,
  },
  {
    href: "/business/help",
    title: "Help centre",
    hint: "Guides and support",
    icon: "help-buoy-outline",
    staffVisible: true,
  },
];

function StudioGreeting({ handle, role }: { handle: string; role?: string }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.greeting}>
      <View style={styles.greetingMark}>
        <Ionicons name="cut-outline" size={30} color={palette.gold} />
      </View>
      <View style={styles.greetingCopy}>
        <Text style={styles.eyebrow}>STUDIO DESK</Text>
        <Text style={styles.hello}>{handle}</Text>
        <Text style={styles.role}>
          {role ? `${role} workspace` : "Signed in"}
        </Text>
      </View>
    </View>
  );
}

function ManageGrid({ items }: { items: typeof MENU_ITEMS }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Manage</Text>
      </View>
      <View style={styles.menuGrid}>
        {items.map((item) => (
          <Pressable
            key={item.href}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push(item.href)}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={20} color={palette.burgundy} />
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuHint}>{item.hint}</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={palette.mauve}
              style={styles.menuArrow}
            />
          </Pressable>
        ))}
      </View>
    </>
  );
}

function RecentOrders({ orders }: { orders: BusinessOrder[] }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Recent orders</Text>
        <Pressable onPress={() => router.push("/business/orders")}>
          <Text style={styles.viewAll}>View all ›</Text>
        </Pressable>
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyHint}>
            New orders from your storefront will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.orderList}>
          {orders.map((order) => (
            <OrderRow
              key={order.order_id}
              order={order}
              onPress={() => router.push(`/business/order/${order.order_id}`)}
            />
          ))}
        </View>
      )}
    </>
  );
}
