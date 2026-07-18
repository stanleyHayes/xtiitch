import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { OtpChannel } from "../../../src/customerAuth";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { LoadingButtonLabel } from "../../../src/ui";
import AccountField from "./AccountField";

// The two steps of the customer OTP sign-in (identify → verify), ported from
// the web storefront's features/account/sign-in-flow.tsx. Kept presentational;
// SignInFlow owns the state and the API calls.

function ChannelTabs({
  channel,
  phoneEnabled,
  onSelect,
}: {
  channel: OtpChannel;
  phoneEnabled: boolean | null;
  onSelect: (next: OtpChannel) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tabs: { value: OtpChannel; label: string }[] = [
    { value: "whatsapp", label: "SMS" },
    { value: "email", label: "Email" },
  ];
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const selected = channel === tab.value;
        // No phone-OTP channel configured → the code would never deliver, so
        // the tab disables and annotates "Soon" (same rule as the web tabs).
        const disabled = tab.value === "whatsapp" && phoneEnabled === false;
        return (
          <Pressable
            key={tab.value}
            disabled={disabled}
            onPress={() => onSelect(tab.value)}
            style={[
              styles.tab,
              selected && styles.tabActive,
              disabled && styles.tabDisabled,
            ]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>
              {disabled ? `${tab.label} · Soon` : tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IdentifyStep({
  channel,
  phoneEnabled,
  identifier,
  error,
  submitting,
  onChannelChange,
  onIdentifierChange,
  onSubmit,
}: {
  channel: OtpChannel;
  phoneEnabled: boolean | null;
  identifier: string;
  error: string | null;
  submitting: boolean;
  onChannelChange: (next: OtpChannel) => void;
  onIdentifierChange: (next: string) => void;
  onSubmit: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const isEmail = channel === "email";
  const ready = isEmail
    ? /.+@.+\..+/.test(identifier.trim())
    : identifier.replace(/[^\d]/g, "").length >= 7;
  const canSubmit = ready && !submitting;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {isEmail ? "Sign in with your email" : "Sign in with your phone"}
      </Text>
      <ChannelTabs
        channel={channel}
        phoneEnabled={phoneEnabled}
        onSelect={onChannelChange}
      />
      <Text style={styles.cardLead}>
        {isEmail
          ? "We'll email you a one-time code. No password needed."
          : "We'll text you a one-time code by SMS. No password needed."}
      </Text>
      <AccountField
        label={isEmail ? "Email address" : "Phone number"}
        value={identifier}
        onChange={onIdentifierChange}
        placeholder={isEmail ? "you@example.com" : "024 000 0000"}
        keyboardType={isEmail ? "email-address" : "phone-pad"}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={!canSubmit}
        onPress={onSubmit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        {submitting ? (
          <LoadingButtonLabel label="Sending" />
        ) : (
          <Text style={styles.ctaText}>Send my code</Text>
        )}
      </Pressable>
    </View>
  );
}

export function VerifyStep({
  channel,
  identifier,
  code,
  error,
  submitting,
  onCodeChange,
  onSubmit,
  onResend,
  onChangeIdentifier,
}: {
  channel: OtpChannel;
  identifier: string;
  code: string;
  error: string | null;
  submitting: boolean;
  onCodeChange: (next: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onChangeIdentifier: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const canVerify = code.trim().length === 6 && !submitting;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Enter your code</Text>
      <Text style={styles.cardLead}>
        We sent a 6-digit code to <Text style={styles.strong}>{identifier}</Text>{" "}
        {channel === "email" ? "by email" : "by SMS"}. Enter it below.
      </Text>
      <AccountField
        label="One-time code"
        value={code}
        onChange={onCodeChange}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={!canVerify}
        onPress={onSubmit}
        style={[styles.cta, !canVerify && styles.ctaDisabled]}
      >
        {submitting ? (
          <LoadingButtonLabel label="Verifying" />
        ) : (
          <Text style={styles.ctaText}>Verify &amp; sign in</Text>
        )}
      </Pressable>
      <Pressable
        onPress={onResend}
        disabled={submitting}
        style={styles.link}
        hitSlop={8}
      >
        <Text style={styles.linkText}>Resend code</Text>
      </Pressable>
      <Pressable
        onPress={onChangeIdentifier}
        disabled={submitting}
        style={styles.link}
        hitSlop={8}
      >
        <Text style={styles.linkText}>
          {channel === "email" ? "Use a different email" : "Use a different number"}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      gap: spacing(1.75),
      ...shadow.card,
    },
    cardTitle: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "700",
      color: palette.ink,
    },
    cardLead: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
    },
    strong: { fontWeight: "800", color: palette.ink },
    tabs: {
      flexDirection: "row",
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      backgroundColor: palette.panel,
      padding: spacing(0.5),
      gap: spacing(0.5),
    },
    tab: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
    },
    tabActive: { backgroundColor: palette.burgundy },
    tabDisabled: { opacity: 0.5 },
    tabText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
      color: palette.mutedText,
    },
    tabTextActive: { color: palette.onAccent },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
    },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
    link: { alignSelf: "center" },
    linkText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.burgundy,
    },
  });
