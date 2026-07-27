import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { formatGHS } from "../../../../src/api";
import {
  businessOpsApi,
  type LogTakingInput,
} from "../../../../src/businessOpsApi";
import { LoadingButtonLabel } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type TakingMethod = LogTakingInput["method"];

// No "card" here — the takings API only accepts cash / momo / other.
const METHODS: { value: TakingMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "momo", label: "Mobile money" },
  { value: "other", label: "Other" },
];

export function LogTakingCard({
  onLogged,
  onExpired,
}: {
  onLogged: () => Promise<void>;
  onExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<TakingMethod>("cash");
  const [whatFor, setWhatFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = amount.trim().length > 0 && !submitting;

  const submit = async () => {
    setError(null);
    setSuccess(null);
    const minor = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!whatFor.trim()) {
      setError("Say what the taking is for.");
      return;
    }
    setSubmitting(true);
    const result = await businessOpsApi.logTaking({
      amount_minor: minor,
      method,
      what_for: whatFor.trim(),
    });
    setSubmitting(false);
    if (result.ok) {
      setAmount("");
      setWhatFor("");
      setSuccess(`Logged ${formatGHS(minor)}.`);
      await onLogged();
    } else if (result.expired) {
      onExpired();
    } else {
      setError("Couldn't log the taking. Check the details and retry.");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.fieldLabel}>Amount (GH₵)</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        placeholderTextColor={palette.mutedText}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>Method</Text>
      <View style={styles.methodRow}>
        {METHODS.map((option) => {
          const active = option.value === method;
          return (
            <Pressable
              key={option.value}
              onPress={() => setMethod(option.value)}
              style={[styles.method, active && styles.methodActive]}
            >
              <Text
                style={[styles.methodText, active && styles.methodTextActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>What for</Text>
      <TextInput
        value={whatFor}
        onChangeText={setWhatFor}
        placeholder="Balance, walk-in, alteration"
        placeholderTextColor={palette.mutedText}
        autoCapitalize="sentences"
        autoCorrect={false}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        {submitting ? (
          <LoadingButtonLabel label="Logging taking" />
        ) : (
          <Text style={styles.ctaText}>Log taking</Text>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
    },
    fieldLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
      marginTop: spacing(1.5),
      marginBottom: spacing(0.75),
    },
    input: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
    methodRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
    method: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      backgroundColor: palette.white,
    },
    methodActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    methodText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    methodTextActive: { color: palette.burgundy },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(1.5),
    },
    success: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.success,
      marginTop: spacing(1.5),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.75),
      alignItems: "center",
      marginTop: spacing(2),
    },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
    },
  });
