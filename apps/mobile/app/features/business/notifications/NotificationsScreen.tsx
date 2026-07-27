import { useCallback, useState, useMemo } from "react";
import {
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
  type NotificationSummary,
} from "../../../../src/businessAdminApi";
import { CenterState } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import { NotificationRow } from "./NotificationRow";

export default function NotificationsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [notifications, setNotifications] = useState<
    NotificationSummary[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const result = await businessAdminApi.notifications();
    if (!result.ok) {
      if (result.expired) {
        router.replace("/business/login");
        return;
      }
      setFetchError(true);
      return;
    }
    setFetchError(false);
    setNotifications(result.data.notifications);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((session) => {
        if (!active) return;
        if (!session) {
          router.replace("/business/login");
          return;
        }
        fetchNotifications().finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [fetchNotifications, router]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void fetchNotifications().finally(() => setLoading(false));
  };

  if (loading) return <CenterState loading />;

  if (fetchError && notifications === null) {
    return (
      <CenterState
        title="Couldn't load notifications"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const list = notifications ?? [];

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
      <Stack.Screen options={{ title: "Notifications" }} />

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyHint}>
            Order, handover and subscription messages we send on your behalf
            will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((notification) => (
            <NotificationRow
              key={notification.message_id}
              notification={notification}
            />
          ))}
        </View>
      )}

      <Text style={styles.footer}>
        This is a delivery log of messages we've sent — there's nothing to mark
        as read.
      </Text>
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
    footer: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(2.5),
      lineHeight: 17,
    },
  });
