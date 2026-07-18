import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api, type Design, type StoreSummary } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignField from "./DesignField";

type DesignWaitlistPanelProps = {
  store?: StoreSummary;
  design: Design;
};

// Waiting-list capture for sold-out or made-to-order pieces — ports the web
// storefront's WaitlistPanel (features/design/waitlist.tsx), including its
// condition: render only when the store has the waitlist switched on.
export default function DesignWaitlistPanel({
  store,
  design,
}: DesignWaitlistPanelProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  if (!store?.waitlist_enabled) {
    return null;
  }

  const canSubmit =
    name.trim().length > 1 && contact.trim().length >= 5 && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await api.joinWaitlist(store.handle, design.handle, {
      customer_name: name.trim(),
      customer_contact: contact.trim(),
      note: note.trim(),
    });
    setSubmitting(false);
    if (result.ok) {
      setJoined(true);
    } else {
      setError(
        result.status === 409
          ? "This store is not taking waiting-list sign-ups right now."
          : "Could not join the waiting list. Please try again.",
      );
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Join the waiting list</Text>
      <Text style={styles.body}>
        Sold out or made to order? Leave your details and {store.name} will
        reach out when {design.title} is ready to order.
      </Text>
      {joined ? (
        <Text style={styles.success}>
          You are on the list — {store.name} will be in touch.
        </Text>
      ) : (
        <View style={styles.form}>
          <DesignField
            label="Your name"
            value={name}
            onChange={setName}
            placeholder="Ama Mensah"
          />
          <DesignField
            label="Phone or email"
            value={contact}
            onChange={setContact}
            placeholder="+233 50 123 4567"
            autoCapitalize="none"
          />
          <DesignField
            label="Note (optional)"
            value={note}
            onChange={setNote}
            placeholder="Size, colour, timing…"
            autoCapitalize="sentences"
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={!canSubmit}
            onPress={submit}
            style={[styles.cta, !canSubmit && styles.ctaDisabled]}
          >
            <Text style={styles.ctaText}>
              {submitting ? "Joining list…" : "Notify me"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    panel: {
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      backgroundColor: palette.panel,
      padding: spacing(2.5),
      marginTop: spacing(3),
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 17,
      fontWeight: "700",
      color: palette.ink,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
      marginTop: spacing(0.75),
    },
    success: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.success,
      lineHeight: 20,
      marginTop: spacing(1.5),
    },
    form: { gap: spacing(1.75), marginTop: spacing(2) },
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
  });
