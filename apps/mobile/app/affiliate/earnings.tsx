import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  affiliateApi,
  type AffiliateConversion,
  type AffiliatePayout,
} from "../../src/affiliateApi";
import { formatGHS } from "../../src/api";
import {
  fonts,
  radius,
  spacing,
  type Palette,
  typeScale,
} from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { CenterState } from "../../src/ui";

export default function AffiliateEarningsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [conversions, setConversions] = useState<AffiliateConversion[] | null>(
    null,
  );
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [conversionResult, payoutResult] = await Promise.all([
      affiliateApi.conversions(),
      affiliateApi.payouts(),
    ]);
    if (
      (!conversionResult.ok && conversionResult.expired) ||
      (!payoutResult.ok && payoutResult.expired)
    ) {
      router.replace("/affiliate/login");
      return;
    }
    if (!conversionResult.ok || !payoutResult.ok) {
      setError("Couldn't load earnings. Pull down to retry.");
      return;
    }
    setConversions(conversionResult.data.conversions);
    setPayouts(payoutResult.data.payouts);
    setError("");
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (conversions === null && !error) return <CenterState loading />;
  if (conversions === null)
    return (
      <CenterState
        title="Earnings unavailable"
        hint={error}
        onRetry={() => void load()}
      />
    );

  const total = conversions.reduce(
    (sum, item) => sum + item.commission_minor,
    0,
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={palette.burgundy}
        />
      }
    >
      <Stack.Screen options={{ title: "Earnings" }} />
      <View style={styles.summary}>
        <Text style={styles.eyebrow}>RECORDED COMMISSION</Text>
        <Text style={styles.total}>{formatGHS(total)}</Text>
        <Text style={styles.summaryHint}>
          {conversions.length} conversion{conversions.length === 1 ? "" : "s"} ·{" "}
          {payouts.length} payout record{payouts.length === 1 ? "" : "s"}
        </Text>
      </View>
      <Text style={styles.title}>Conversions</Text>
      <View style={styles.card}>
        {conversions.length ? (
          conversions.map((item, index) => (
            <EarningRow
              key={item.conversion_id}
              item={item}
              bordered={index > 0}
            />
          ))
        ) : (
          <Empty text="No qualified conversions yet." />
        )}
      </View>
      <Text style={styles.title}>Payout history</Text>
      <View style={styles.card}>
        {payouts.length ? (
          payouts.map((item, index) => (
            <View
              key={item.payout_id}
              style={[styles.row, index > 0 && styles.border]}
            >
              <View style={styles.icon}>
                <Ionicons
                  name="wallet-outline"
                  size={18}
                  color={palette.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {item.payout_reference || "Payout"}
                </Text>
                <Text style={styles.meta}>
                  {date(item.created_at)} · {human(item.status)}
                </Text>
              </View>
              <Text style={styles.amount}>
                {formatGHS(item.commission_minor)}
              </Text>
            </View>
          ))
        ) : (
          <Empty text="Completed payout runs will appear here." />
        )}
      </View>
    </ScrollView>
  );
}

function EarningRow({
  item,
  bordered,
}: {
  item: AffiliateConversion;
  bordered: boolean;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={[styles.row, bordered && styles.border]}>
      <View style={styles.icon}>
        <Ionicons name="trending-up" size={18} color={palette.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{human(item.conversion_type)}</Text>
        <Text style={styles.meta}>
          {date(item.occurred_at)} · {human(item.status)}
        </Text>
      </View>
      <Text style={styles.amount}>{formatGHS(item.commission_minor)}</Text>
    </View>
  );
}
function Empty({ text }: { text: string }) {
  const { palette } = useTheme();
  return (
    <Text
      style={{
        padding: spacing(3),
        color: palette.mutedText,
        textAlign: "center",
      }}
    >
      {text}
    </Text>
  );
}
function human(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(2.5), paddingBottom: spacing(6) },
    summary: {
      backgroundColor: palette.burgundyDeep,
      borderRadius: radius.lg,
      padding: spacing(2.5),
    },
    eyebrow: {
      color: palette.gold,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.6,
    },
    total: {
      color: palette.onAccent,
      fontSize: 36,
      fontWeight: "900",
      marginTop: spacing(1),
      letterSpacing: -1,
    },
    summaryHint: { color: "rgba(255,255,255,0.64)", marginTop: spacing(0.75) },
    title: {
      ...typeScale.heading,
      color: palette.ink,
      fontFamily: fonts.display,
      fontWeight: "800",
      marginTop: spacing(3),
      marginBottom: spacing(1.25),
    },
    card: {
      backgroundColor: palette.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.hairline,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.25),
      padding: spacing(1.75),
    },
    border: { borderTopWidth: 1, borderTopColor: palette.hairline },
    icon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: palette.wineTint,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: { color: palette.ink, fontWeight: "800" },
    meta: { color: palette.mutedText, fontSize: 12, marginTop: 3 },
    amount: { color: palette.ink, fontWeight: "900" },
  });
