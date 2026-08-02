import { useCallback, useMemo, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  affiliateApi,
  type AffiliatePayoutProfile,
  type AffiliatePreferences,
} from "../../src/affiliateApi";
import {
  fonts,
  radius,
  spacing,
  type Palette,
  typeScale,
} from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { CenterState, LoadingButtonLabel } from "../../src/ui";

const EMPTY_PREFERENCES: AffiliatePreferences = {
  conversion_emails: false,
  approval_emails: false,
  reversal_emails: false,
  payout_emails: false,
};

// eslint-disable-next-line max-lines-per-function -- payout and notification settings share one workflow
export default function AffiliateSettingsScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [profile, setProfile] = useState<AffiliatePayoutProfile | null>(null);
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const [method, setMethod] = useState("mobile_money");
  const [accountName, setAccountName] = useState("");
  const [provider, setProvider] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState<"payout" | "notifications" | "">("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [p, n] = await Promise.all([
      affiliateApi.payoutProfile(),
      affiliateApi.preferences(),
    ]);
    if ((!p.ok && p.expired) || (!n.ok && n.expired)) {
      router.replace("/affiliate/login");
      return;
    }
    if (p.ok) {
      setProfile(p.data);
      setMethod(p.data.payout_method || "mobile_money");
      setAccountName(p.data.account_name || "");
      setProvider(p.data.provider_name || "");
    }
    if (n.ok) setPreferences(n.data);
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (!profile) return <CenterState loading />;
  const savePayout = async () => {
    if (
      !method ||
      !accountName.trim() ||
      !provider.trim() ||
      !identifier.trim()
    ) {
      setMessage(
        "Complete every payout field, including the full account number.",
      );
      return;
    }
    setBusy("payout");
    setMessage("");
    const result = await affiliateApi.updatePayoutProfile({
      payout_method: method,
      account_name: accountName.trim(),
      provider_name: provider.trim(),
      account_identifier: identifier.trim(),
    });
    setBusy("");
    setMessage(
      result.ok
        ? "Payout details updated."
        : "We couldn't update payout details.",
    );
    if (result.ok) {
      setProfile(result.data);
      setIdentifier("");
    }
  };
  const savePreferences = async () => {
    setBusy("notifications");
    setMessage("");
    const result = await affiliateApi.updatePreferences(preferences);
    setBusy("");
    setMessage(
      result.ok
        ? "Email preferences saved."
        : "We couldn't save email preferences.",
    );
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Affiliate settings" }} />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>AFFILIATE PROFILE</Text>
        <Text style={styles.heroTitle}>Keep payouts moving.</Text>
        <Text style={styles.heroHint}>
          Review the masked destination, then enter the full number only when
          changing it.
        </Text>
        {profile.masked_identifier ? (
          <Text style={styles.masked}>
            {profile.provider_name} · {profile.masked_identifier}
          </Text>
        ) : null}
      </View>
      {message ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
      ) : null}
      <Text style={styles.title}>Payout destination</Text>
      <View style={styles.card}>
        <Field
          label="Method"
          value={method}
          onChange={setMethod}
          placeholder="mobile_money"
        />
        <Field
          label="Account name"
          value={accountName}
          onChange={setAccountName}
          placeholder="Name on account"
        />
        <Field
          label="Provider"
          value={provider}
          onChange={setProvider}
          placeholder="MTN MoMo, Telecel Cash, bank…"
        />
        <Field
          label="Full account number"
          value={identifier}
          onChange={setIdentifier}
          placeholder="Required to make a change"
          keyboard="phone-pad"
        />
        <Pressable
          disabled={Boolean(busy)}
          onPress={savePayout}
          style={styles.button}
        >
          {busy === "payout" ? (
            <LoadingButtonLabel label="Updating" color={palette.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Update payout details</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.title}>Email notifications</Text>
      <View style={styles.card}>
        {(
          [
            [
              "conversion_emails",
              "New conversions",
              "When a qualified action is recorded",
            ],
            [
              "approval_emails",
              "Commission approved",
              "When pending commission becomes available",
            ],
            [
              "reversal_emails",
              "Commission reversals",
              "When a conversion is reversed",
            ],
            ["payout_emails", "Payout updates", "When a payout changes status"],
          ] as const
        ).map(([key, title, hint], index) => (
          <View
            key={key}
            style={[styles.toggleRow, index > 0 && styles.border]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{title}</Text>
              <Text style={styles.toggleHint}>{hint}</Text>
            </View>
            <Switch
              value={preferences[key]}
              onValueChange={(value) =>
                setPreferences((current) => ({ ...current, [key]: value }))
              }
              trackColor={{ false: palette.softBorder, true: palette.burgundy }}
              thumbColor={palette.onAccent}
            />
          </View>
        ))}
        <Pressable
          disabled={Boolean(busy)}
          onPress={savePreferences}
          style={styles.button}
        >
          {busy === "notifications" ? (
            <LoadingButtonLabel label="Saving" color={palette.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Save email preferences</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  keyboard?: "phone-pad";
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        keyboardType={keyboard}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}
const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(2.5), paddingBottom: spacing(6) },
    hero: {
      padding: spacing(2.5),
      backgroundColor: palette.burgundyDeep,
      borderRadius: radius.lg,
    },
    eyebrow: {
      color: palette.gold,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.5,
    },
    heroTitle: {
      ...typeScale.title,
      color: palette.onAccent,
      fontFamily: fonts.display,
      fontWeight: "800",
      marginTop: spacing(1),
    },
    heroHint: {
      color: "rgba(255,255,255,0.66)",
      lineHeight: 20,
      marginTop: spacing(0.75),
    },
    masked: {
      color: palette.onAccent,
      fontWeight: "800",
      marginTop: spacing(2),
      paddingTop: spacing(2),
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.12)",
    },
    message: {
      color: palette.burgundy,
      fontWeight: "700",
      marginTop: spacing(2),
    },
    title: {
      ...typeScale.heading,
      color: palette.ink,
      fontFamily: fonts.display,
      fontWeight: "800",
      marginTop: spacing(3),
      marginBottom: spacing(1.25),
    },
    card: {
      gap: spacing(1.5),
      padding: spacing(2),
      backgroundColor: palette.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.hairline,
    },
    label: {
      color: palette.ink,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: spacing(0.6),
    },
    input: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.sm,
      backgroundColor: palette.white,
      color: palette.ink,
      paddingHorizontal: spacing(1.5),
      fontSize: 15,
    },
    button: {
      minHeight: 50,
      borderRadius: radius.pill,
      backgroundColor: palette.burgundy,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing(0.5),
    },
    buttonText: { color: palette.onAccent, fontWeight: "800" },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.5),
      paddingVertical: spacing(1),
    },
    border: {
      borderTopWidth: 1,
      borderTopColor: palette.hairline,
      paddingTop: spacing(1.5),
    },
    toggleTitle: { color: palette.ink, fontWeight: "800" },
    toggleHint: {
      color: palette.mutedText,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
  });
