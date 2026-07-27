import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  CustomerSessionExpiredError,
  updateCustomerProfile,
  type CustomerProfile,
} from "../../../src/customerAuth";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { LoadingButtonLabel } from "../../../src/ui";
import AccountField from "./AccountField";

// Editable profile card (PATCH /customer/me). The sign-in phone is fixed — the
// note under the card says so. Errors and the saved confirmation render
// inline; onSaved hands the fresh profile back up so the header card updates.
export default function ProfileEditCard({
  profile,
  onSaved,
  onSessionExpired,
}: {
  profile: CustomerProfile | null;
  onSaved: (next: CustomerProfile) => void;
  onSessionExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Prefill once per customer — keying on customer_id keeps pull-to-refresh
  // from clobbering edits in progress.
  const customerId = profile?.customer_id;
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setEmail(profile.email);
    setWhatsapp(profile.whatsapp_phone);
  }, [customerId]);

  const edit = (set: (next: string) => void) => (next: string) => {
    set(next);
    setSaved(false);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const outcome = await updateCustomerProfile({
        display_name: displayName.trim(),
        email: email.trim(),
        whatsapp_phone: whatsapp.trim(),
      });
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      setSaved(true);
      onSaved(outcome.profile);
    } catch (err) {
      if (err instanceof CustomerSessionExpiredError) {
        onSessionExpired();
      } else {
        setError("Network error — check your connection and retry.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your details</Text>
        <AccountField
          label="Display name"
          value={displayName}
          onChange={edit(setDisplayName)}
          placeholder="Ama Serwaa"
          maxLength={80}
        />
        <AccountField
          label="Email address"
          value={email}
          onChange={edit(setEmail)}
          placeholder="you@example.com"
          keyboardType="email-address"
          maxLength={120}
        />
        <AccountField
          label="WhatsApp number"
          value={whatsapp}
          onChange={edit(setWhatsapp)}
          placeholder="024 000 0000"
          keyboardType="phone-pad"
          maxLength={24}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>Saved.</Text> : null}
        <Pressable
          disabled={saving}
          onPress={() => void save()}
          style={[styles.cta, saving && styles.ctaDisabled]}
        >
          {saving ? (
            <LoadingButtonLabel label="Saving" />
          ) : (
            <Text style={styles.ctaText}>Save</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.note}>Your sign-in phone cannot be changed.</Text>
    </>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      gap: spacing(1.75),
      marginTop: spacing(2),
      ...shadow.card,
    },
    cardTitle: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "700",
      color: palette.ink,
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
    },
    saved: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.success,
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.75),
      alignItems: "center",
    },
    ctaDisabled: { opacity: 0.6 },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
    },
    note: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(1),
    },
  });
