import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  phoneOtpEnabled,
  requestOtp,
  verifyOtp,
  type CustomerSession,
  type OtpChannel,
} from "../../../src/customerAuth";
import { fonts, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { IdentifyStep, VerifyStep } from "./SignInSteps";

type Step = "identify" | "verify";

// Customer OTP sign-in orchestrator: request a code on the chosen channel,
// verify it, hand the session up. `gated` means the shopper arrived from a
// §3b pay gate, so the copy says why sign-in is needed and that they'll come
// straight back to the order.
export default function SignInFlow({
  gated,
  onSignedIn,
}: {
  gated: boolean;
  onSignedIn: (session: CustomerSession) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [channel, setChannel] = useState<OtpChannel>("whatsapp");
  const [phoneEnabled, setPhoneEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    phoneOtpEnabled().then((enabled) => {
      if (!active) return;
      setPhoneEnabled(enabled);
      // Fail closed like the web account action: never offer a phone code
      // that would never be delivered — the email channel always delivers.
      if (!enabled) setChannel("email");
    });
    return () => {
      active = false;
    };
  }, []);

  const request = async () => {
    setSubmitting(true);
    setError(null);
    const outcome = await requestOtp(identifier.trim(), channel);
    setSubmitting(false);
    if (outcome.ok) {
      setStep("verify");
      return;
    }
    setError(outcome.error);
  };

  const verify = async () => {
    setSubmitting(true);
    setError(null);
    const outcome = await verifyOtp(identifier.trim(), code.trim(), channel);
    setSubmitting(false);
    if (outcome.ok) {
      onSignedIn(outcome.session);
      return;
    }
    setError(outcome.error);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>YOUR ACCOUNT</Text>
        <Text style={styles.title}>{gated ? "Sign in to pay" : "Sign in"}</Text>
        <Text style={styles.lead}>
          {gated
            ? "Paying needs a verified account. Sign in with a one-time code — no password — and you'll come straight back to your order."
            : "One code by SMS or email — no password. Track every order you place, across every Xtiitch studio."}
        </Text>
      </View>

      {step === "verify" ? (
        <VerifyStep
          channel={channel}
          identifier={identifier}
          code={code}
          error={error}
          submitting={submitting}
          onCodeChange={setCode}
          onSubmit={verify}
          onResend={() => {
            setCode("");
            void request();
          }}
          onChangeIdentifier={() => {
            setStep("identify");
            setCode("");
            setError(null);
          }}
        />
      ) : (
        <IdentifyStep
          channel={channel}
          phoneEnabled={phoneEnabled}
          identifier={identifier}
          error={error}
          submitting={submitting}
          onChannelChange={(next) => {
            setChannel(next);
            setError(null);
          }}
          onIdentifierChange={setIdentifier}
          onSubmit={request}
        />
      )}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    hero: { marginBottom: spacing(3) },
    kicker: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 2,
      color: palette.gold,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 32,
      fontWeight: "800",
      color: palette.ink,
      marginTop: spacing(0.75),
    },
    lead: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.mutedText,
      lineHeight: 22,
      marginTop: spacing(1),
    },
  });
