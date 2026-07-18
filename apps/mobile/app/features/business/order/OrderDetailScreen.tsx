import { useCallback, useState, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { api, type Tracking } from "../../../../src/api";
import { loadSession } from "../../../../src/auth";
import {
  businessApi,
  measurementSourceFor,
  type BusinessOrder,
  type BusinessProfile,
} from "../../../../src/businessApi";
import { CenterState, StageTimeline } from "../../../../src/ui";
import { fonts, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import OrderHandoverCard from "./OrderHandoverCard";
import OrderMeasurementsCard from "./OrderMeasurementsCard";
import OrderPaymentActions from "./OrderPaymentActions";
import {
  AdvanceFooter,
  CustomerCard,
  OrderHeaderCard,
  PaymentCard,
  balanceDueMinor,
} from "./OrderSummaryCards";

// Advance-to-next-stage flow. On success the API returns the updated tracking;
// the order row is refetched so status/settled reflect the new stage. An
// expired session routes back to login without clearing the advancing flag —
// the screen unmounts anyway.
function useOrderAdvance({
  id,
  onTracking,
  onOrder,
  onError,
  onExpired,
}: {
  id: string | undefined;
  onTracking: (tracking: Tracking) => void;
  onOrder: (order: BusinessOrder) => void;
  onError: (message: string | null) => void;
  onExpired: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);

  const advance = async () => {
    if (!id) return;
    setAdvancing(true);
    onError(null);
    const result = await businessApi.advanceOrder(id);
    if (result.ok) {
      onTracking(result.data);
      const orders = await businessApi.orders();
      if (orders.ok) {
        const match = orders.data.orders.find((o) => o.order_id === id);
        if (match) onOrder(match);
      }
    } else if (result.expired) {
      onExpired();
      return;
    } else {
      onError("Couldn't advance this order right now. Pull to refresh and try again.");
    }
    setAdvancing(false);
  };

  return { advancing, advance };
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
  const [error, setError] = useState<string | null>(null);

  const toLogin = useCallback(() => router.replace("/business/login"), [router]);
  const { advancing, advance } = useOrderAdvance({
    id,
    onTracking: setTracking,
    onOrder: setOrder,
    onError: setError,
    onExpired: toLogin,
  });

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

  const measurementSource = measurementSourceFor(order);

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

      <OrderHeaderCard order={order} />

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

      {measurementSource ? (
        <>
          <Text style={styles.sectionLabel}>Measurements</Text>
          <OrderMeasurementsCard
            orderId={id}
            source={measurementSource}
            onLoad={load}
            onExpired={toLogin}
          />
        </>
      ) : null}

      {tracking ? (
        <>
          <Text style={styles.sectionLabel}>Fulfilment</Text>
          <StageTimeline stages={tracking.stages} />
        </>
      ) : null}

      {tracking?.handover ? (
        <>
          <Text style={styles.sectionLabel}>Handover</Text>
          <OrderHandoverCard handover={tracking.handover} />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AdvanceFooter status={order.status} advancing={advancing} onAdvance={advance} />
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
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
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(2),
    },
  });
