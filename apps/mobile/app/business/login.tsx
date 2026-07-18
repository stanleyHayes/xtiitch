import { useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { loadSession, login, verifyMfaLogin } from "../../src/auth";
import { radius } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { LoadingButtonLabel, SkeletonBlock } from "../../src/ui";
import { LoginField, makeLoginStyles } from "./login-ui";
import OtpLoginForm from "./otp-login-form";

export default function BusinessLoginScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeLoginStyles(palette), [palette]);
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<"password" | "code">("password");
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
    setMethod("password");
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

  if (method === "code") {
    return (
      <OtpLoginForm
        handle={handle}
        onHandleChange={setHandle}
        onMfaChallenge={setMfaChallenge}
        onBack={() => setMethod("password")}
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
      onUseCode={() => setMethod("code")}
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
  onUseCode,
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
  onUseCode: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeLoginStyles(palette), [palette]);
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
        <LoginField
          label="Studio handle"
          value={handle}
          onChange={onHandleChange}
          placeholder="demoatelier"
          autoCapitalize="none"
        />
        <LoginField
          label="Owner email"
          value={email}
          onChange={onEmailChange}
          placeholder="owner@studio.test"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <LoginField
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

        <Pressable style={styles.link} onPress={onUseCode} disabled={submitting}>
          <Text style={styles.linkText}>Sign in with a code instead</Text>
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
  const styles = useMemo(() => makeLoginStyles(palette), [palette]);
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
        <LoginField
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
