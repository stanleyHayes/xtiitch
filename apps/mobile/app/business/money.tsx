import { useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../src/auth";
import {
  businessOpsApi,
  type ManualTaking,
  type MoneyPeriod,
  type MoneyPayout,
  type MoneySummary,
  type MoneyTransaction,
} from "../../src/businessOpsApi";
import { CenterState } from "../../src/ui";
import { fonts, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { LogTakingCard } from "../features/business/money/LogTakingCard";
import {
  PayoutsList,
  TakingsList,
  TransactionsList,
} from "../features/business/money/MoneyLists";
import { PeriodChips } from "../features/business/money/PeriodChips";
import { SummaryCards } from "../features/business/money/SummaryCards";
import { PayoutSetupCard } from "../features/business/money/PayoutSetupCard";

export default function BusinessMoneyScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [period, setPeriod] = useState<MoneyPeriod>("this_month");
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [takings, setTakings] = useState<ManualTaking[]>([]);
  const [payouts, setPayouts] = useState<MoneyPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  // Summary, transactions, takings and payouts all honour the same period
  // filter, so one period change refetches everything in parallel.
  const fetchData = useCallback(
    async (nextPeriod: MoneyPeriod) => {
      const query = { period: nextPeriod };
      const [summaryResult, transactionsResult, takingsResult, payoutsResult] =
        await Promise.all([
          businessOpsApi.moneySummary(query),
          businessOpsApi.moneyTransactions(query),
          businessOpsApi.moneyTakings(query),
          businessOpsApi.moneyPayouts(query),
        ]);
      const results = [
        summaryResult,
        transactionsResult,
        takingsResult,
        payoutsResult,
      ];
      if (results.some((result) => !result.ok && result.expired)) {
        toLogin();
        return;
      }
      setFetchError(!summaryResult.ok);
      if (summaryResult.ok) setSummary(summaryResult.data);
      if (transactionsResult.ok) {
        setTransactions(transactionsResult.data.transactions);
      }
      if (takingsResult.ok) setTakings(takingsResult.data.takings);
      if (payoutsResult.ok) setPayouts(payoutsResult.data.payouts);
    },
    [toLogin],
  );

  // The focus effect fetches whatever period is current without re-running
  // (and re-fetching) on every period change; onSelectPeriod fetches directly.
  const periodRef = useRef(period);
  periodRef.current = period;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((session) => {
        if (!active) return;
        if (!session) {
          toLogin();
          return;
        }
        fetchData(periodRef.current).finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [fetchData, toLogin]),
  );

  const onSelectPeriod = (next: MoneyPeriod) => {
    if (next === period) return;
    setPeriod(next);
    void fetchData(next);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(period);
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void fetchData(period).finally(() => setLoading(false));
  };

  if (loading) return <CenterState loading />;

  if (fetchError && summary === null) {
    return (
      <CenterState
        title="Couldn't load money data"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

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
      <Stack.Screen options={{ title: "Money" }} />

      <PayoutSetupCard />

      <PeriodChips period={period} onSelect={onSelectPeriod} />

      {summary ? (
        <>
          <Text style={styles.sectionLabelFirst}>Summary</Text>
          <SummaryCards summary={summary} />
        </>
      ) : null}

      <Text style={styles.sectionLabel}>Log a taking</Text>
      <LogTakingCard onLogged={() => fetchData(period)} onExpired={toLogin} />

      <TransactionsList transactions={transactions} />
      <TakingsList takings={takings} />
      <PayoutsList payouts={payouts} />
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    sectionLabelFirst: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(2.5),
      marginBottom: spacing(1.5),
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
  });
