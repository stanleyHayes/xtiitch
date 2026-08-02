import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import {
  registerBusiness,
  signupPlans,
  storeHandleAvailable,
  type SignupPlan,
} from "../../src/business-onboarding";
import { formatGHS } from "../../src/api";
import { useTheme } from "../../src/theme-mode";
import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { LoadingButtonLabel } from "../../src/ui";

// eslint-disable-next-line max-lines-per-function -- one native onboarding form keeps validation and submission state together.
export default function BusinessRegisterScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [plans, setPlans] = useState<SignupPlan[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [handle, setHandle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState("free");
  const [affiliateCode, setAffiliateCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void signupPlans().then((items) => {
      setPlans(items);
      if (items.length && !items.some((item) => item.code === "free"))
        setPlan(items[0].code);
    });
  }, []);

  const normalizedHandle = handle.trim().toLowerCase();
  const valid =
    businessName.trim().length > 1 &&
    /^[a-z0-9-]{2,}$/.test(normalizedHandle) &&
    ownerName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 8;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    if (!(await storeHandleAvailable(normalizedHandle))) {
      setError("That handle is unavailable. Try a different store handle.");
      setBusy(false);
      return;
    }
    const result = await registerBusiness({
      business_name: businessName.trim(),
      business_handle: normalizedHandle,
      owner_display_name: ownerName.trim(),
      owner_email: email.trim().toLowerCase(),
      owner_password: password,
      plan_code: plan,
      affiliate_code: affiliateCode.trim().toUpperCase(),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.replace("/business");
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Create your store" }} />
      <Text style={styles.eyebrow}>START YOUR STUDIO</Text>
      <Text style={styles.title}>Your storefront, from the first stitch.</Text>
      <Text style={styles.lead}>
        Create the owner account now. Add phone verification, payout details,
        and catalogue imagery from your studio desk.
      </Text>
      <View style={styles.form}>
        <Field
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Kente Atelier"
          styles={styles}
        />
        <Field
          label="Store handle"
          value={handle}
          onChangeText={(value) =>
            setHandle(value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          placeholder="kente-atelier"
          styles={styles}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          {normalizedHandle || "your-handle"}.xtiitch.com
        </Text>
        <Field
          label="Your name"
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="Ama Boateng"
          styles={styles}
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="ama@atelier.com"
          styles={styles}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          styles={styles}
          secureTextEntry
        />
        {plans.length ? (
          <View>
            <Text style={styles.label}>Plan</Text>
            <View style={styles.planList}>
              {plans.map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => setPlan(item.code)}
                  style={[
                    styles.plan,
                    plan === item.code && styles.planSelected,
                  ]}
                >
                  <View>
                    <Text style={styles.planName}>{item.name}</Text>
                    <Text style={styles.hint}>
                      {item.commission_bps / 100}% sales fee
                    </Text>
                  </View>
                  <Text style={styles.planPrice}>
                    {item.monthly_fee_minor
                      ? `${formatGHS(item.monthly_fee_minor)}/mo`
                      : "Free"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <Field
          label="Affiliate code (optional)"
          value={affiliateCode}
          onChangeText={setAffiliateCode}
          placeholder="CREATOR-CODE"
          styles={styles}
          autoCapitalize="characters"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={!valid || busy}
          onPress={submit}
          style={[styles.cta, (!valid || busy) && styles.disabled]}
        >
          {busy ? (
            <LoadingButtonLabel label="Creating store" />
          ) : (
            <Text style={styles.ctaText}>Create store</Text>
          )}
        </Pressable>
        <Pressable onPress={() => router.replace("/business/login")}>
          <Text style={styles.link}>Already have a store? Sign in</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  styles,
  ...props
}: {
  label: string;
  styles: ReturnType<typeof makeStyles>;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
      />
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.cream },
    content: { padding: spacing(3), paddingBottom: spacing(7) },
    eyebrow: {
      color: p.burgundy,
      fontFamily: fonts.body,
      fontWeight: "900",
      letterSpacing: 1.6,
      fontSize: 12,
    },
    title: {
      marginTop: spacing(1.5),
      color: p.ink,
      fontFamily: fonts.display,
      fontWeight: "800",
      fontSize: 36,
      lineHeight: 38,
    },
    lead: {
      marginTop: spacing(2),
      color: p.mutedText,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 23,
    },
    form: { marginTop: spacing(3), gap: spacing(2) },
    field: { gap: spacing(0.75) },
    label: {
      color: p.ink,
      fontFamily: fonts.body,
      fontWeight: "800",
      fontSize: 13,
    },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: p.softBorder,
      backgroundColor: p.panel,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      color: p.ink,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    placeholder: { color: p.mutedText },
    hint: { color: p.mutedText, fontFamily: fonts.body, fontSize: 12 },
    planList: { gap: spacing(1) },
    plan: {
      borderWidth: 1,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      padding: spacing(2),
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: p.panel,
    },
    planSelected: { borderColor: p.burgundy, backgroundColor: p.wineTint },
    planName: { color: p.ink, fontFamily: fonts.body, fontWeight: "800" },
    planPrice: { color: p.burgundy, fontFamily: fonts.body, fontWeight: "900" },
    cta: {
      minHeight: 54,
      borderRadius: radius.pill,
      backgroundColor: p.burgundy,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.45 },
    ctaText: { color: p.onAccent, fontFamily: fonts.body, fontWeight: "900" },
    error: { color: p.danger, fontFamily: fonts.body, fontSize: 14 },
    link: {
      textAlign: "center",
      color: p.burgundy,
      fontFamily: fonts.body,
      fontWeight: "800",
      padding: spacing(1),
    },
  });
