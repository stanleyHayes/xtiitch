import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { formatGHS, type MeasurementField } from "../../../../src/api";
import { loadSession } from "../../../../src/auth";
import { businessApi, formatOrderDate } from "../../../../src/businessApi";
import {
  businessAdminApi,
  type CrmCustomerProfile,
} from "../../../../src/businessAdminApi";
import { CenterState } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import CrmOrderRow from "./CrmOrderRow";
import MeasurementCard from "./MeasurementCard";

export default function CustomerProfileScreen() { // eslint-disable-line max-lines-per-function, complexity -- large presentational component; refactor in follow-up
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CrmCustomerProfile | null>(null);
  const [fields, setFields] = useState<MeasurementField[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  const load = useCallback(async () => {
    if (!id) return;
    // Measurement fields resolve the values map's field IDs to labels; a
    // failure there just falls back to raw IDs, so it never blocks the page.
    const [profileResult, fieldsResult] = await Promise.all([
      businessAdminApi.crmCustomer(id),
      businessApi.measurementFields(),
    ]);
    if (
      (!profileResult.ok && profileResult.expired) ||
      (!fieldsResult.ok && fieldsResult.expired)
    ) {
      toLogin();
      return;
    }
    if (profileResult.ok) {
      setFetchError(false);
      setProfile(profileResult.data);
    } else {
      setFetchError(true);
    }
    if (fieldsResult.ok) setFields(fieldsResult.data.fields);
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

  // Only block the whole screen when we have nothing to show — a failed
  // pull-to-refresh after a successful load keeps the loaded profile visible.
  if (fetchError && profile === null) {
    return (
      <CenterState
        title="Couldn't load this customer"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  // Session expired mid-load (redirecting to login) — nothing to render.
  if (profile === null) return null;

  const insightsGated =
    profile.orders_count === null || profile.total_spend_minor === null;

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
      <Stack.Screen options={{ title: profile.name || "Customer" }} />

      <View style={styles.card}>
        <Text style={styles.name}>{profile.name}</Text>
        {profile.phone ? <Text style={styles.contact}>{profile.phone}</Text> : null}
        {profile.whatsapp ? (
          <Text style={styles.contact}>WhatsApp {profile.whatsapp}</Text>
        ) : null}
        {profile.email ? <Text style={styles.contact}>{profile.email}</Text> : null}
        {profile.source ? (
          <Text style={styles.source}>Source: {profile.source}</Text>
        ) : null}
        {profile.first_order_at ? (
          <Text style={styles.source}>
            Customer since {formatOrderDate(profile.first_order_at)}
          </Text>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {profile.orders_count === null ? "—" : String(profile.orders_count)}
          </Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {profile.total_spend_minor === null
              ? "—"
              : formatGHS(profile.total_spend_minor)}
          </Text>
          <Text style={styles.statLabel}>Total spend</Text>
        </View>
      </View>
      {insightsGated ? (
        <Text style={styles.upgradeHint}>Upgrade for customer insights</Text>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Orders</Text>
      </View>
      {profile.orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHint}>No orders from this customer yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {profile.orders.map((order) => (
            <CrmOrderRow
              key={order.order_id}
              order={order}
              onPress={() => router.push(`/business/order/${order.order_id}`)}
            />
          ))}
        </View>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Measurements</Text>
      </View>
      {profile.measurements.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHint}>No measurements recorded yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {profile.measurements.map((measurement) => (
            <MeasurementCard
              key={measurement.measurement_id}
              measurement={measurement}
              fields={fields}
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
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2.5),
      gap: spacing(0.5),
    },
    name: {
      fontFamily: fonts.display,
      fontSize: 24,
      fontWeight: "700",
      color: palette.ink,
      marginBottom: spacing(0.5),
    },
    contact: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.ink,
    },
    source: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      textTransform: "capitalize",
      marginTop: spacing(0.25),
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing(1.5),
      marginTop: spacing(2),
    },
    stat: {
      flexGrow: 1,
      flexBasis: "44%",
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
    },
    statValue: {
      fontFamily: fonts.display,
      fontSize: 24,
      fontWeight: "700",
      color: palette.ink,
    },
    statLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
    upgradeHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontStyle: "italic",
      color: palette.mauve,
      marginTop: spacing(1),
    },
    sectionHead: {
      marginTop: spacing(3),
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
    list: { gap: spacing(1.5) },
    empty: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(3),
      alignItems: "center",
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      textAlign: "center",
      lineHeight: 20,
    },
  });
