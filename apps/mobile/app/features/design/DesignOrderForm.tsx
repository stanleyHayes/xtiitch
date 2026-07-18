import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatGHS,
  orderErrorMessage,
  api,
  type ApiResult,
  type Design,
  type DeliveryZone,
  type PlaceOrderResult,
  type StoreSummary,
} from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignContactFields, { type ContactFields } from "./DesignContactFields";
import DesignDeliveryFields, {
  type DeliveryValues,
} from "./DesignDeliveryFields";
import DesignOrderingDisabled from "./DesignOrderingDisabled";
import DesignPaymentNotice from "./DesignPaymentNotice";
import DesignRewardFields, {
  type RewardFieldValues,
} from "./DesignRewardFields";
import DesignSizeBandSelector from "./DesignSizeBandSelector";
import { useContactPrefill, useCustomerGate } from "./useCustomerGate";
import { useDeliveryZones } from "./useDeliveryZones";

function cleanRewardCode(value: string): string | undefined {
  const code = value.trim();
  return code.length > 0 ? code : undefined;
}

// Pickup keeps the original single-order route; delivery must go through the
// cart route — the only one whose body carries zone + address (verified
// against the Go checkout handler).
function submitPickupOrder(
  store: StoreSummary,
  design: Design,
  bandId: string,
  contact: ContactFields,
  rewards: RewardFieldValues,
): Promise<ApiResult<PlaceOrderResult>> {
  return api.placeOrder(store.handle, {
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
}

function submitDeliveryOrder(
  store: StoreSummary,
  design: Design,
  bandId: string,
  contact: ContactFields,
  delivery: DeliveryValues,
): Promise<ApiResult<PlaceOrderResult>> {
  // The cart body has no reward-code fields, so codes are intentionally not
  // sent here (the rewards section is hidden when delivery is chosen).
  return api.placeCartOrder(store.handle, {
    items: [
      {
        design_handle: design.handle,
        size_band_id: bandId,
        kind: "made_to_wear",
        note: cleanRewardCode(contact.note),
      },
    ],
    customer_name: contact.name.trim(),
    customer_phone: contact.phone.trim(),
    customer_email: contact.email.trim(),
    customer_whatsapp: cleanRewardCode(contact.whatsapp),
    method: "momo",
    delivery_zone_id: delivery.zoneId || undefined,
    delivery_address: delivery.address.trim(),
  });
}

function deliveryFeeMinor(
  delivery: DeliveryValues,
  zones: DeliveryZone[] | null,
): number {
  if (delivery.fulfilment !== "delivery") return 0;
  const zone = zones?.find((entry) => entry.zone_id === delivery.zoneId);
  return zone?.fee_minor ?? 0;
}

function canSubmitOrder(
  bandId: string | null,
  contact: ContactFields,
  delivery: DeliveryValues,
  submitting: boolean,
): boolean {
  const contactReady =
    contact.name.trim().length > 1 &&
    contact.phone.trim().length >= 7 &&
    /.+@.+\..+/.test(contact.email.trim());
  const deliveryReady =
    delivery.fulfilment === "pickup" ||
    (Boolean(delivery.zoneId) && delivery.address.trim().length > 4);
  return Boolean(bandId) && contactReady && deliveryReady && !submitting;
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
  const [delivery, setDelivery] = useState<DeliveryValues>({
    fulfilment: "pickup",
    zoneId: "",
    address: "",
  });
  const onDeliveryChange = useCallback(
    (field: keyof DeliveryValues, next: string) =>
      setDelivery((prev) => ({ ...prev, [field]: next })),
    [],
  );
  const { offered: deliveryOffered, zones } = useDeliveryZones(
    store,
    delivery,
    onDeliveryChange,
  );
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  // §3b: the pay moment needs a verified customer session; a session also
  // prefills the contact fields from the profile (web checkout loader).
  const { session, ensureSession } = useCustomerGate(design.handle);
  useContactPrefill(session, setContact);

  // Mirrors the web storefront: when the store has online ordering switched
  // off, show an explanation instead of a form that would 409 on submit.
  if (store.online_ordering_enabled === false) {
    return <DesignOrderingDisabled storeName={store.name} />;
  }

  const selectedBand = design.prices.find((p) => p.size_band_id === bandId);
  const totalMinor =
    (selectedBand?.price_minor ?? 0) + deliveryFeeMinor(delivery, zones);
  const canSubmit = canSubmitOrder(bandId, contact, delivery, submitting);

  const submit = async () => {
    if (!bandId) return;
    // §3b gate: no payment without a verified customer session. Guests are
    // routed to sign in and return here (mirrors web checkout.tsx:46-53).
    if (!(await ensureSession())) return;
    setSubmitting(true);
    setOrderError(null);
    const result =
      delivery.fulfilment === "delivery"
        ? await submitDeliveryOrder(store, design, bandId, contact, delivery)
        : await submitPickupOrder(store, design, bandId, contact, rewards);
    setSubmitting(false);
    if (result.ok) {
      onOrdered(result.data);
      return;
    }
    setOrderError(
      result.status === 0
        ? "Network error — please try again."
        : orderErrorMessage(result.error),
    );
  };

  return (
    <View>
      <Text style={styles.sectionLabel}>Choose a size</Text>
      <DesignSizeBandSelector
        prices={design.prices}
        selectedBandId={bandId}
        onSelect={setBandId}
      />

      {deliveryOffered ? (
        <View>
          <Text style={styles.sectionLabel}>How would you like it?</Text>
          <DesignDeliveryFields
            zones={zones}
            values={delivery}
            onChange={onDeliveryChange}
          />
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Your details</Text>
      <DesignContactFields
        values={contact}
        onChange={(field, next) =>
          setContact((prev) => ({ ...prev, [field]: next }))
        }
      />

      {delivery.fulfilment === "pickup" ? (
        <View>
          <Text style={styles.sectionLabel}>Rewards</Text>
          <DesignRewardFields
            values={rewards}
            onChange={(field, next) =>
              setRewards((prev) => ({ ...prev, [field]: next }))
            }
          />
        </View>
      ) : null}

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
              ? `Place order · ${formatGHS(totalMinor)}`
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
