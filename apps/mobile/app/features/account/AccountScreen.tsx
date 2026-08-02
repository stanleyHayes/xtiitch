import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
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

import {
  CustomerSessionExpiredError,
  fetchCustomerProfile,
  loadSession,
  logout,
  type CustomerProfile,
  type CustomerSession,
} from "../../../src/customerAuth";
import { fetchCustomerOrders } from "../../../src/customerOrders";
import {
  fonts,
  radius,
  shadow,
  spacing,
  type Palette,
} from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { CenterState } from "../../../src/ui";
import OrderHistory, { type OrdersState } from "./OrderHistory";
import ProfileEditCard from "./ProfileEditCard";
import SignInFlow from "./SignInFlow";

// Only internal app paths may be returned to after sign-in — the web account
// action applies the same rule with safeRedirect.
function safeReturnTo(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "";
}

export default function AccountScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const [session, setSession] = useState<CustomerSession | null | undefined>();

  useEffect(() => {
    let active = true;
    loadSession().then((next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const onSignedIn = useCallback(
    (next: CustomerSession) => {
      if (returnTo) {
        // Arrived from a §3b pay gate — return to the design screen, which
        // stayed mounted underneath with the shopper's form intact.
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(returnTo);
        }
        return;
      }
      setSession(next);
    },
    [returnTo, router],
  );

  if (session === undefined) return <CenterState loading />;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Account" }} />
      {session ? (
        <SignedInAccount
          session={session}
          onSignedOut={() => setSession(null)}
        />
      ) : (
        <SignInFlow gated={Boolean(returnTo)} onSignedIn={onSignedIn} />
      )}
    </View>
  );
}

function SignedInAccount({
  session,
  onSignedOut,
}: {
  session: CustomerSession;
  onSignedOut: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [ordersState, setOrdersState] = useState<OrdersState>({
    phase: "loading",
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setOrdersState({ phase: "loading" });
      try {
        const [orders, me] = await Promise.all([
          fetchCustomerOrders(),
          fetchCustomerProfile(),
        ]);
        setProfile(me);
        setOrdersState({ phase: "ready", orders });
      } catch (error) {
        // A 401 cleared the session — drop back to the sign-in flow.
        if (error instanceof CustomerSessionExpiredError) {
          onSignedOut();
          return;
        }
        setOrdersState({ phase: "error" });
      }
    },
    [onSignedOut],
  );

  // Refresh on every focus, so an order placed after sign-in shows up here.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const displayName =
    profile?.display_name || session.phone || session.email || "Signed in";
  const detailLines = [
    profile?.phone ?? session.phone,
    profile?.email ?? session.email,
  ]
    .filter((line) => line.trim().length > 0 && line !== displayName)
    .join(" · ");

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
      <View style={styles.profileCard}>
        <Text style={styles.profileKicker}>SIGNED IN</Text>
        <Text style={styles.profileName}>{displayName}</Text>
        {detailLines ? (
          <Text style={styles.profileDetail}>{detailLines}</Text>
        ) : null}
      </View>

      <ProfileEditCard
        profile={profile}
        onSaved={setProfile}
        onSessionExpired={onSignedOut}
      />

      <Text style={styles.sectionLabel}>Your orders</Text>
      <OrderHistory
        state={ordersState}
        onRetry={() => void load()}
        onOpen={(orderId) => router.push(`/track/${orderId}`)}
        onChanged={() => void load(true)}
        onSessionExpired={onSignedOut}
      />

      <Pressable
        onPress={() => {
          void logout().then(onSignedOut);
        }}
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    profileCard: {
      backgroundColor: palette.ink,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      ...shadow.card,
    },
    profileKicker: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
      color: palette.gold,
    },
    profileName: {
      fontFamily: fonts.display,
      fontSize: 22,
      fontWeight: "700",
      color: palette.onAccent,
      marginTop: spacing(0.5),
    },
    profileDetail: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: "rgba(255,255,255,0.7)",
      marginTop: spacing(0.5),
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
    signOut: {
      borderWidth: 1.5,
      borderColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.75),
      alignItems: "center",
      marginTop: spacing(4),
    },
    signOutText: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
    },
  });
