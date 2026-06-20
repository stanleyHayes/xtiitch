import { useCallback, useState, useMemo } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { api, formatGHS, type Tracking } from "../../../src/api";
import { loadSession } from "../../../src/auth";
import {
  businessApi,
  orderTone,
  type BusinessOrder,
  type CollectBalanceResult,
} from "../../../src/businessApi";
import { CenterState, StageTimeline } from "../../../src/ui";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

function atFinalStage(tracking: Tracking | null): boolean {
  if (!tracking || tracking.stages.length === 0) return false;
  const ordered = [...tracking.stages].sort((a, b) => a.sequence - b.sequence);
  const last = ordered[ordered.length - 1];
  return last.is_current || last.is_complete;
}

export default function OrderDetailScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<BusinessOrder | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState("");
  const [savingTotal, setSavingTotal] = useState(false);
  const [collectMethod, setCollectMethod] = useState<"momo" | "card">("momo");
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState<CollectBalanceResult | null>(
    null,
  );

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

  const saveTotal = async () => {
    if (!id) return;
    const minor = Math.round(Number.parseFloat(totalInput) * 100);
    if (!Number.isFinite(minor) || minor < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSavingTotal(true);
    setError(null);
    const result = await businessApi.setAgreedTotal(id, minor);
    setSavingTotal(false);
    if (result.ok) {
      setEditingTotal(false);
      setCollectResult(null);
      await load();
    } else if (result.expired) {
      toLogin();
    } else {
      setError("Couldn't update the agreed total.");
    }
  };

  const collect = async () => {
    if (!id) return;
    setCollecting(true);
    setError(null);
    const result = await businessApi.collectBalance(id, collectMethod);
    setCollecting(false);
    if (result.ok) {
      setCollectResult(result.data);
      await load();
    } else if (result.expired) {
      toLogin();
    } else {
      setError("Couldn't raise a payment link for this balance.");
    }
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

      <Text style={styles.sectionLabel}>Money actions</Text>
      <View style={styles.card}>
        {editingTotal ? (
          <View style={styles.editBlock}>
            <Text style={styles.editLabel}>New agreed total (GH₵)</Text>
            <View style={styles.editRow}>
              <TextInput
                value={totalInput}
                onChangeText={setTotalInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={palette.mutedText}
                style={styles.input}
              />
              <Pressable
                disabled={savingTotal}
                onPress={saveTotal}
                style={[styles.smallPrimary, savingTotal && styles.ctaDisabled]}
              >
                <Text style={styles.smallPrimaryText}>
                  {savingTotal ? "…" : "Save"}
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setEditingTotal(false)}>
              <Text style={styles.linkBtnText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.actionRow}
            onPress={() => {
              setTotalInput((order.agreed_total_minor / 100).toFixed(2));
              setError(null);
              setEditingTotal(true);
            }}
          >
            <Text style={styles.actionTitle}>Adjust agreed total</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        {balanceMinor <= 0 ? (
          <Text style={styles.settled}>Balance fully settled.</Text>
        ) : collectResult ? (
          <View style={styles.editBlock}>
            <Text style={styles.linkRaised}>
              Payment link raised · {formatGHS(collectResult.amount_minor)}
            </Text>
            <Text style={styles.reference}>Ref {collectResult.reference}</Text>
            <Pressable
              style={styles.smallPrimaryWide}
              onPress={() => Linking.openURL(collectResult.authorization_url)}
            >
              <Text style={styles.smallPrimaryText}>Open payment link</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.editBlock}>
            <Text style={styles.editLabel}>
              Collect balance · {formatGHS(balanceMinor)}
            </Text>
            <View style={styles.methodRow}>
              {(["momo", "card"] as const).map((method) => {
                const active = collectMethod === method;
                return (
                  <Pressable
                    key={method}
                    onPress={() => setCollectMethod(method)}
                    style={[styles.method, active && styles.methodActive]}
                  >
                    <Text
                      style={[styles.methodText, active && styles.methodTextActive]}
                    >
                      {method === "momo" ? "Mobile money" : "Card"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              disabled={collecting}
              onPress={collect}
              style={[styles.smallPrimaryWide, collecting && styles.ctaDisabled]}
            >
              <Text style={styles.smallPrimaryText}>
                {collecting ? "Raising link…" : "Send payment link"}
              </Text>
            </Pressable>
          </View>
        )}
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
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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

const makeStyles = (palette: Palette) => StyleSheet.create({
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
    color: palette.onAccent,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing(1.75),
  },
  actionTitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    color: palette.burgundy,
  },
  actionArrow: { fontSize: 22, fontWeight: "700", color: palette.burgundy },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.softBorder,
  },
  editBlock: { paddingVertical: spacing(1.75), gap: spacing(1.25) },
  editLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    color: palette.ink,
  },
  editRow: { flexDirection: "row", gap: spacing(1.25), alignItems: "center" },
  input: {
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
  smallPrimary: {
    backgroundColor: palette.burgundy,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
  },
  smallPrimaryWide: {
    backgroundColor: palette.burgundy,
    borderRadius: radius.pill,
    paddingVertical: spacing(1.5),
    alignItems: "center",
  },
  smallPrimaryText: {
    color: palette.onAccent,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "800",
  },
  linkBtnText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    color: palette.mutedText,
  },
  settled: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.success,
    fontWeight: "700",
    paddingVertical: spacing(1.75),
  },
  linkRaised: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: palette.success,
    fontWeight: "700",
  },
  reference: { fontFamily: fonts.body, fontSize: 12, color: palette.mutedText },
  methodRow: { flexDirection: "row", gap: spacing(1) },
  method: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: palette.softBorder,
    borderRadius: radius.md,
    paddingVertical: spacing(1.25),
    alignItems: "center",
    backgroundColor: palette.white,
  },
  methodActive: {
    borderColor: palette.burgundy,
    backgroundColor: "rgba(128,0,32,0.06)",
  },
  methodText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    color: palette.ink,
  },
  methodTextActive: { color: palette.burgundy },
});
