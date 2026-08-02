import { useCallback, useMemo, useState } from "react";
import {
  Linking as NativeLinking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import {
  businessBillingApi,
  type Activation,
  type PublicPlan,
} from "../../src/businessBillingApi";
import { formatGHS } from "../../src/api";
import { fonts, radius, shadow, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";

export default function BillingScreen() {
  const { reference } = useLocalSearchParams<{ reference?: string }>();
  const { palette } = useTheme();
  const s = useMemo(() => styles(palette), [palette]);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [activation, setActivation] = useState<Activation | null>(null);
  const [cadence, setCadence] = useState<"quarterly" | "yearly">("yearly");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    if (reference) await businessBillingApi.verify(reference);
    const [p, a] = await Promise.all([
      businessBillingApi.plans(),
      businessBillingApi.activation(),
    ]);
    if (p.ok) setPlans(p.data);
    if (a.ok) setActivation(a.data);
  }, [reference]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const choose = async (plan: PublicPlan) => {
    setBusy(plan.code);
    const callback = ExpoLinking.createURL("business/billing");
    const result = await businessBillingApi.authorizationLink(
      plan.code,
      cadence,
      callback,
    );
    setBusy("");
    if (result.ok && !result.data.activated)
      await NativeLinking.openURL(result.data.redirect_url);
    else if (result.ok) await load();
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: "Plan & billing" }} />
      <View style={s.hero}>
        <Ionicons
          name="sparkles-outline"
          size={145}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>GROW ON YOUR TERMS</Text>
        <Text style={s.title}>
          {activation?.plan_name
            ? `${activation.plan_name} plan`
            : "Plans that fit the studio"}
        </Text>
        <Text style={s.subtitle}>
          {activation?.activated
            ? "Your package is active."
            : activation?.amount_due_minor
              ? `${formatGHS(activation.amount_due_minor)} is due to activate your package.`
              : "Choose a package and renewal rhythm."}
        </Text>
      </View>
      <View style={s.cadence}>
        {(["quarterly", "yearly"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setCadence(item)}
            style={[s.chip, cadence === item && s.chipActive]}
          >
            <Text style={[s.chipText, cadence === item && s.chipTextActive]}>
              {item === "yearly" ? "Yearly · best value" : "Quarterly"}
            </Text>
          </Pressable>
        ))}
      </View>
      {plans.map((plan) => {
        const current = plan.code === activation?.plan_code;
        const amount =
          cadence === "yearly"
            ? plan.yearly_first_minor
            : plan.quarterly_first_minor;
        return (
          <View key={plan.code} style={[s.card, current && s.cardCurrent]}>
            <View style={s.cardTop}>
              <Text style={s.plan}>{plan.name}</Text>
              {current ? <Text style={s.current}>Current</Text> : null}
            </View>
            <Text style={s.price}>{formatGHS(amount)}</Text>
            <Text style={s.hint}>
              {cadence === "yearly" ? "First year" : "First quarter"} ·{" "}
              {(plan.commission_bps / 100).toFixed(1)}% platform fee ·{" "}
              {typeof plan.design_limit !== "number"
                ? "Unlimited"
                : plan.design_limit}{" "}
              designs
            </Text>
            <Pressable
              disabled={busy !== "" || current}
              onPress={() => void choose(plan)}
              style={[s.button, current && s.buttonDisabled]}
            >
              <Text style={s.buttonText}>
                {current
                  ? "Current package"
                  : busy === plan.code
                    ? "Opening Paystack…"
                    : `Choose ${plan.name}`}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = (p: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.cream },
    content: { padding: spacing(3), paddingBottom: spacing(7) },
    hero: {
      backgroundColor: p.burgundyDeep,
      borderRadius: radius.lg,
      overflow: "hidden",
      padding: spacing(2.5),
    },
    watermark: { position: "absolute", right: -15, bottom: -28, opacity: 0.1 },
    eyebrow: {
      color: p.gold,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.8,
    },
    title: {
      color: p.onAccent,
      fontFamily: fonts.display,
      fontSize: 28,
      fontWeight: "800",
      marginTop: spacing(0.75),
    },
    subtitle: {
      color: "rgba(255,255,255,0.68)",
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 21,
      marginTop: spacing(0.75),
    },
    cadence: {
      flexDirection: "row",
      gap: spacing(0.75),
      marginVertical: spacing(2),
    },
    chip: {
      backgroundColor: p.white,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
    },
    chipActive: { backgroundColor: p.burgundy },
    chipText: {
      color: p.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
    },
    chipTextActive: { color: p.onAccent },
    card: {
      backgroundColor: p.white,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing(0.75),
      marginBottom: spacing(1.25),
      padding: spacing(2),
      ...shadow.card,
    },
    cardCurrent: { borderColor: p.burgundy, borderWidth: 2 },
    cardTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    plan: {
      color: p.ink,
      fontFamily: fonts.display,
      fontSize: 21,
      fontWeight: "800",
    },
    current: {
      color: p.burgundy,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    price: {
      color: p.burgundy,
      fontFamily: fonts.display,
      fontSize: 27,
      fontWeight: "900",
    },
    hint: {
      color: p.mutedText,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 18,
    },
    button: {
      alignItems: "center",
      backgroundColor: p.burgundy,
      borderRadius: radius.pill,
      marginTop: spacing(0.75),
      paddingVertical: spacing(1.3),
    },
    buttonDisabled: { opacity: 0.45 },
    buttonText: {
      color: p.onAccent,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
  });
