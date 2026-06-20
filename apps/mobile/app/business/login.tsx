import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { loadSession, login } from "../../src/auth";
import { fonts, palette, radius, spacing } from "../../src/theme";
import { SkeletonBlock } from "../../src/ui";

export default function BusinessLoginScreen() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // If a session already exists, skip straight to the dashboard.
  useEffect(() => {
    loadSession().then((session) => {
      if (session) router.replace("/business");
      else setChecking(false);
    });
  }, [router]);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const outcome = await login({
      business_handle: handle,
      owner_email: email,
      owner_password: password,
    });
    setSubmitting(false);
    if (outcome.ok) {
      router.replace("/business");
    } else {
      setError(outcome.error);
    }
  };

  const fillDemo = () => {
    setHandle("demoatelier");
    setEmail("owner@demoatelier.test");
    setPassword("XtiitchDemo!2026");
  };

  const canSubmit =
    handle.trim().length > 1 &&
    /.+@.+\..+/.test(email.trim()) &&
    password.length >= 6 &&
    !submitting;

  if (checking) {
    return (
      <View style={styles.checking}>
        <SkeletonBlock width={132} height={28} radiusOverride={radius.pill} />
        <SkeletonBlock width="64%" height={14} />
        <View style={styles.checkingPanel}>
          <SkeletonBlock height={54} radiusOverride={radius.md} />
          <SkeletonBlock height={54} radiusOverride={radius.md} />
          <SkeletonBlock height={54} radiusOverride={radius.md} />
          <SkeletonBlock height={56} radiusOverride={radius.pill} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>STUDIO CONSOLE</Text>
        <Text style={styles.title}>Sign in to your studio</Text>
        <Text style={styles.lead}>
          Manage orders, fulfilment, and takings on the go.
        </Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Studio handle"
          value={handle}
          onChange={setHandle}
          placeholder="demoatelier"
          autoCapitalize="none"
        />
        <Field
          label="Owner email"
          value={email}
          onChange={setEmail}
          placeholder="owner@studio.test"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={!canSubmit}
          onPress={submit}
          style={[styles.cta, !canSubmit && styles.ctaDisabled]}
        >
          {submitting ? (
            <SkeletonBlock
              width={84}
              height={18}
              radiusOverride={radius.pill}
              style={styles.ctaSkeleton}
            />
          ) : (
            <Text style={styles.ctaText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable style={styles.demo} onPress={fillDemo}>
          <Text style={styles.demoText}>Use demo studio credentials</Text>
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
  autoCapitalize,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "words";
  keyboardType?: "email-address";
  secureTextEntry?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  checking: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.cream,
    padding: spacing(3),
    gap: spacing(1.25),
  },
  checkingPanel: {
    width: "100%",
    marginTop: spacing(2),
    gap: spacing(1.25),
  },
  content: { paddingBottom: spacing(6) },
  hero: {
    backgroundColor: palette.burgundy,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(3),
    paddingBottom: spacing(4),
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  kicker: {
    color: palette.gold,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: palette.white,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: "700",
    marginTop: spacing(1),
  },
  lead: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing(1),
  },
  form: { padding: spacing(3), gap: spacing(1.75) },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: spacing(0.75),
  },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.softBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.75),
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.danger,
    marginTop: spacing(0.5),
  },
  cta: {
    backgroundColor: palette.burgundy,
    borderRadius: radius.pill,
    paddingVertical: spacing(2),
    alignItems: "center",
    marginTop: spacing(1.5),
  },
  ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
  ctaSkeleton: {
    backgroundColor: "rgba(255,255,255,0.58)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  ctaText: {
    color: palette.white,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
  demo: { alignItems: "center", paddingVertical: spacing(1.5) },
  demoText: {
    color: palette.burgundy,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
  },
});
