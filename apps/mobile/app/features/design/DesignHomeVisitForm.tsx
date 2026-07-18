import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  api,
  formatGHS,
  orderErrorMessage,
  type AvailabilitySlot,
  type Design,
  type PlaceOrderResult,
  type StoreSummary,
} from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignContactFields, { type ContactFields } from "./DesignContactFields";
import DesignField from "./DesignField";
import DesignRewardFields, {
  type RewardFieldValues,
} from "./DesignRewardFields";
import DesignVisitSlotPicker from "./DesignVisitSlotPicker";

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type DesignHomeVisitFormProps = {
  design: Design;
  store: StoreSummary;
  visitSlots: AvailabilitySlot[];
  depositMinor: number;
  buttonLabel: string;
  onOrdered: (order: PlaceOrderResult) => void;
};

// Home-visit bespoke: pick an availability slot, give the visit address, pay
// the deposit. Posts to the API's bookings route — which takes no promo code,
// so the rewards row skips it (mirrors the web's includePromo={false}).
export default function DesignHomeVisitForm({
  design,
  store,
  visitSlots,
  depositMinor,
  buttonLabel,
  onOrdered,
}: DesignHomeVisitFormProps) {
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
  const [slotStart, setSlotStart] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    contact.name.trim().length > 1 &&
    contact.phone.trim().length >= 7 &&
    /.+@.+\..+/.test(contact.email.trim()) &&
    slotStart.length > 0 &&
    address.trim().length > 4 &&
    !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await api.placeBooking(store.handle, {
      design_handle: design.handle,
      customer_name: contact.name.trim(),
      customer_phone: contact.phone.trim(),
      customer_email: contact.email.trim(),
      customer_whatsapp: clean(contact.whatsapp),
      method: "momo",
      referral_code: clean(rewards.referralCode),
      affiliate_code: clean(rewards.affiliateCode),
      slot_start: slotStart,
      address: address.trim(),
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
      <Text style={styles.sectionLabel}>Visit slot</Text>
      <DesignVisitSlotPicker
        slots={visitSlots}
        selectedSlotStart={slotStart}
        onSelect={setSlotStart}
      />

      <Text style={styles.sectionLabel}>Visit address</Text>
      <DesignField
        label="Address"
        value={address}
        onChange={setAddress}
        placeholder="House number, street, area, and nearby landmark"
        autoCapitalize="sentences"
        multiline
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
        includePromo={false}
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
