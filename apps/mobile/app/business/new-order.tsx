import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../src/auth";
import {
  businessApi,
  type BusinessDesign,
  type SizeBand,
} from "../../src/businessApi";
import { CenterState, ImageTile, LoadingButtonLabel } from "../../src/ui";
import { fonts, palette, radius, spacing } from "../../src/theme";

export default function NewOrderScreen() {
  const router = useRouter();
  const [designs, setDesigns] = useState<BusinessDesign[]>([]);
  const [bands, setBands] = useState<SizeBand[]>([]);
  const [loading, setLoading] = useState(true);

  const [designId, setDesignId] = useState<string | null>(null);
  const [bandId, setBandId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [total, setTotal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toLogin = useCallback(
    () => router.replace("/business/login"),
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then(async (session) => {
        if (!active) return;
        if (!session) {
          toLogin();
          return;
        }
        const [designsResult, bandsResult] = await Promise.all([
          businessApi.designs(),
          businessApi.sizeBands(),
        ]);
        if (!active) return;
        if (
          (!designsResult.ok && designsResult.expired) ||
          (!bandsResult.ok && bandsResult.expired)
        ) {
          toLogin();
          return;
        }
        if (designsResult.ok) setDesigns(designsResult.data.designs);
        if (bandsResult.ok) setBands(bandsResult.data.size_bands);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [toLogin]),
  );

  const canSubmit = Boolean(designId) && name.trim().length > 1 && !submitting;

  const submit = async () => {
    if (!designId) return;
    setSubmitting(true);
    setError(null);
    const minor = total.trim()
      ? Math.round(Number.parseFloat(total) * 100)
      : undefined;
    if (minor !== undefined && (!Number.isFinite(minor) || minor < 0)) {
      setError("Enter a valid agreed total, or leave it blank.");
      setSubmitting(false);
      return;
    }
    const result = await businessApi.createWalkIn({
      design_id: designId,
      size_band_id: bandId ?? undefined,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_email: email.trim(),
      agreed_total_minor: minor,
    });
    setSubmitting(false);
    if (result.ok) {
      router.replace(`/business/order/${result.data.order_id}`);
    } else if (result.expired) {
      toLogin();
    } else {
      setError("Couldn't create the order. Check the details and retry.");
    }
  };

  if (loading) return <CenterState loading />;

  if (designs.length === 0) {
    return (
      <CenterState
        title="No designs yet"
        hint="Add a design to your catalogue before taking a walk-in order."
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionLabel}>Design</Text>
      <View style={styles.designList}>
        {designs.map((design) => {
          const active = design.design_id === designId;
          return (
            <Pressable
              key={design.design_id}
              onPress={() => setDesignId(design.design_id)}
              style={[styles.designCard, active && styles.designCardActive]}
            >
              <ImageTile
                uri={design.images[0]}
                seed={design.handle}
                style={styles.designThumb}
                radiusOverride={radius.sm}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.designTitle} numberOfLines={1}>
                  {design.title}
                </Text>
                <Text style={styles.designStatus}>{design.status}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]} />
            </Pressable>
          );
        })}
      </View>

      {bands.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Size (optional)</Text>
          <View style={styles.bandRow}>
            <Pressable
              onPress={() => setBandId(null)}
              style={[styles.band, bandId === null && styles.bandActive]}
            >
              <Text
                style={[
                  styles.bandText,
                  bandId === null && styles.bandTextActive,
                ]}
              >
                Measurement
              </Text>
            </Pressable>
            {bands.map((band) => {
              const active = band.size_band_id === bandId;
              return (
                <Pressable
                  key={band.size_band_id}
                  onPress={() => setBandId(band.size_band_id)}
                  style={[styles.band, active && styles.bandActive]}
                >
                  <Text
                    style={[styles.bandText, active && styles.bandTextActive]}
                  >
                    {band.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>Customer</Text>
      <View style={styles.form}>
        <Field
          label="Full name"
          value={name}
          onChange={setName}
          placeholder="Esi Mensah"
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
          placeholder="customer@example.com"
          keyboardType="email-address"
        />
        <Field
          label="Agreed total (GH₵, optional)"
          value={total}
          onChange={setTotal}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        {submitting ? (
          <LoadingButtonLabel label="Creating order" />
        ) : (
          <Text style={styles.ctaText}>Create order</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad" | "email-address" | "decimal-pad";
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        autoCorrect={false}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { padding: spacing(3), paddingBottom: spacing(6) },
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
  designList: { gap: spacing(1.25) },
  designCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    backgroundColor: palette.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.softBorder,
    padding: spacing(1.5),
  },
  designCardActive: {
    borderColor: palette.burgundy,
    backgroundColor: "rgba(128,0,32,0.04)",
  },
  designThumb: { width: 52, height: 52 },
  designTitle: { fontFamily: fonts.display, fontSize: 17, color: palette.ink },
  designStatus: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.mutedText,
    textTransform: "capitalize",
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.softBorder,
  },
  radioActive: {
    borderColor: palette.burgundy,
    backgroundColor: palette.burgundy,
  },
  bandRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
  band: {
    borderWidth: 1.5,
    borderColor: palette.softBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    backgroundColor: palette.white,
  },
  bandActive: {
    borderColor: palette.burgundy,
    backgroundColor: "rgba(128,0,32,0.06)",
  },
  bandText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
  },
  bandTextActive: { color: palette.burgundy },
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
    marginTop: spacing(3),
  },
  ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
  ctaText: {
    color: palette.onAccent,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
});
