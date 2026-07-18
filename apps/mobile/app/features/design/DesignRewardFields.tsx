import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignField from "./DesignField";

export type RewardFieldValues = {
  promoCode: string;
  referralCode: string;
  affiliateCode: string;
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
      <DesignField
        label="Referral code"
        value={values.referralCode}
        onChange={(next) => onChange("referralCode", next)}
        placeholder="AMA-REF"
        autoCapitalize="characters"
      />
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
    rewardHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      lineHeight: 18,
    },
  });
