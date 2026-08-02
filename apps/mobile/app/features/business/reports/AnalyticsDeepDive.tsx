import { useMemo } from "react";
import { Text, View } from "react-native";
import { formatGHS } from "../../../../src/api";
import type {
  CustomersAnalytics,
  DesignPerformance,
  OrdersPoint,
  OutstandingBalance,
  RevenueBreakdowns,
  StaffActivity,
} from "../../../../src/businessAnalyticsApi";
import { useTheme } from "../../../../src/theme-mode";
import { makeStyles } from "../../../business/reports.styles";

export type DeepDiveData = {
  orders: OrdersPoint[];
  customers: CustomersAnalytics | null;
  balances: OutstandingBalance[];
  totalOutstanding: number;
  breakdowns: RevenueBreakdowns | null;
  performance: DesignPerformance[];
  staff: StaffActivity[];
};

export function AnalyticsDeepDive({ data }: { data: DeepDiveData }) {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const orderTotals = data.orders.reduce(
    (out, item) => ({
      standard: out.standard + item.standard,
      bespoke: out.bespoke + item.bespoke,
    }),
    { standard: 0, bespoke: 0 },
  );
  return (
    <>
      <Text style={s.section}>Order mix</Text>
      <View style={s.metrics}>
        <Metric label="Ready-made" value={String(orderTotals.standard)} />
        <Metric label="Bespoke" value={String(orderTotals.bespoke)} />
        <Metric
          label="New customers"
          value={String(data.customers?.new_customers ?? 0)}
        />
        <Metric
          label="Returning"
          value={String(data.customers?.returning_customers ?? 0)}
        />
      </View>
      <Text style={s.section}>Outstanding balances</Text>
      <View style={s.list}>
        {data.balances.slice(0, 6).map((item) => (
          <Row
            key={item.order_id}
            title={`${item.customer_name} · ${item.design_title}`}
            meta={item.status}
            value={formatGHS(item.outstanding_minor)}
          />
        ))}
        {data.balances.length === 0 ? (
          <Note text="No outstanding balances in this reporting window." />
        ) : (
          <Text style={s.revenue}>
            Total {formatGHS(data.totalOutstanding)}
          </Text>
        )}
      </View>
      <Text style={s.section}>Revenue breakdown</Text>
      <View style={s.list}>
        {data.breakdowns?.by_flow.map((item) => (
          <Row
            key={item.flow}
            title={item.flow.replaceAll("_", " ")}
            meta={`${item.orders} orders`}
            value={formatGHS(item.revenue_minor)}
          />
        )) ?? <Note text="Revenue breakdowns unlock on Growth and Studio." />}
      </View>
      <Text style={s.section}>Design conversion</Text>
      <View style={s.list}>
        {data.performance.slice(0, 8).map((item) => (
          <Row
            key={item.design_id}
            title={item.title}
            meta={`${item.views} views · ${item.waiting_list} waiting`}
            value={`${(item.conversion_rate * 100).toFixed(1)}%`}
          />
        ))}
        {data.performance.length === 0 ? (
          <Note text="Design conversion unlocks on Growth and Studio." />
        ) : null}
      </View>
      <Text style={s.section}>Team activity</Text>
      <View style={s.list}>
        {data.staff.map((item) => (
          <Row
            key={item.user_id}
            title={item.display_name}
            meta={`${item.orders_created} orders · ${item.takings_logged} takings`}
            value={formatGHS(item.takings_minor)}
          />
        ))}
        {data.staff.length === 0 ? (
          <Note text="Team analytics unlocks on Studio." />
        ) : null}
      </View>
    </>
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
function Row({
  title,
  meta,
  value,
}: {
  title: string;
  meta: string;
  value: string;
}) {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={s.row}>
      <View style={s.rowCopy}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowHint}>{meta}</Text>
      </View>
      <Text style={s.revenue}>{value}</Text>
    </View>
  );
}
function Note({ text }: { text: string }) {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={s.upgrade}>
      <Text style={s.upgradeHint}>{text}</Text>
    </View>
  );
}
