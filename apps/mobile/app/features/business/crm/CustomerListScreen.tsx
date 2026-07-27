import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../../../src/auth";
import {
  businessAdminApi,
  type CrmCustomerList,
} from "../../../../src/businessAdminApi";
import { CenterState } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import CustomerRow from "./CustomerRow";

// Debounce the search box so each keystroke doesn't fire a CRM query.
const SEARCH_DEBOUNCE_MS = 350;

export default function CustomerListScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [list, setList] = useState<CrmCustomerList | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  // Guard the route on focus; the fetch itself is driven by the debounced
  // query effect below so searching doesn't re-check the session.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((session) => {
        if (!active) return;
        if (!session) {
          toLogin();
          return;
        }
        setAuthed(true);
      });
      return () => {
        active = false;
      };
    }, [toLogin]),
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query]);

  const fetchData = useCallback(async () => {
    const result = await businessAdminApi.crmCustomers(
      debouncedQuery || undefined,
    );
    if (!result.ok) {
      if (result.expired) {
        toLogin();
        return;
      }
      setFetchError(true);
      return;
    }
    setFetchError(false);
    setList(result.data);
  }, [debouncedQuery, toLogin]);

  useEffect(() => {
    if (!authed) return;
    let active = true;
    void fetchData().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [authed, fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void fetchData().finally(() => setLoading(false));
  };

  if (loading && list === null) return <CenterState loading />;

  if (fetchError && list === null) {
    return (
      <CenterState
        title="Couldn't load customers"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const customers = list?.customers ?? [];

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
      <Stack.Screen options={{ title: "Customers" }} />

      {/* Search (q) is plan-gated server-side (403 crm_not_entitled below
          crm_level 1) — only offer it once a list has loaded and the plan
          includes it. */}
      {list !== null && list.crm_level >= 1 ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or phone"
          placeholderTextColor={palette.mutedText}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
      ) : null}

      {customers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {debouncedQuery ? "No matches" : "No customers yet"}
          </Text>
          <Text style={styles.emptyHint}>
            {debouncedQuery
              ? `No customers match "${debouncedQuery}".`
              : "Customers appear here after their first order."}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {customers.map((customer) => (
            <CustomerRow
              key={customer.customer_id}
              customer={customer}
              onPress={() =>
                router.push(`/business/customer/${customer.customer_id}`)
              }
            />
          ))}
        </View>
      )}

      {list !== null && list.total > customers.length ? (
        <Text style={styles.footer}>
          Showing the first {customers.length} of {list.total} customers — use
          search to narrow down.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    search: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2.25),
      paddingVertical: spacing(1.5),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
      marginBottom: spacing(2.5),
    },
    list: { gap: spacing(1.5) },
    footer: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(2),
      lineHeight: 17,
    },
    empty: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(3),
      alignItems: "center",
    },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: palette.ink,
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(0.75),
      lineHeight: 20,
    },
  });
