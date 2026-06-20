import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  api,
  formatGHS,
  type Design,
  type PlaceOrderResult,
} from "../../src/api";
import { CenterState, ImageTile } from "../../src/ui";
import { fonts, palette, radius, shadow, spacing } from "../../src/theme";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; design: Design };

type Method = "momo" | "card";

function cleanRewardCode(value: string): string | undefined {
  const code = value.trim();
  return code.length > 0 ? code : undefined;
}

export default function DesignScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const [bandId, setBandId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<Method>("momo");
  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [affiliateCode, setAffiliateCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [order, setOrder] = useState<PlaceOrderResult | null>(null);

  const load = useCallback(async () => {
    if (!handle) return;
    setState({ phase: "loading" });
    const result = await api.design(handle);
    if (result.ok) {
      setState({ phase: "ready", design: result.data });
      setBandId(result.data.prices[0]?.size_band_id ?? null);
    } else {
      setState({
        phase: "error",
        message:
          result.status === 404
            ? "This piece is no longer available."
            : "Couldn't load this piece. Please retry.",
      });
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.phase === "loading") return <CenterState loading />;
  if (state.phase === "error")
    return <CenterState title="Unavailable" hint={state.message} />;

  const { design } = state;
  const store = design.store;
  const selectedBand = design.prices.find((p) => p.size_band_id === bandId);

  const canSubmit =
    Boolean(store?.handle) &&
    Boolean(bandId) &&
    name.trim().length > 1 &&
    phone.trim().length >= 7 &&
    /.+@.+\..+/.test(email.trim()) &&
    !submitting;

  const submit = async () => {
    if (!store?.handle || !bandId) return;
    setSubmitting(true);
    setOrderError(null);
    const result = await api.placeOrder(store.handle, {
      design_handle: design.handle,
      size_band_id: bandId,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_email: email.trim(),
      method,
      promo_code: cleanRewardCode(promoCode),
      referral_code: cleanRewardCode(referralCode),
      affiliate_code: cleanRewardCode(affiliateCode),
    });
    setSubmitting(false);
    if (result.ok) {
      setOrder(result.data);
    } else {
      setOrderError(
        result.status === 0
          ? "Network error — please try again."
          : `Couldn't place the order (${result.error}).`,
      );
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: design.title }} />

      <ImageTile
        uri={design.images[0]}
        seed={design.handle}
        style={styles.hero}
        radiusOverride={radius.lg}
      />

      <Text style={styles.title}>{design.title}</Text>
      {store ? (
        <Pressable onPress={() => router.push(`/store/${store.handle}`)}>
          <Text style={styles.storeLink}>{store.name} ›</Text>
        </Pressable>
      ) : null}
      {design.description ? (
        <Text style={styles.description}>{design.description}</Text>
      ) : null}

      {order ? (
        <OrderConfirmation
          order={order}
          onTrack={() => router.push(`/track/${order.order_id}`)}
        />
      ) : (
        <>
          <Text style={styles.sectionLabel}>Choose a size</Text>
          <View style={styles.bandRow}>
            {design.prices.length === 0 ? (
              <Text style={styles.muted}>
                No public pricing — contact the studio.
              </Text>
            ) : (
              design.prices.map((band) => {
                const active = band.size_band_id === bandId;
                return (
                  <Pressable
                    key={band.size_band_id}
                    onPress={() => setBandId(band.size_band_id)}
                    style={[styles.band, active && styles.bandActive]}
                  >
                    <Text
                      style={[
                        styles.bandLabel,
                        active && styles.bandLabelActive,
                      ]}
                    >
                      {band.label}
                    </Text>
                    <Text
                      style={[
                        styles.bandPrice,
                        active && styles.bandLabelActive,
                      ]}
                    >
                      {formatGHS(band.price_minor)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <Text style={styles.sectionLabel}>Your details</Text>
          <View style={styles.form}>
            <Field
              label="Full name"
              value={name}
              onChange={setName}
              placeholder="Ama Mensah"
            />
            <Field
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+233 50 123 4567"
              keyboardType="phone-pad"
            />
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
            />
          </View>

          <Text style={styles.sectionLabel}>Rewards</Text>
          <View style={styles.form}>
            <Field
              label="Promo code"
              value={promoCode}
              onChange={setPromoCode}
              placeholder="WELCOME10"
              autoCapitalize="characters"
            />
            <Field
              label="Referral code"
              value={referralCode}
              onChange={setReferralCode}
              placeholder="AMA-REF"
              autoCapitalize="characters"
            />
            <Field
              label="Affiliate code"
              value={affiliateCode}
              onChange={setAffiliateCode}
              placeholder="PARTNER"
              autoCapitalize="characters"
            />
            <Text style={styles.rewardHint}>
              Codes are checked at checkout and only apply when the studio or
              platform has an active rule.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Payment</Text>
          <View style={styles.form}>
            <View style={styles.methodRow}>
              {(["momo", "card"] as Method[]).map((option) => {
                const active = method === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setMethod(option)}
                    style={[styles.method, active && styles.methodActive]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        active && styles.methodTextActive,
                      ]}
                    >
                      {option === "momo" ? "Mobile money" : "Card"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

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
            You'll be sent to Paystack to pay securely. Xtiitch never holds your
            funds.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        autoCapitalize={
          autoCapitalize ?? (keyboardType === "email-address" ? "none" : "words")
        }
        autoCorrect={false}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function OrderConfirmation({
  order,
  onTrack,
}: {
  order: PlaceOrderResult;
  onTrack: () => void;
}) {
  return (
    <View style={styles.confirm}>
      <Text style={styles.confirmTitle}>Order placed</Text>
      <Text style={styles.confirmBody}>
        Reference {order.reference} · {formatGHS(order.amount_minor)} due.
      </Text>
      {order.discount_minor && order.discount_minor > 0 ? (
        <Text style={styles.discountApplied}>
          Reward applied: {formatGHS(order.discount_minor)} off this order.
        </Text>
      ) : null}
      <Pressable
        style={styles.cta}
        onPress={() => Linking.openURL(order.authorization_url)}
      >
        <Text style={styles.ctaText}>Pay {formatGHS(order.amount_minor)}</Text>
      </Pressable>
      <Pressable style={styles.secondaryCta} onPress={onTrack}>
        <Text style={styles.secondaryCtaText}>Track this order</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing(3), paddingBottom: spacing(6) },
  hero: { width: "100%", height: 280 },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: palette.ink,
    fontWeight: "700",
    marginTop: spacing(2),
  },
  storeLink: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    color: palette.burgundy,
    marginTop: spacing(0.5),
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
    lineHeight: 23,
    marginTop: spacing(1.5),
  },
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
  muted: { fontFamily: fonts.body, fontSize: 14, color: palette.mutedText },
  bandRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.25) },
  band: {
    borderWidth: 1.5,
    borderColor: palette.softBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.25),
    backgroundColor: palette.white,
    minWidth: 96,
  },
  bandActive: {
    borderColor: palette.burgundy,
    backgroundColor: "rgba(128,0,32,0.06)",
  },
  bandLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
  },
  bandLabelActive: { color: palette.burgundy },
  bandPrice: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.mutedText,
    marginTop: 2,
  },
  form: { gap: spacing(1.75) },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: spacing(0.75),
  },
  input: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.softBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.75),
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
  },
  rewardHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.mutedText,
    lineHeight: 18,
  },
  methodRow: { flexDirection: "row", gap: spacing(1.25) },
  method: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: palette.softBorder,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    alignItems: "center",
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
    color: palette.white,
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
  confirm: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
    ...shadow.card,
  },
  confirmTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: palette.success,
    fontWeight: "700",
  },
  confirmBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
    marginTop: spacing(1),
    lineHeight: 22,
  },
  discountApplied: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "800",
    color: palette.success,
    marginTop: spacing(1),
  },
  secondaryCta: {
    borderWidth: 1.5,
    borderColor: palette.burgundy,
    borderRadius: radius.pill,
    paddingVertical: spacing(1.75),
    alignItems: "center",
    marginTop: spacing(1.25),
  },
  secondaryCtaText: {
    color: palette.burgundy,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "800",
  },
});
