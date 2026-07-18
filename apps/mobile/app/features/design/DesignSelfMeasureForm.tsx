import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  api,
  formatGHS,
  orderErrorMessage,
  type Design,
  type PlaceOrderResult,
  type StoreSummary,
} from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignContactFields, { type ContactFields } from "./DesignContactFields";
import DesignMeasurementInputs from "./DesignMeasurementInputs";
import DesignRewardFields, {
  type RewardFieldValues,
} from "./DesignRewardFields";

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type DesignSelfMeasureFormProps = {
  design: Design;
  store: StoreSummary;
  depositMinor: number;
  buttonLabel: string;
  onOrdered: (order: PlaceOrderResult) => void;
};

// Self-measure bespoke: measurement values from the store's fields, contact
// details, rewards, then pay the deposit. Posts to the API's custom-orders
// route (the web sends the same payload from its design action; unlike the
// web's cart flow, the API needs the contact details up front here).
export default function DesignSelfMeasureForm({
  design,
  store,
  depositMinor,
  buttonLabel,
  onOrdered,
}: DesignSelfMeasureFormProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [contact, setContact] = useState<ContactFields>({
    name: "",
    phone: "",
    email: "",
    whatsapp: "",
    note: "",
  });
  const [rewards, setRewards] = useState<RewardFieldValues>({
    promoCode: "",
    referralCode: "",
    affiliateCode: "",
  });
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledMeasurements = store.measurement_fields.filter(
    (field) => (measurements[field.field_id] ?? "").trim().length > 0,
  );
  const canSubmit =
    contact.name.trim().length > 1 &&
    contact.phone.trim().length >= 7 &&
    /.+@.+\..+/.test(contact.email.trim()) &&
    filledMeasurements.length > 0 &&
    !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const values: Record<string, string> = {};
    filledMeasurements.forEach((field) => {
      values[field.field_id] = measurements[field.field_id].trim();
    });
    const result = await api.placeCustomOrder(store.handle, {
      design_handle: design.handle,
      size_mode: "self_measure",
      customer_name: contact.name.trim(),
      customer_phone: contact.phone.trim(),
      customer_email: contact.email.trim(),
      customer_whatsapp: clean(contact.whatsapp),
      method: "momo",
      promo_code: clean(rewards.promoCode),
      referral_code: clean(rewards.referralCode),
      affiliate_code: clean(rewards.affiliateCode),
      measurements: values,
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
      <Text style={styles.sectionLabel}>Your measurements</Text>
      <DesignMeasurementInputs
        fields={store.measurement_fields}
        values={measurements}
        onChange={(fieldId, next) =>
          setMeasurements((prev) => ({ ...prev, [fieldId]: next }))
        }
      />

      <Text style={styles.sectionLabel}>Your details</Text>
      <DesignContactFields
        values={contact}
        onChange={(field, next) =>
          setContact((prev) => ({ ...prev, [field]: next }))
        }
      />

      <Text style={styles.sectionLabel}>Rewards</Text>
      <DesignRewardFields
        values={rewards}
        onChange={(field, next) =>
          setRewards((prev) => ({ ...prev, [field]: next }))
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        <Text style={styles.ctaText}>
          {submitting
            ? "Placing order…"
            : `${buttonLabel} · ${formatGHS(depositMinor)}`}
        </Text>
      </Pressable>
      <Text style={styles.disclaimer}>
        You&apos;ll be sent to Paystack to pay securely. Xtiitch never holds
        your funds.
      </Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
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
    disclaimer: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(1.5),
      lineHeight: 18,
    },
  });
