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

import { loadSession } from "../../../../src/auth";
import {
  businessAdminApi,
  type WaitlistEntry,
  type WaitlistStatus,
} from "../../../../src/businessAdminApi";
import { CenterState } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import { WaitlistRow } from "./WaitlistRow";

export default function WaitlistScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  const fetchEntries = useCallback(async () => {
    const result = await businessAdminApi.waitlistEntries();
    if (!result.ok) {
      if (result.expired) {
        toLogin();
        return;
      }
      setFetchError(true);
      return;
    }
    setFetchError(false);
    setEntries(result.data.entries);
  }, [toLogin]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((session) => {
        if (!active) return;
        if (!session) {
          toLogin();
          return;
        }
        fetchEntries().finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [fetchEntries, toLogin]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void fetchEntries().finally(() => setLoading(false));
  };

  const updateStatus = async (entry: WaitlistEntry, status: WaitlistStatus) => {
    setBusyId(entry.entry_id);
    const result = await businessAdminApi.updateWaitlistEntry(
      entry.entry_id,
      status,
    );
    setBusyId(null);
    if (!result.ok) {
      if (result.expired) {
        toLogin();
        return;
      }
      Alert.alert(
        "Couldn't update entry",
        "Something went wrong — please try again.",
      );
      return;
    }
    await fetchEntries();
  };

  const confirmClose = (entry: WaitlistEntry) => {
    Alert.alert(
      "Close waitlist entry?",
      `${entry.customer_name} will no longer be counted as waiting on “${entry.design_title}”.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close",
          style: "destructive",
          onPress: () => void updateStatus(entry, "closed"),
        },
      ],
    );
  };

  if (loading) return <CenterState loading />;

  if (fetchError && entries === null) {
    return (
      <CenterState
        title="Couldn't load waitlist"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const list = entries ?? [];

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
      <Stack.Screen options={{ title: "Waitlist" }} />

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No waitlist entries</Text>
          <Text style={styles.emptyHint}>
            Customers who ask to be told when a sold-out design is back will
            appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((entry) => (
            <WaitlistRow
              key={entry.entry_id}
              entry={entry}
              busy={busyId === entry.entry_id}
              onMarkNotified={() => void updateStatus(entry, "notified")}
              onClose={() => confirmClose(entry)}
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
