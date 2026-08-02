import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  requestAffiliateRecovery,
  resetAffiliatePassword,
} from "../../src/affiliateAuth";
import { useTheme } from "../../src/theme-mode";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { LoadingButtonLabel, XtiitchMark } from "../../src/ui";

export default function AffiliateRecoveryScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => stylesFor(palette), [palette]);
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const initialToken = typeof params.token === "string" ? params.token : "";
  const [stage, setStage] = useState<"request" | "reset">(
    initialToken ? "reset" : "request",
  );
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    if (stage === "request") {
      await requestAffiliateRecovery(email);
      setStage("reset");
      setBusy(false);
      return;
    }
    const ok = await resetAffiliatePassword(token, password);
    setBusy(false);
    if (!ok) return setError("That recovery token is invalid or expired.");
    router.replace("/affiliate/login");
  };

  const valid =
    stage === "request"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      : token.trim().length > 10 && password.length >= 8;
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Affiliate recovery" }} />
      <XtiitchMark size={48} />
      <Text style={s.eyebrow}>AFFILIATE ACCESS</Text>
      <Text style={s.title}>
        {stage === "request"
          ? "Recover your workspace."
          : "Set a new password."}
      </Text>
      <Text style={s.lead}>
        {stage === "request"
          ? "We’ll email a secure recovery link if the account exists."
          : "Paste the token from your recovery link and choose a new password."}
      </Text>
      <View style={s.form}>
        {stage === "request" ? (
          <>
            <Text style={s.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="partner@example.com"
              placeholderTextColor={palette.mutedText}
              style={s.input}
            />
          </>
        ) : (
          <>
            <Text style={s.label}>Recovery token</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Paste token"
              placeholderTextColor={palette.mutedText}
              style={s.input}
            />
            <Text style={s.label}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor={palette.mutedText}
              style={s.input}
            />
          </>
        )}
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable
          disabled={!valid || busy}
          onPress={submit}
          style={[s.cta, (!valid || busy) && s.disabled]}
        >
          {busy ? (
            <LoadingButtonLabel
              label={stage === "request" ? "Sending email" : "Saving password"}
            />
          ) : (
            <Text style={s.ctaText}>
              {stage === "request"
                ? "Send recovery email"
                : "Save new password"}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const stylesFor = (p: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.cream },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing(3),
      paddingBottom: spacing(7),
    },
    eyebrow: {
      marginTop: spacing(3),
      color: p.burgundy,
      fontFamily: fonts.body,
      fontWeight: "900",
      letterSpacing: 1.5,
      fontSize: 12,
    },
    title: {
      marginTop: spacing(1.5),
      color: p.ink,
      fontFamily: fonts.display,
      fontSize: 36,
      lineHeight: 39,
      fontWeight: "800",
    },
    lead: {
      marginTop: spacing(2),
      color: p.mutedText,
      fontFamily: fonts.body,
      lineHeight: 23,
    },
    form: { marginTop: spacing(4), gap: spacing(1.5) },
    label: {
      color: p.ink,
      fontFamily: fonts.body,
      fontWeight: "800",
      fontSize: 13,
    },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      backgroundColor: p.panel,
      paddingHorizontal: spacing(2),
      color: p.ink,
    },
    cta: {
      marginTop: spacing(1),
      minHeight: 54,
      borderRadius: radius.pill,
      backgroundColor: p.burgundy,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaText: { color: p.onAccent, fontWeight: "900" },
    disabled: { opacity: 0.45 },
    error: { color: p.danger },
  });
