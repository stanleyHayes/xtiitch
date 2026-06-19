import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { api, formatGHS, type Tracking } from "../../../src/api";
import { loadSession } from "../../../src/auth";
import {
  businessApi,
  orderTone,
  type BusinessOrder,
} from "../../../src/businessApi";
import { CenterState, StageTimeline } from "../../../src/ui";
import { fonts, palette, radius, shadow, spacing } from "../../../src/theme";

function atFinalStage(tracking: Tracking | null): boolean {
  if (!tracking || tracking.stages.length === 0) return false;
  const ordered = [...tracking.stages].sort((a, b) => a.sequence - b.sequence);
  const last = ordered[ordered.length - 1];
  return last.is_current || last.is_complete;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<BusinessOrder | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toLogin = useCallback(() => router.replace("/business/login"), [router]);

  const load = useCallback(async () => {
    if (!id) return;
    const [ordersResult, trackingResult] = await Promise.all([
      businessApi.orders(),
      api.tracking(id),
    ]);
    if (!ordersResult.ok) {
      if (ordersResult.expired) toLogin();
      return;
    }
    const match = ordersResult.data.orders.find((o) => o.order_id === id) ?? null;
    setOrder(match);
    setNotFound(!match);
    if (trackingResult.ok) setTracking(trackingResult.data);
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
      setError("Couldn't advance this order. It may already be complete.");
    }
    setAdvancing(false);
  };

  if (loading) return <CenterState loading />;
  if (notFound || !order) {
    return (
      <CenterState
        title="Order not found"
        hint="This order isn't in your current list."
      />
    );
  }

  const tone = orderTone(order.status);
  const final = atFinalStage(tracking);
  const balanceMinor = Math.max(order.agreed_total_minor - order.settled_minor, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Order" }} />

      <View style={styles.headerCard}>
        <Text style={styles.design}>{order.design_title}</Text>
        <View style={[styles.statusPill, { backgroundColor: tone }]}>
          <Text style={styles.statusPillText}>{order.stage_name || order.status}</Text>
        </View>
        <Text style={styles.meta}>
          {order.order_type} · {order.channel}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Customer</Text>
      <View style={styles.card}>
        <Row label="Name" value={order.customer_name} />
        <Row label="Phone" value={order.customer_phone || "—"} />
        <Row label="Email" value={order.customer_email || "—"} />
      </View>

      <Text style={styles.sectionLabel}>Payment</Text>
      <View style={styles.card}>
        <Row label="Agreed total" value={formatGHS(order.agreed_total_minor)} strong />
        <Row label="Settled" value={formatGHS(order.settled_minor)} />
        <Row
          label="Balance due"
          value={formatGHS(balanceMinor)}
          strong={balanceMinor > 0}
          tone={balanceMinor > 0 ? palette.warning : palette.success}
        />
        <Row label="Payment status" value={order.payment_status.replace(/_/g, " ")} />
      </View>

      {tracking ? (
        <>
          <Text style={styles.sectionLabel}>Fulfilment</Text>
          <StageTimeline stages={tracking.stages} />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={advancing || final}
        onPress={advance}
        style={[styles.cta, (advancing || final) && styles.ctaDisabled]}
      >
        <Text style={styles.ctaText}>
          {final
            ? "Order complete"
            : advancing
              ? "Advancing…"
              : "Advance to next stage"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          strong && styles.rowValueStrong,
          tone ? { color: tone } : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: palette.white,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
    paddingVertical: spacing(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.softBorder,
  },
  rowLabel: { fontFamily: fonts.body, fontSize: 14, color: palette.mutedText },
  rowValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.ink,
  },
  rowValueStrong: { fontWeight: "800" },
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
    color: palette.white,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
});
