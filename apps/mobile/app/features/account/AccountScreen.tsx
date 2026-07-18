import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { formatGHS } from "../../../src/api";
import {
  CustomerSessionExpiredError,
  fetchCustomerOrders,
  fetchCustomerProfile,
  loadSession,
  logout,
  type CustomerOrder,
  type CustomerProfile,
  type CustomerSession,
} from "../../../src/customerAuth";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { CenterState } from "../../../src/ui";
import SignInFlow from "./SignInFlow";

type OrdersState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; orders: CustomerOrder[] };

// Only internal app paths may be returned to after sign-in — the web account
// action applies the same rule with safeRedirect.
function safeReturnTo(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "";
}

export default function AccountScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const [session, setSession] = useState<CustomerSession | null | undefined>();

  useEffect(() => {
    let active = true;
    loadSession().then((next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const onSignedIn = useCallback(
    (next: CustomerSession) => {
      if (returnTo) {
        // Arrived from a §3b pay gate — return to the design screen, which
        // stayed mounted underneath with the shopper's form intact.
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(returnTo);
        }
        return;
      }
      setSession(next);
    },
    [returnTo, router],
  );

  if (session === undefined) return <CenterState loading />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Account" }} />
      {session ? (
        <SignedInAccount
          session={session}
          onSignedOut={() => setSession(null)}
        />
      ) : (
        <SignInFlow gated={Boolean(returnTo)} onSignedIn={onSignedIn} />
      )}
    </View>
  );
}

function SignedInAccount({
  session,
  onSignedOut,
}: {
  session: CustomerSession;
  onSignedOut: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [ordersState, setOrdersState] = useState<OrdersState>({
    phase: "loading",
  });

  const load = useCallback(async () => {
    setOrdersState({ phase: "loading" });
    try {
      const [orders, me] = await Promise.all([
        fetchCustomerOrders(),
        fetchCustomerProfile(),
      ]);
      setProfile(me);
      setOrdersState({ phase: "ready", orders });
    } catch (error) {
      // A 401 cleared the session — drop back to the sign-in flow.
      if (error instanceof CustomerSessionExpiredError) {
        onSignedOut();
        return;
      }
      setOrdersState({ phase: "error" });
    }
  }, [onSignedOut]);

  // Refresh on every focus, so an order placed after sign-in shows up here.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const displayName =
    profile?.display_name || session.phone || session.email || "Signed in";
  const detailLines = [profile?.phone ?? session.phone, profile?.email ?? session.email]
    .filter((line) => line.trim().length > 0 && line !== displayName)
    .join(" · ");

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.profileCard}>
        <Text style={styles.profileKicker}>SIGNED IN</Text>
        <Text style={styles.profileName}>{displayName}</Text>
        {detailLines ? (
          <Text style={styles.profileDetail}>{detailLines}</Text>
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Your orders</Text>
      <OrderHistory
        state={ordersState}
        onRetry={load}
        onOpen={(orderId) => router.push(`/track/${orderId}`)}
      />

      <Pressable
        onPress={() => {
          void logout().then(onSignedOut);
        }}
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function OrderHistory({
  state,
  onRetry,
  onOpen,
}: {
  state: OrdersState;
  onRetry: () => void;
  onOpen: (orderId: string) => void;
}) {
  if (state.phase === "loading") return <CenterState loading />;
  if (state.phase === "error") {
    return (
      <CenterState
        title="Couldn't load your orders"
        hint="Check your connection and retry."
        onRetry={onRetry}
      />
    );
  }
  if (state.orders.length === 0) {
    return (
      <CenterState
        title="No orders yet"
        hint="Pieces you order while signed in will show up here."
      />
    );
  }
  return (
    <View style={{ gap: spacing(1.5) }}>
      {state.orders.map((order) => (
        <OrderHistoryRow
          key={order.order_id}
          order={order}
          onPress={() => onOpen(order.order_id)}
        />
      ))}
    </View>
  );
}

// Status pill colours, mirroring the business lane's orderTone mapping.
function statusTone(status: string, palette: Palette): string {
  switch (status.toLowerCase()) {
    case "fulfilled":
      return palette.success;
    case "cancelled":
      return palette.danger;
    case "confirmed":
      return palette.warning;
    case "draft":
    case "awaiting_deposit":
      return palette.info;
    default:
      return palette.burgundy;
  }
}

function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function OrderHistoryRow({
  order,
  onPress,
}: {
  order: CustomerOrder;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.orderTop}>
        <Text style={styles.orderDesign} numberOfLines={1}>
          {order.design_title}
        </Text>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: statusTone(order.status, palette) },
          ]}
        >
          <Text style={styles.statusPillText}>{order.status}</Text>
        </View>
      </View>
      <Text style={styles.orderStore} numberOfLines={1}>
        {order.business_name}
      </Text>
      <View style={styles.orderBottom}>
        <Text style={styles.orderTotal}>
          {formatGHS(order.agreed_total_minor)}
        </Text>
        <Text style={styles.orderDate}>{formatOrderDate(order.created_at)}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    profileCard: {
      backgroundColor: palette.ink,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      ...shadow.card,
    },
    profileKicker: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
      color: palette.gold,
    },
    profileName: {
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "700",
      color: palette.onAccent,
      marginTop: spacing(0.5),
    },
    profileDetail: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: "rgba(255,255,255,0.7)",
      marginTop: spacing(0.5),
    },
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(3),
      marginBottom: spacing(1.5),
    },
    orderRow: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
      gap: spacing(0.75),
    },
    orderTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    orderDesign: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 17,
      color: palette.ink,
    },
    statusPill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    statusPillText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    orderStore: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    orderBottom: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: spacing(0.5),
    },
    orderTotal: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.burgundy,
    },
    orderDate: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
    },
    signOut: {
      borderWidth: 1.5,
      borderColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.75),
      alignItems: "center",
      marginTop: spacing(4),
    },
    signOutText: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
    },
  });
