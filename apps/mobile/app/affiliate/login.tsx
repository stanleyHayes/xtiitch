import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { affiliateLogin, loadAffiliateSession } from "../../src/affiliateAuth";
import {
  fonts,
  radius,
  spacing,
  type Palette,
  typeScale,
} from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { LoadingButtonLabel, XtiitchMark } from "../../src/ui";

export default function AffiliateLoginScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAffiliateSession().then((session) => {
      if (session) router.replace("/affiliate");
    });
  }, [router]);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your affiliate email and password.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await affiliateLogin(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace("/affiliate");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Affiliate sign-in" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.mark}>
            <XtiitchMark color={palette.onAccent} size={30} />
          </View>
          <Text style={styles.eyebrow}>XTIITCH AFFILIATE</Text>
          <Text style={styles.title}>
            Your links and earnings, wherever you work.
          </Text>
          <Text style={styles.lede}>
            Track qualified referrals, share campaigns, and keep payout details
            current.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formHint}>
            Use the account approved for the affiliate programme.
          </Text>
          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={palette.danger}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={palette.mutedText}
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordField}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              placeholder="Your password"
              placeholderTextColor={palette.mutedText}
              style={styles.passwordInput}
              onSubmitEditing={submit}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
              onPress={() => setShowPassword((value) => !value)}
              hitSlop={10}
              style={styles.reveal}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={21}
                color={palette.mutedText}
              />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={submit}
            style={({ pressed }) => [
              styles.submit,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <LoadingButtonLabel label="Signing in" color={palette.onAccent} />
            ) : (
              <Text style={styles.submitText}>Open affiliate portal</Text>
            )}
          </Pressable>
          <Pressable onPress={() => router.push("/affiliate/recovery")}>
            <Text style={styles.note}>
              Forgot your password? Recover access
            </Text>
          </Pressable>
          <Text style={styles.note}>
            New affiliate applications are reviewed before portal access is
            issued.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { flexGrow: 1, paddingBottom: spacing(5) },
    hero: {
      backgroundColor: palette.burgundyDeep,
      paddingHorizontal: spacing(3),
      paddingTop: spacing(4),
      paddingBottom: spacing(5),
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    mark: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.10)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    eyebrow: {
      marginTop: spacing(3),
      color: palette.gold,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.8,
    },
    title: {
      ...typeScale.display,
      marginTop: spacing(1),
      color: palette.onAccent,
      fontFamily: fonts.display,
      fontWeight: "800",
    },
    lede: {
      ...typeScale.body,
      marginTop: spacing(1.5),
      color: "rgba(255,255,255,0.74)",
      maxWidth: 440,
    },
    form: {
      margin: spacing(2.5),
      marginTop: -spacing(2),
      padding: spacing(2.5),
      borderRadius: radius.lg,
      backgroundColor: palette.elevated,
      borderWidth: 1,
      borderColor: palette.hairline,
    },
    formTitle: {
      ...typeScale.title,
      color: palette.ink,
      fontFamily: fonts.display,
      fontWeight: "800",
    },
    formHint: {
      ...typeScale.body,
      color: palette.mutedText,
      marginTop: spacing(0.5),
      marginBottom: spacing(2),
    },
    label: {
      color: palette.ink,
      fontWeight: "700",
      fontSize: 13,
      marginBottom: spacing(0.75),
      marginTop: spacing(1.25),
    },
    input: {
      minHeight: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      backgroundColor: palette.white,
      paddingHorizontal: spacing(2),
      color: palette.ink,
      fontSize: 16,
    },
    passwordField: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      backgroundColor: palette.white,
    },
    passwordInput: {
      flex: 1,
      minHeight: 50,
      paddingHorizontal: spacing(2),
      color: palette.ink,
      fontSize: 16,
    },
    reveal: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    submit: {
      minHeight: 54,
      marginTop: spacing(2.5),
      borderRadius: radius.pill,
      backgroundColor: palette.burgundy,
      alignItems: "center",
      justifyContent: "center",
    },
    submitText: { color: palette.onAccent, fontWeight: "800", fontSize: 16 },
    pressed: { transform: [{ scale: 0.975 }], opacity: 0.92 },
    disabled: { opacity: 0.62 },
    error: {
      flexDirection: "row",
      gap: spacing(1),
      alignItems: "flex-start",
      padding: spacing(1.5),
      borderRadius: radius.sm,
      backgroundColor: `${palette.danger}12`,
      marginTop: spacing(2),
    },
    errorText: {
      flex: 1,
      color: palette.danger,
      lineHeight: 19,
      fontWeight: "600",
    },
    note: {
      color: palette.mutedText,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      marginTop: spacing(2),
    },
  });
