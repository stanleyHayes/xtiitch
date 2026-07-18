import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  api,
  orderErrorMessage,
  type Design,
  type PlaceOrderResult,
  type StoreSummary,
} from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignContactFields, { type ContactFields } from "./DesignContactFields";
import { useContactPrefill, useCustomerGate } from "./useCustomerGate";

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type DesignShopReserveFormProps = {
  design: Design;
  store: StoreSummary;
  buttonLabel: string;
  onOrdered: (order: PlaceOrderResult) => void;
};

// Come-to-shop bespoke: reserve the request with contact details only — no
// online payment, no rewards (the API rejects promo codes on this route and
// confirms the order at once; the store settles everything in person).
export default function DesignShopReserveForm({
  design,
  store,
  buttonLabel,
  onOrdered,
}: DesignShopReserveFormProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [contact, setContact] = useState<ContactFields>({
    name: "",
    phone: "",
    email: "",
    whatsapp: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // §3b: the web gates the whole bespoke "custom" intent — including the
  // come-to-shop route — before it branches on size mode (design.tsx:213-218),
  // so this form gates too even though it raises no online charge. The session
  // also prefills the contact fields from the profile.
  const { session, ensureSession } = useCustomerGate(design.handle);
  useContactPrefill(session, setContact);

  const canSubmit =
    contact.name.trim().length > 1 &&
    contact.phone.trim().length >= 7 &&
    /.+@.+\..+/.test(contact.email.trim()) &&
    !submitting;

  const submit = async () => {
    // §3b gate: bespoke requests need a verified customer session, exactly as
    // the web action checks before taking any "custom" intent.
    if (!(await ensureSession())) return;
    setSubmitting(true);
    setError(null);
    // No method: the come-to-shop route raises no charge (mirrors the web
    // action, which omits the payment method for this size mode).
    const result = await api.placeCustomOrder(store.handle, {
      design_handle: design.handle,
      size_mode: "come_to_shop",
      customer_name: contact.name.trim(),
      customer_phone: contact.phone.trim(),
      customer_email: contact.email.trim(),
      customer_whatsapp: clean(contact.whatsapp),
      note: clean(contact.note),
    });
    setSubmitting(false);
    if (result.ok) {
      onOrdered(result.data);
    } else {
      setError(
        result.status === 0
          ? "Network error — please try again."
          : orderErrorMessage(result.error),
      );
    }
  };

  return (
    <View>
      <View style={styles.info}>
        <Text style={styles.infoText}>
          Reserve now, then visit {store.name} to have your measurements taken
          and settle payment in person.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Your details</Text>
      <DesignContactFields
        values={contact}
        onChange={(field, next) =>
          setContact((prev) => ({ ...prev, [field]: next }))
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        <Text style={styles.ctaText}>
          {submitting ? "Reserving…" : buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    info: {
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.sm,
      backgroundColor: palette.panel,
      padding: spacing(1.5),
      marginTop: spacing(1.5),
    },
    infoText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      lineHeight: 19,
    },
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginTop: spacing(2.5),
      marginBottom: spacing(1.5),
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(2),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
      marginTop: spacing(2.5),
    },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
  });
