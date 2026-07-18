import { useEffect, useState, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { loadSession, login, verifyMfaLogin } from "../../src/auth";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { LoadingButtonLabel, SkeletonBlock } from "../../src/ui";

export default function BusinessLoginScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
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
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    // MFA-enabled account: the API answered with a challenge instead of
    // tokens — advance to the code step without navigating.
    if ("mfa" in outcome) {
      setMfaChallenge(outcome.challenge_token);
      return;
    }
    router.replace("/business");
  };

  const verify = async () => {
    if (!mfaChallenge) return;
    setError(null);
    setSubmitting(true);
    const outcome = await verifyMfaLogin(mfaChallenge, code, handle);
    setSubmitting(false);
    if (outcome.ok) router.replace("/business");
    else setError(outcome.error);
  };

  const backToPassword = () => {
    setMfaChallenge(null);
    setCode("");
    setError(null);
  };

  const canSubmit =
    handle.trim().length > 1 &&
    /.+@.+\..+/.test(email.trim()) &&
    password.length >= 6 &&
    !submitting;
  const canVerify = code.trim().length > 0 && !submitting;

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

  if (mfaChallenge) {
    return (
      <MfaChallengeForm
        code={code}
        onCodeChange={setCode}
        error={error}
        submitting={submitting}
        canVerify={canVerify}
        onVerify={verify}
        onBack={backToPassword}
      />
    );
  }

  return (
    <PasswordForm
      handle={handle}
      email={email}
      password={password}
      onHandleChange={setHandle}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      error={error}
      submitting={submitting}
      canSubmit={canSubmit}
      onSubmit={submit}
    />
  );
}

function PasswordForm({
  handle,
  email,
  password,
  onHandleChange,
  onEmailChange,
  onPasswordChange,
  error,
  submitting,
  canSubmit,
  onSubmit,
}: {
  handle: string;
  email: string;
  password: string;
  onHandleChange: (next: string) => void;
  onEmailChange: (next: string) => void;
  onPasswordChange: (next: string) => void;
  error: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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
          onChange={onHandleChange}
          placeholder="demoatelier"
          autoCapitalize="none"
        />
        <Field
          label="Owner email"
          value={email}
          onChange={onEmailChange}
          placeholder="owner@studio.test"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChange={onPasswordChange}
          placeholder="••••••••"
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={!canSubmit}
          onPress={onSubmit}
          style={[styles.cta, !canSubmit && styles.ctaDisabled]}
        >
          {submitting ? (
            <LoadingButtonLabel label="Signing in" />
          ) : (
            <Text style={styles.ctaText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// Second factor, mirroring the dashboard MfaForm: redeem the login challenge
// with the authenticator (or backup) code. Errors stay on this step so the
// code can be retried; an expired challenge sends the user back to sign in.
function MfaChallengeForm({
  code,
  onCodeChange,
  error,
  submitting,
  canVerify,
  onVerify,
  onBack,
}: {
  code: string;
  onCodeChange: (next: string) => void;
  error: string | null;
  submitting: boolean;
  canVerify: boolean;
  onVerify: () => void;
  onBack: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>TWO-STEP VERIFICATION</Text>
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.lead}>
          Open your authenticator app and enter the 6-digit code, or use a
          backup code.
        </Text>
      </View>

      <View style={styles.form}>
        <Field
          label="Authentication code"
          value={code}
          onChange={onCodeChange}
          placeholder="123456 or a backup code"
          autoCapitalize="none"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={!canVerify}
          onPress={onVerify}
          style={[styles.cta, !canVerify && styles.ctaDisabled]}
        >
          {submitting ? (
            <LoadingButtonLabel label="Verifying" />
          ) : (
            <Text style={styles.ctaText}>Verify and continue</Text>
          )}
        </Pressable>

        <Pressable style={styles.link} onPress={onBack} disabled={submitting}>
          <Text style={styles.linkText}>Back to sign in</Text>
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
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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

const makeStyles = (palette: Palette) => StyleSheet.create({
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
    color: palette.onAccent,
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
  ctaText: {
    color: palette.onAccent,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
  link: { alignItems: "center", paddingVertical: spacing(1.5) },
  linkText: {
    color: palette.burgundy,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
  },
});
