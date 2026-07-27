import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  checkoutSupport,
  referralRewardLabel,
} from "../../../src/checkoutSupport";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignField from "./DesignField";

export type RewardFieldValues = {
  promoCode: string;
  referralCode: string;
  affiliateCode: string;
};

type ReferralFeedback = {
  tone: "success" | "danger";
  text: string;
};

type DesignRewardFieldsProps = {
  values: RewardFieldValues;
  onChange: (field: keyof RewardFieldValues, next: string) => void;
  // Home-visit bookings have no promo route in the API, so that form hides the
  // promo field (the web does the same via includePromo).
  includePromo?: boolean;
};

export default function DesignRewardFields({
  values,
  onChange,
  includePromo = true,
}: DesignRewardFieldsProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [referralFeedback, setReferralFeedback] =
    useState<ReferralFeedback | null>(null);

  // Any edit to the code drops the previous verdict until it is re-applied.
  useEffect(() => {
    setReferralFeedback(null);
  }, [values.referralCode]);

  // Validates the referral code only — submission with the order is unchanged.
  // Network errors stay silent; only a definitive not-found/inactive verdict is
  // shown as invalid.
  const applyReferral = async () => {
    const code = values.referralCode.trim();
    if (!code || checkingReferral) return;
    setCheckingReferral(true);
    const result = await checkoutSupport.referral(code);
    setCheckingReferral(false);
    if (!result.ok) {
      if (result.error === "referral_not_found") {
        setReferralFeedback({
          tone: "danger",
          text: "That referral code is not valid.",
        });
      }
      return;
    }
    if (result.data.status !== "active") {
      setReferralFeedback({
        tone: "danger",
        text: "That referral code is not valid.",
      });
      return;
    }
    setReferralFeedback({
      tone: "success",
      text: referralRewardLabel(result.data),
    });
  };

  return (
    <View style={styles.form}>
      {includePromo ? (
        <DesignField
          label="Promo code"
          value={values.promoCode}
          onChange={(next) => onChange("promoCode", next)}
          placeholder="WELCOME10"
          autoCapitalize="characters"
        />
      ) : null}
      <View>
        <DesignField
          label="Referral code"
          value={values.referralCode}
          onChange={(next) => onChange("referralCode", next)}
          placeholder="AMA-REF"
          autoCapitalize="characters"
        />
        {values.referralCode.trim().length > 0 ? (
          <Pressable
            onPress={applyReferral}
            disabled={checkingReferral}
            style={styles.applyButton}
            hitSlop={8}
          >
            <Text style={styles.applyText}>
              {checkingReferral ? "Checking…" : "Apply"}
            </Text>
          </Pressable>
        ) : null}
        {referralFeedback ? (
          <Text
            style={[
              styles.referralFeedback,
              referralFeedback.tone === "success"
                ? styles.referralSuccess
                : styles.referralDanger,
            ]}
          >
            {referralFeedback.text}
          </Text>
        ) : null}
      </View>
      <DesignField
        label="Affiliate code"
        value={values.affiliateCode}
        onChange={(next) => onChange("affiliateCode", next)}
        placeholder="PARTNER"
        autoCapitalize="characters"
      />
      <Text style={styles.rewardHint}>
        Codes are checked at checkout and only apply when the studio or platform
        has an active rule.
      </Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    form: { gap: spacing(1.75) },
    applyButton: {
      alignSelf: "flex-end",
      borderWidth: 1.5,
      borderColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(0.75),
      marginTop: spacing(1),
    },
    applyText: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
    },
    referralFeedback: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 19,
      marginTop: spacing(1),
    },
    referralSuccess: { color: palette.success },
    referralDanger: { color: palette.danger },
    rewardHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      lineHeight: 18,
    },
  });
