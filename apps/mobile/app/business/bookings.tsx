import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../src/auth";
import {
  businessOpsApi,
  type AvailabilityWindow,
  type BookingSummary,
} from "../../src/businessOpsApi";
import { CenterState } from "../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import AppointmentsSection from "../features/business/bookings/AppointmentsSection";
import AvailabilitySection from "../features/business/bookings/AvailabilitySection";

type Tab = "appointments" | "availability";

const TABS: { key: Tab; label: string }[] = [
  { key: "appointments", label: "Appointments" },
  { key: "availability", label: "Availability" },
];

export default function BusinessBookingsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("appointments");
  const [bookings, setBookings] = useState<BookingSummary[] | null>(null);
  const [windows, setWindows] = useState<AvailabilityWindow[] | null>(null);
  const [blackouts, setBlackouts] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  // Each tab owns its data: bookings for appointments, windows + blackouts
  // for availability. Only the active tab's data is fetched.
  const loadTab = useCallback(
    async (target: Tab) => {
      if (target === "appointments") {
        const result = await businessOpsApi.bookings();
        if (!result.ok) {
          if (result.expired) {
            toLogin();
            return;
          }
          setFetchError(true);
          return;
        }
        setFetchError(false);
        setBookings(result.data.bookings);
        return;
      }
      const [windowsResult, blackoutsResult] = await Promise.all([
        businessOpsApi.availabilityWindows(),
        businessOpsApi.availabilityBlackouts(),
      ]);
      if (
        (!windowsResult.ok && windowsResult.expired) ||
        (!blackoutsResult.ok && blackoutsResult.expired)
      ) {
        toLogin();
        return;
      }
      if (windowsResult.ok && blackoutsResult.ok) {
        setFetchError(false);
        setWindows(windowsResult.data.windows);
        setBlackouts(blackoutsResult.data.dates);
      } else {
        setFetchError(true);
      }
    },
    [toLogin],
  );

  // Guard the route and load the default tab on focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((session) => {
        if (!active) return;
        if (!session) {
          toLogin();
          return;
        }
        loadTab("appointments").finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [loadTab, toLogin]),
  );

  const switchTab = (next: Tab) => {
    setTab(next);
    const cached =
      next === "appointments" ? bookings !== null : windows !== null;
    if (!cached) {
      setLoading(true);
      void loadTab(next).finally(() => setLoading(false));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTab(tab);
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void loadTab(tab).finally(() => setLoading(false));
  };

  if (loading) return <CenterState loading />;

  const availabilityLoaded = windows !== null && blackouts !== null;
  const tabDataMissing =
    tab === "appointments" ? bookings === null : !availabilityLoaded;
  if (fetchError && tabDataMissing) {
    return (
      <CenterState
        title="Couldn't load bookings"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

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
      <Stack.Screen options={{ title: "Bookings" }} />

      <View style={styles.tabs}>
        {TABS.map((option) => {
          const active = tab === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => switchTab(option.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "appointments" ? (
        <AppointmentsSection
          bookings={bookings ?? []}
          onChanged={() => loadTab("appointments")}
          onExpired={toLogin}
        />
      ) : (
        <AvailabilitySection
          windows={windows ?? []}
          blackouts={blackouts ?? []}
          onChanged={() => loadTab("availability")}
          onExpired={toLogin}
        />
      )}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    tabs: {
      flexDirection: "row",
      gap: spacing(1),
      marginBottom: spacing(2.5),
    },
    tab: {
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      paddingHorizontal: spacing(1.75),
      paddingVertical: spacing(0.75),
      backgroundColor: palette.white,
    },
    tabActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.burgundy,
    },
    tabText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    tabTextActive: { color: palette.onAccent },
  });
