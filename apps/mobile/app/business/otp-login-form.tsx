import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { requestSignInOtp, verifySignInOtp } from "../../src/businessOtp";
import { useTheme } from "../../src/theme-mode";
import { LoadingButtonLabel } from "../../src/ui";
import { LoginField, makeLoginStyles } from "./login-ui";

// WhatsApp code sign-in, mirroring the dashboard's code mode: request sends a
// one-time code to the registered number (the endpoint is opaque, so we always
// advance to the code step), verify redeems it — possibly handing an MFA
// challenge back up to the shared second-factor form.
export default function OtpLoginForm({
  handle,
  onHandleChange,
  onMfaChallenge,
  onBack,
}: {
  handle: string;
  onHandleChange: (next: string) => void;
  onMfaChallenge: (token: string) => void;
  onBack: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeLoginStyles(palette), [palette]);
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setError(null);
    setSubmitting(true);
    await requestSignInOtp(handle, whatsapp);
    setSubmitting(false);
    setSent(true);
  };

  const verify = async () => {
    setError(null);
    setSubmitting(true);
    const outcome = await verifySignInOtp(handle, whatsapp, code);
    setSubmitting(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    // MFA-enabled account: hand the challenge up so the shared code step
    // redeems it exactly like the password path does.
    if ("mfa" in outcome) {
      onMfaChallenge(outcome.challenge_token);
      return;
    }
    router.replace("/business");
  };

  const digits = whatsapp.replace(/[^\d]/g, "");
  const canRequest =
    handle.trim().length > 1 && digits.length >= 7 && !submitting;
  const canVerify = code.trim().length > 0 && !submitting;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>STUDIO CONSOLE</Text>
        <Text style={styles.title}>Sign in with a code</Text>
        <Text style={styles.lead}>
          We'll send a one-time code to the WhatsApp number registered to your
          studio.
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
          label="WhatsApp number"
          value={whatsapp}
          onChange={setWhatsapp}
          placeholder="+233 XX XXX XXXX"
          keyboardType="phone-pad"
        />
        {sent ? (
          <LoginField
            label="One-time code"
            value={code}
            onChange={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoCapitalize="none"
          />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {sent ? (
          <Pressable
            disabled={!canVerify}
            onPress={verify}
            style={[styles.cta, !canVerify && styles.ctaDisabled]}
          >
            {submitting ? (
              <LoadingButtonLabel label="Verifying" />
            ) : (
              <Text style={styles.ctaText}>Verify and continue</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            disabled={!canRequest}
            onPress={requestCode}
            style={[styles.cta, !canRequest && styles.ctaDisabled]}
          >
            {submitting ? (
              <LoadingButtonLabel label="Sending" />
            ) : (
              <Text style={styles.ctaText}>Send code</Text>
            )}
          </Pressable>
        )}

        {sent ? (
          <Pressable
            style={styles.link}
            onPress={requestCode}
            disabled={!canRequest}
          >
            <Text style={styles.linkText}>Resend code</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.link} onPress={onBack} disabled={submitting}>
          <Text style={styles.linkText}>Back to password sign-in</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
