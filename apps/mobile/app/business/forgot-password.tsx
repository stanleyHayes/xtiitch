import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import {
  confirmBusinessPasswordReset,
  requestBusinessPasswordReset,
} from "../../src/business-onboarding";
import { useTheme } from "../../src/theme-mode";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { LoadingButtonLabel } from "../../src/ui";

export default function BusinessForgotPasswordScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => stylesFor(palette), [palette]);
  const router = useRouter();
  const [stage, setStage] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    if (stage === "request") {
      await requestBusinessPasswordReset(email);
      setStage("confirm");
      setBusy(false);
      return;
    }
    const ok = await confirmBusinessPasswordReset(email, code, password);
    setBusy(false);
    if (!ok)
      return setError(
        "That code is invalid or expired. Request a new one and retry.",
      );
    router.replace("/business/login");
  };

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    (stage === "request" || (code.trim().length === 6 && password.length >= 8));

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Reset access" }} />
      <Text style={s.eyebrow}>ACCOUNT RECOVERY</Text>
      <Text style={s.title}>
        {stage === "request"
          ? "Get back into your studio."
          : "Choose a new password."}
      </Text>
      <Text style={s.lead}>
        {stage === "request"
          ? "Enter your account email. We’ll send a six-digit code without revealing whether the address is registered."
          : `Enter the code sent for ${email} and a password of at least eight characters.`}
      </Text>
      <View style={s.form}>
        <Text style={s.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          editable={stage === "request"}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="owner@studio.com"
          placeholderTextColor={pMuted(palette)}
          style={s.input}
        />
        {stage === "confirm" ? (
          <>
            <Text style={s.label}>Six-digit code</Text>
            <TextInput
              value={code}
              onChangeText={(value) =>
                setCode(value.replace(/\D/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor={pMuted(palette)}
              style={s.input}
            />
            <Text style={s.label}>New password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor={pMuted(palette)}
              style={s.input}
            />
          </>
        ) : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable
          disabled={!valid || busy}
          onPress={submit}
          style={[s.cta, (!valid || busy) && s.disabled]}
        >
          {busy ? (
            <LoadingButtonLabel
              label={
                stage === "request" ? "Sending code" : "Resetting password"
              }
            />
          ) : (
            <Text style={s.ctaText}>
              {stage === "request" ? "Send reset code" : "Reset password"}
            </Text>
          )}
        </Pressable>
        {stage === "confirm" ? (
          <Pressable onPress={() => setStage("request")}>
            <Text style={s.link}>Use a different email or resend</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const pMuted = (p: Palette) => p.mutedText;
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
      fontWeight: "800",
      fontSize: 36,
      lineHeight: 39,
    },
    lead: {
      marginTop: spacing(2),
      color: p.mutedText,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 23,
    },
    form: { marginTop: spacing(4), gap: spacing(1.5) },
    label: {
      color: p.ink,
      fontFamily: fonts.body,
      fontWeight: "800",
      fontSize: 13,
      marginTop: spacing(0.5),
    },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      backgroundColor: p.panel,
      paddingHorizontal: spacing(2),
      color: p.ink,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    error: { color: p.danger, fontFamily: fonts.body, fontSize: 14 },
    cta: {
      marginTop: spacing(1),
      minHeight: 54,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: p.burgundy,
    },
    disabled: { opacity: 0.45 },
    ctaText: { color: p.onAccent, fontFamily: fonts.body, fontWeight: "900" },
    link: {
      textAlign: "center",
      color: p.burgundy,
      fontFamily: fonts.body,
      fontWeight: "800",
      padding: spacing(1),
    },
  });
