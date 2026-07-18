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
import DesignOrderingDisabled from "./DesignOrderingDisabled";
import DesignPaymentNotice from "./DesignPaymentNotice";
import DesignRewardFields, {
  type RewardFieldValues,
} from "./DesignRewardFields";
import DesignSizeBandSelector from "./DesignSizeBandSelector";

function cleanRewardCode(value: string): string | undefined {
  const code = value.trim();
  return code.length > 0 ? code : undefined;
}

type DesignOrderFormProps = {
  design: Design;
  store: StoreSummary;
  onOrdered: (order: PlaceOrderResult) => void;
};

export default function DesignOrderForm({
  design,
  store,
  onOrdered,
}: DesignOrderFormProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const [bandId, setBandId] = useState<string | null>(
    design.prices[0]?.size_band_id ?? null,
  );
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
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Mirrors the web storefront: when the store has online ordering switched
  // off, show an explanation instead of a form that would 409 on submit.
  if (store.online_ordering_enabled === false) {
    return <DesignOrderingDisabled storeName={store.name} />;
  }

  const selectedBand = design.prices.find((p) => p.size_band_id === bandId);
  const canSubmit =
    Boolean(bandId) &&
    contact.name.trim().length > 1 &&
    contact.phone.trim().length >= 7 &&
    /.+@.+\..+/.test(contact.email.trim()) &&
    !submitting;

  const submit = async () => {
    if (!bandId) return;
    setSubmitting(true);
    setOrderError(null);
    const result = await api.placeOrder(store.handle, {
      design_handle: design.handle,
      size_band_id: bandId,
      customer_name: contact.name.trim(),
      customer_phone: contact.phone.trim(),
      customer_email: contact.email.trim(),
      customer_whatsapp: cleanRewardCode(contact.whatsapp),
      note: cleanRewardCode(contact.note),
      method: "momo",
      promo_code: cleanRewardCode(rewards.promoCode),
      referral_code: cleanRewardCode(rewards.referralCode),
      affiliate_code: cleanRewardCode(rewards.affiliateCode),
    });
    setSubmitting(false);
    if (result.ok) {
      onOrdered(result.data);
    } else {
      setOrderError(
        result.status === 0
          ? "Network error — please try again."
          : orderErrorMessage(result.error),
      );
    }
  };

  return (
    <View>
      <Text style={styles.sectionLabel}>Choose a size</Text>
      <DesignSizeBandSelector
        prices={design.prices}
        selectedBandId={bandId}
        onSelect={setBandId}
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

      <Text style={styles.sectionLabel}>Payment</Text>
      <DesignPaymentNotice />

      {orderError ? <Text style={styles.error}>{orderError}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        <Text style={styles.ctaText}>
          {submitting
            ? "Placing order…"
            : selectedBand
              ? `Place order · ${formatGHS(selectedBand.price_minor)}`
              : "Place order"}
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
      marginTop: spacing(3),
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
