import { useCallback, useState, useMemo } from "react";
import {
  Alert,
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
  type BusinessOrder,
  type HandoverSummary,
} from "../../src/businessApi";
import { CenterState } from "../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import ArrangeHandoverCard from "../features/business/handovers/ArrangeHandoverCard";
import HandoverRow from "../features/business/handovers/HandoverRow";

export default function HandoversScreen() { // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [handovers, setHandovers] = useState<HandoverSummary[] | null>(null);
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  const fetchData = useCallback(async () => {
    const [handoversResult, ordersResult] = await Promise.all([
      businessApi.handovers(),
      businessApi.orders(),
    ]);
    if (
      (!handoversResult.ok && handoversResult.expired) ||
      (!ordersResult.ok && ordersResult.expired)
    ) {
      toLogin();
      return;
    }
    if (handoversResult.ok) {
      setFetchError(false);
      setHandovers(handoversResult.data.handovers);
    } else {
      setFetchError(true);
    }
    setOrders(ordersResult.ok ? ordersResult.data.orders : []);
  }, [toLogin]);

  // Guard the route and load on focus so changes from the order screen show up.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((current) => {
        if (!active) return;
        if (!current) {
          toLogin();
          return;
        }
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

  const advance = async (handover: HandoverSummary) => {
    setBusyId(handover.handover_id);
    setActionError(null);
    const result = await businessApi.advanceHandover(handover.handover_id);
    setBusyId(null);
    if (result.ok) {
      await fetchData();
      return;
    }
    if (result.expired) {
      toLogin();
      return;
    }
    setActionError(
      result.error === "upstream_409"
        ? "This handover can no longer be advanced."
        : "Couldn't update the handover. Try again.",
    );
  };

  const runCancel = async (handover: HandoverSummary) => {
    setBusyId(handover.handover_id);
    setActionError(null);
    const result = await businessApi.cancelHandover(handover.handover_id);
    setBusyId(null);
    if (result.ok) {
      await fetchData();
      return;
    }
    if (result.expired) {
      toLogin();
      return;
    }
    setActionError("Couldn't cancel the handover. Try again.");
  };

  const cancel = (handover: HandoverSummary) => {
    Alert.alert(
      "Cancel handover",
      `Cancel the ${handover.method} for ${
        handover.customer_name || "this customer"
      }?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel handover",
          style: "destructive",
          onPress: () => void runCancel(handover),
        },
      ],
    );
  };

  if (loading) return <CenterState loading />;

  if (fetchError && handovers === null) {
    return (
      <CenterState
        title="Couldn't load handovers"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const list = handovers ?? [];
  // Fulfilled orders with no open handover — the arrange form's pick list.
  // The API 409s (order_not_fulfilled) for any other status, and only a
  // pending/dispatched handover blocks a re-arrange (web HandoverPanel uses
  // the same exclusion).
  const takenOrderIds = new Set(
    list
      .filter(
        (handover) =>
          handover.status === "pending" || handover.status === "dispatched",
      )
      .map((handover) => handover.order_id),
  );
  const eligibleOrders = orders.filter(
    (order) =>
      order.status.toLowerCase() === "fulfilled" &&
      !takenOrderIds.has(order.order_id),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.burgundy}
        />
      }
    >
      <Stack.Screen options={{ title: "Handovers" }} />

      <ArrangeHandoverCard
        orders={eligibleOrders}
        onArranged={() => void fetchData()}
        onExpired={toLogin}
      />

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Handovers</Text>
      </View>

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No handovers yet</Text>
          <Text style={styles.emptyHint}>
            Arrange a pickup or delivery above once an order is ready to leave
            the studio.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((handover) => (
            <HandoverRow
              key={handover.handover_id}
              handover={handover}
              busy={busyId === handover.handover_id}
              onAdvance={advance}
              onCancel={cancel}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    sectionHead: {
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
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginBottom: spacing(1.5),
    },
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
      textAlign: "center",
      marginTop: spacing(0.75),
      lineHeight: 20,
    },
  });
