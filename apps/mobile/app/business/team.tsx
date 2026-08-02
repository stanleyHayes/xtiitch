import { useCallback, useMemo, useState } from "react";
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
  businessAdminApi,
  type BusinessUser,
} from "../../src/businessAdminApi";
import { CenterState } from "../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { InviteForm } from "../features/business/team/InviteForm";
import { MemberCard } from "../features/business/team/MemberCard";

export default function TeamScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [members, setMembers] = useState<BusinessUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const toLogin = useCallback(() => {
    router.replace("/business/login");
  }, [router]);

  const fetchMembers = useCallback(async () => {
    const result = await businessAdminApi.teamMembers();
    if (!result.ok && result.expired) {
      toLogin();
      return;
    }
    if (result.ok) {
      setFetchError(false);
      setMembers(result.data.users);
    } else {
      setFetchError(true);
    }
  }, [toLogin]);

  // Guard the route and load on focus so a fresh login lands here populated.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then((current) => {
        if (!active) return;
        if (!current) {
          toLogin();
          return;
        }
        fetchMembers().finally(() => {
          if (active) setLoading(false);
        });
      });
      return () => {
        active = false;
      };
    }, [fetchMembers, toLogin]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const retry = () => {
    setLoading(true);
    void fetchMembers().finally(() => setLoading(false));
  };

  const applyActive = async (member: BusinessUser, nextActive: boolean) => {
    setBusyId(member.business_user_id);
    setActionError(null);
    // ⚠️ Send the FULL shape — the server treats a missing is_active as
    // false, so omitting it would silently deactivate the member.
    const result = await businessAdminApi.updateTeamMember(
      member.business_user_id,
      {
        display_name: member.display_name,
        phone: member.phone,
        role: member.role === "admin" ? "admin" : "staff",
        is_active: nextActive,
      },
    );
    setBusyId(null);
    if (result.ok) {
      await fetchMembers();
    } else if (result.expired) {
      toLogin();
    } else {
      setActionError("Couldn't update the member. Try again.");
    }
  };

  const onToggleActive = (member: BusinessUser) => {
    if (member.is_active) {
      Alert.alert(
        `Deactivate ${member.display_name}?`,
        "They will lose access to the studio until you reactivate them.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Deactivate",
            style: "destructive",
            onPress: () => void applyActive(member, false),
          },
        ],
      );
    } else {
      void applyActive(member, true);
    }
  };

  if (loading) return <CenterState loading />;

  if (fetchError && members === null) {
    return (
      <CenterState
        title="Couldn't load your team"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  const list = members ?? [];

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
      <Stack.Screen options={{ title: "Team" }} />

      <InviteForm
        onCreated={() => void fetchMembers()}
        onSessionExpired={toLogin}
      />

      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>Members</Text>
      </View>

      {actionError ? (
        <Text style={styles.actionError}>{actionError}</Text>
      ) : null}

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No team members yet</Text>
          <Text style={styles.emptyHint}>
            Invite an admin or staff member above to share the workload.
          </Text>
        </View>
      ) : (
        <View style={styles.memberList}>
          {list.map((member) => (
            <MemberCard
              key={member.business_user_id}
              member={member}
              busy={busyId === member.business_user_id}
              onToggleActive={() => onToggleActive(member)}
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
    memberList: { gap: spacing(1.5) },
    actionError: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginBottom: spacing(1.5),
    },
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
