import { useCallback, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { loadSession } from "../../src/auth";
import type { MeasurementField } from "../../src/api";
import {
  businessApi,
  type BusinessDesign,
  type SizeBand,
} from "../../src/businessApi";
import { CenterState, LoadingButtonLabel } from "../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { DesignPicker } from "../features/business/new-order/DesignPicker";
import { Field } from "../features/business/new-order/Field";
import { MeasurementInputs } from "../features/business/new-order/MeasurementInputs";
import {
  OrderTypeToggle,
  type NewOrderType,
} from "../features/business/new-order/OrderTypeToggle";

// eslint-disable-next-line max-lines-per-function -- complete walk-in order workspace
export default function NewOrderScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [designs, setDesigns] = useState<BusinessDesign[]>([]);
  const [bands, setBands] = useState<SizeBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [orderType, setOrderType] = useState<NewOrderType>("ready");
  const [designId, setDesignId] = useState<string | null>(null);
  const [bandId, setBandId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [total, setTotal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bespoke-only: the studio's measurement template (null = not loaded yet)
  // and the values keyed by field_id.
  const [measureFields, setMeasureFields] = useState<MeasurementField[] | null>(
    null,
  );
  const [measureLoading, setMeasureLoading] = useState(false);
  const [measureError, setMeasureError] = useState(false);
  const [measureValues, setMeasureValues] = useState<Record<string, string>>(
    {},
  );

  const toLogin = useCallback(
    () => router.replace("/business/login"),
    [router],
  );

  // Only active designs can take a walk-in order (web WalkInOrderPanel.tsx).
  const loadCatalogue = useCallback(async () => {
    const [designsResult, bandsResult] = await Promise.all([
      businessApi.designs(),
      businessApi.sizeBands(),
    ]);
    if (
      (!designsResult.ok && designsResult.expired) ||
      (!bandsResult.ok && bandsResult.expired)
    ) {
      toLogin();
      return;
    }
    if (!designsResult.ok) {
      setFetchError(true);
      return;
    }
    setFetchError(false);
    setDesigns(
      designsResult.data.designs.filter((design) => design.status === "active"),
    );
    if (bandsResult.ok) setBands(bandsResult.data.size_bands);
  }, [toLogin]);

  // The measurement template is only needed for bespoke orders, so it loads
  // lazily the first time the toggle flips to Bespoke.
  const loadMeasurements = useCallback(async () => {
    setMeasureLoading(true);
    setMeasureError(false);
    const result = await businessApi.measurementFields();
    setMeasureLoading(false);
    if (!result.ok && result.expired) {
      toLogin();
      return;
    }
    if (!result.ok) {
      setMeasureError(true);
      return;
    }
    setMeasureFields(result.data.fields);
  }, [toLogin]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSession().then(async (session) => {
        if (!active) return;
        if (!session) {
          toLogin();
          return;
        }
        await loadCatalogue();
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [loadCatalogue, toLogin]),
  );

  const retry = () => {
    setLoading(true);
    void loadCatalogue().finally(() => setLoading(false));
  };

  const selectOrderType = (next: NewOrderType) => {
    setOrderType(next);
    setError(null);
    if (next === "bespoke" && measureFields === null && !measureLoading) {
      void loadMeasurements();
    }
  };

  const canSubmit = Boolean(designId) && name.trim().length > 1 && !submitting;

  const submitBespoke = async () => {
    if (!designId) return;
    setSubmitting(true);
    setError(null);
    // Drop empty values — the API only accepts template field IDs, and an
    // empty map is fine (no minimum for on-the-spot capture here).
    const measurements: Record<string, string> = {};
    for (const [fieldId, value] of Object.entries(measureValues)) {
      const trimmed = value.trim();
      if (trimmed) measurements[fieldId] = trimmed;
    }
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const result = await businessApi.createCustomWalkIn({
      design_id: designId,
      customer_name: name.trim(),
      ...(trimmedPhone ? { customer_phone: trimmedPhone } : {}),
      ...(trimmedEmail ? { customer_email: trimmedEmail } : {}),
      measurements,
    });
    setSubmitting(false);
    if (result.ok) {
      router.replace(`/business/order/${result.data.order_id}`);
    } else if (result.expired) {
      toLogin();
    } else if (result.error === "upstream_409") {
      // 409 order_not_advanceable — no bespoke stage seeded for the studio.
      setError("Bespoke stages are not configured for this studio yet.");
    } else {
      setError("Couldn't create the order. Check the details and retry.");
    }
  };

  const submit = async () => {
    if (!designId) return;
    if (orderType === "bespoke") {
      await submitBespoke();
      return;
    }
    setSubmitting(true);
    setError(null);
    const parsed = total.trim()
      ? Math.round(Number.parseFloat(total) * 100)
      : undefined;
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Enter a valid agreed total, or leave it blank.");
      setSubmitting(false);
      return;
    }
    // Web parseMoneyMinor normalizes ≤0 to "no total yet"; the API 400s a zero
    // agreed total, so send undefined instead.
    const minor = parsed !== undefined && parsed > 0 ? parsed : undefined;
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

  if (fetchError) {
    return (
      <CenterState
        title="Couldn't load your catalogue"
        hint="Check your connection and try again."
        onRetry={retry}
      />
    );
  }

  if (designs.length === 0) {
    return (
      <CenterState
        title="No designs yet"
        hint="Add an active design to your catalogue before taking a walk-in order."
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionLabel}>Order type</Text>
      <OrderTypeToggle value={orderType} onChange={selectOrderType} />

      <Text style={styles.sectionLabel}>Design</Text>
      <DesignPicker
        designs={designs}
        designId={designId}
        onSelect={setDesignId}
      />

      {orderType === "ready" && bands.length > 0 ? (
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

      {orderType === "bespoke" ? (
        <MeasurementInputs
          fields={measureFields}
          loading={measureLoading}
          error={measureError}
          onRetry={() => void loadMeasurements()}
          values={measureValues}
          onChange={(fieldId, next) =>
            setMeasureValues((prev) => ({ ...prev, [fieldId]: next }))
          }
        />
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
        {orderType === "ready" ? (
          <Field
            label="Agreed total (GH₵, optional)"
            value={total}
            onChange={setTotal}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        ) : null}
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

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
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
      backgroundColor: palette.wineTint,
    },
    bandText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    bandTextActive: { color: palette.burgundy },
    form: { gap: spacing(1.75) },
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
    ctaDisabled: { backgroundColor: palette.mauve },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
  });
