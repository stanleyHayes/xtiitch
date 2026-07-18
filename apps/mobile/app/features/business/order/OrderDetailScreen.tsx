import { useCallback, useState, useMemo } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { api, formatGHS, type Tracking } from "../../../../src/api";
import { loadSession } from "../../../../src/auth";
import {
  businessApi,
  formatOrderDate,
  orderTone,
  paymentStatusLabel,
  type BusinessOrder,
  type BusinessProfile,
} from "../../../../src/businessApi";
import { CenterState, StageTimeline } from "../../../../src/ui";
import { fonts, radius, shadow, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import OrderDetailRow from "./OrderDetailRow";
import OrderPaymentActions from "./OrderPaymentActions";

// The effective money target of an order: the negotiated total for bespoke,
// the checkout amount for online orders (web dashboard features/orders/utils.ts).
function orderTargetMinor(order: BusinessOrder): number | null {
  return order.agreed_total_minor ?? order.payment_amount_minor;
}

function balanceDueMinor(order: BusinessOrder): number {
  const target = orderTargetMinor(order);
  return target === null ? 0 : Math.max(target - order.settled_minor, 0);
}

function formatOrderTotal(order: BusinessOrder): string {
  const target = orderTargetMinor(order);
  return target === null ? "Not set" : formatGHS(target);
}

// The web builds the wa.me link from customer_whatsapp, falling back to phone.
function whatsappNumber(order: BusinessOrder): string {
  return order.customer_whatsapp || order.customer_phone;
}

export default function OrderDetailScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<BusinessOrder | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toLogin = useCallback(() => router.replace("/business/login"), [router]);

  const load = useCallback(async () => {
    if (!id) return;
    const [ordersResult, trackingResult, meResult] = await Promise.all([
      businessApi.orders(),
      api.tracking(id),
      businessApi.me(),
    ]);
    if (!ordersResult.ok) {
      if (ordersResult.expired) {
        toLogin();
        return;
      }
      setFetchError(true);
      return;
    }
    setFetchError(false);
    const match = ordersResult.data.orders.find((o) => o.order_id === id) ?? null;
    setOrder(match);
    setNotFound(!match);
    if (trackingResult.ok) setTracking(trackingResult.data);
    if (meResult.ok) setProfile(meResult.data);
  }, [id, toLogin]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((session) => {
        if (!active) return;
        if (!session) {
          toLogin();
          return;
        }
        load().finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [load, toLogin]),
  );

  // Pull-to-refresh: the customer pays through the external Paystack page, so
  // the merchant needs a way to re-check settlement without leaving.
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  };

  const advance = async () => {
    if (!id) return;
    setAdvancing(true);
    setError(null);
    const result = await businessApi.advanceOrder(id);
    if (result.ok) {
      setTracking(result.data);
      // Refresh the order row so status/settled reflect the new stage.
      const orders = await businessApi.orders();
      if (orders.ok) {
        setOrder(orders.data.orders.find((o) => o.order_id === id) ?? order);
      }
    } else if (result.expired) {
      toLogin();
      return;
    } else {
      setError("Couldn't advance this order right now. Pull to refresh and try again.");
    }
    setAdvancing(false);
  };

  if (loading) return <CenterState loading />;
  if (fetchError && !order) {
    return (
      <CenterState
        title="Couldn't load this order"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }
  if (notFound || !order) {
    return (
      <CenterState
        title="Order not found"
        hint="This order isn't in your current list."
      />
    );
  }

  const tone = orderTone(order.status);

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
      <Stack.Screen options={{ title: "Order" }} />

      <View style={styles.headerCard}>
        <Text style={styles.design}>{order.design_title}</Text>
        <View style={[styles.statusPill, { backgroundColor: tone }]}>
          <Text style={styles.statusPillText}>{order.stage_name || order.status}</Text>
        </View>
        <Text style={styles.meta}>
          {order.order_type} · {order.channel} · {formatOrderDate(order.created_at)}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Customer</Text>
      <CustomerCard order={order} />

      <Text style={styles.sectionLabel}>Payment</Text>
      <PaymentCard order={order} />

      <Text style={styles.sectionLabel}>Money actions</Text>
      <OrderPaymentActions
        order={order}
        orderId={id}
        balanceMinor={balanceDueMinor(order)}
        role={profile?.role ?? null}
        onLoad={load}
        onExpired={toLogin}
        onSetError={setError}
      />

      {tracking ? (
        <>
          <Text style={styles.sectionLabel}>Fulfilment</Text>
          <StageTimeline stages={tracking.stages} />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AdvanceFooter status={order.status} advancing={advancing} onAdvance={advance} />
    </ScrollView>
  );
}

function CustomerCard({ order }: { order: BusinessOrder }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const whatsapp = whatsappNumber(order);
  return (
    <View style={styles.card}>
      <OrderDetailRow label="Name" value={order.customer_name} />
      <OrderDetailRow
        label="Phone"
        value={order.customer_phone || "—"}
        href={
          order.customer_phone
            ? `tel:${order.customer_phone.replace(/\s+/g, "")}`
            : undefined
        }
      />
      <OrderDetailRow
        label="Email"
        value={order.customer_email || "—"}
        href={order.customer_email ? `mailto:${order.customer_email}` : undefined}
      />
      {whatsapp ? (
        <OrderDetailRow
          label="WhatsApp"
          value={whatsapp}
          href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`}
        />
      ) : null}
    </View>
  );
}

function PaymentCard({ order }: { order: BusinessOrder }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const target = orderTargetMinor(order);
  const balance = balanceDueMinor(order);
  const balanceTone = balance > 0 ? palette.warning : palette.success;
  return (
    <View style={styles.card}>
      <OrderDetailRow label="Agreed total" value={formatOrderTotal(order)} strong />
      <OrderDetailRow label="Settled" value={formatGHS(order.settled_minor)} />
      <OrderDetailRow
        label="Balance due"
        value={target === null ? "—" : formatGHS(balance)}
        strong={target !== null && balance > 0}
        tone={target === null ? undefined : balanceTone}
      />
      <OrderDetailRow label="Payment status" value={paymentStatusLabel(order)} />
    </View>
  );
}

// The API fulfils an order by advancing it PAST its final stage, so advance
// must stay enabled for the whole confirmed lifecycle. Every other status
// hides the action — fulfilled gets a labelled disabled state, matching the
// web dashboard's OrderActions gating.
function AdvanceFooter({
  status,
  advancing,
  onAdvance,
}: {
  status: string;
  advancing: boolean;
  onAdvance: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const value = status.toLowerCase();
  if (value === "fulfilled") {
    return (
      <View style={[styles.cta, styles.ctaDisabled]}>
        <Text style={styles.ctaText}>Order complete</Text>
      </View>
    );
  }
  if (value !== "confirmed") return null;
  return (
    <Pressable
      disabled={advancing}
      onPress={onAdvance}
      style={[styles.cta, advancing && styles.ctaDisabled]}
    >
      <Text style={styles.ctaText}>
        {advancing ? "Advancing…" : "Advance to next stage"}
      </Text>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    headerCard: {
      backgroundColor: palette.white,
      borderRadius: radius.lg,
      padding: spacing(3),
      ...shadow.card,
    },
    design: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: palette.ink,
      fontWeight: "700",
    },
    statusPill: {
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(0.75),
      marginTop: spacing(1.5),
    },
    statusPillText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontWeight: "800",
      fontSize: 13,
      textTransform: "capitalize",
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(1.5),
      textTransform: "capitalize",
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
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      paddingHorizontal: spacing(2),
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(2),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
      marginTop: spacing(3),
    },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
  });
