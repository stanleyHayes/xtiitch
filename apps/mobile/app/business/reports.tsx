import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { formatGHS } from "../../src/api";
import { loadSession } from "../../src/auth";
import {
  businessAnalyticsApi,
  type AnalyticsSummary,
  type SalesPoint,
  type TopDesign,
  type CustomersAnalytics,
  type DesignPerformance,
  type OrdersPoint,
  type OutstandingBalance,
  type RevenueBreakdowns,
  type StaffActivity,
} from "../../src/businessAnalyticsApi";
import { useTheme } from "../../src/theme-mode";
import { CenterState } from "../../src/ui";
import { makeStyles } from "./reports.styles";
import { AnalyticsDeepDive } from "../features/business/reports/AnalyticsDeepDive";
import { ReportScheduleCard } from "../features/business/reports/ReportScheduleCard";
import { ReportExportsCard } from "../features/business/reports/ReportExportsCard";

// eslint-disable-next-line max-lines-per-function -- plan-tiered analytics workspace
export default function ReportsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<SalesPoint[]>([]);
  const [top, setTop] = useState<TopDesign[]>([]);
  const [orders, setOrders] = useState<OrdersPoint[]>([]);
  const [customers, setCustomers] = useState<CustomersAnalytics | null>(null);
  const [balances, setBalances] = useState<OutstandingBalance[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [breakdowns, setBreakdowns] = useState<RevenueBreakdowns | null>(null);
  const [performance, setPerformance] = useState<DesignPerformance[]>([]);
  const [staff, setStaff] = useState<StaffActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!(await loadSession())) {
      router.replace("/business/login");
      return;
    }
    const [s, t, d, o, c, b, r, p, a] = await Promise.all([
      businessAnalyticsApi.summary(),
      businessAnalyticsApi.salesTrend(),
      businessAnalyticsApi.topDesigns(),
      businessAnalyticsApi.ordersTrend(),
      businessAnalyticsApi.customers(),
      businessAnalyticsApi.balances(),
      businessAnalyticsApi.breakdowns(),
      businessAnalyticsApi.designPerformance(),
      businessAnalyticsApi.staff(),
    ]);
    if (!s.ok) {
      if (s.expired) router.replace("/business/login");
      else setError("Reports could not be loaded.");
      return;
    }
    setError("");
    setSummary(s.data);
    setTrend(t.ok ? t.data.points : []);
    setTop(d.ok ? d.data.designs : []);
    setOrders(o.ok ? o.data.points : []);
    setCustomers(c.ok ? c.data : null);
    setBalances(b.ok ? b.data.balances : []);
    setTotalOutstanding(b.ok ? b.data.total_outstanding_minor : 0);
    setBreakdowns(r.ok ? r.data : null);
    setPerformance(p.ok ? p.data.designs : []);
    setStaff(a.ok ? a.data.staff : []);
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  if (!summary && !error) return <CenterState loading />;
  if (!summary)
    return (
      <CenterState title="Reports unavailable" hint={error} onRetry={load} />
    );
  const max = Math.max(
    ...trend.map((point) => point.sales_minor + point.manual_takings_minor),
    1,
  );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={palette.burgundy}
        />
      }
    >
      <Stack.Screen options={{ title: "Reports" }} />
      <View style={styles.hero}>
        <Ionicons
          name="stats-chart-outline"
          size={145}
          color={palette.onAccent}
          style={styles.watermark}
        />
        <Text style={styles.eyebrow}>BUSINESS PULSE</Text>
        <Text style={styles.title}>Know what is moving</Text>
        <Text style={styles.subtitle}>
          Sales, orders, customers and catalogue momentum in one mobile view.
        </Text>
      </View>
      <View style={styles.metrics}>
        <Metric label="Sales" value={formatGHS(summary.sales_total_minor)} />
        <Metric label="Orders" value={String(summary.orders_count)} />
        <Metric label="Customers" value={String(summary.customers_count)} />
        <Metric label="Designs" value={String(summary.designs_count)} />
      </View>
      <Text style={styles.section}>Sales movement</Text>
      {trend.length ? (
        <View style={styles.chart}>
          {trend.slice(-14).map((point) => {
            const total = point.sales_minor + point.manual_takings_minor;
            return (
              <View key={point.day} style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max((total / max) * 100, 4)}%` },
                  ]}
                />
                <Text style={styles.day}>
                  {point.day.slice(5).replace("-", "/")}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <UpgradeNote
          title="Trend detail is plan-gated"
          hint="Totals remain available on every plan. Starter and above unlock the daily sales view."
        />
      )}
      <Text style={styles.section}>Top designs</Text>
      {top.length ? (
        <View style={styles.list}>
          {top.map((item, index) => (
            <View key={item.design_id} style={styles.row}>
              <View style={styles.rank}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowHint}>{item.orders} orders</Text>
              </View>
              <Text style={styles.revenue}>
                {formatGHS(item.revenue_minor)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <UpgradeNote
          title="Top-design insight is locked"
          hint="Upgrade to compare the pieces driving orders and revenue."
        />
      )}
      <AnalyticsDeepDive
        data={{
          orders,
          customers,
          balances,
          totalOutstanding,
          breakdowns,
          performance,
          staff,
        }}
      />
      <Text style={styles.section}>Delivery</Text>
      <ReportExportsCard />
      <ReportScheduleCard />
    </ScrollView>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}
function UpgradeNote({ title, hint }: { title: string; hint: string }) {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={s.upgrade}>
      <Text style={s.upgradeTitle}>{title}</Text>
      <Text style={s.upgradeHint}>{hint}</Text>
    </View>
  );
}
