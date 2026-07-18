import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { formatGHS, type PlaceOrderResult } from "../../../src/api";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type DesignOrderConfirmationProps = {
  order: PlaceOrderResult;
  onTrack: () => void;
};

export default function DesignOrderConfirmation({
  order,
  onTrack,
}: DesignOrderConfirmationProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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
      {order.authorization_url ? (
        <Pressable
          style={styles.cta}
          onPress={() => Linking.openURL(order.authorization_url)}
        >
          <Text style={styles.ctaText}>Pay {formatGHS(order.amount_minor)}</Text>
        </Pressable>
      ) : (
        // No Paystack URL (e.g. nothing to collect) — the web flow redirects
        // straight to tracking, so the primary action does the same here.
        <Pressable style={styles.cta} onPress={onTrack}>
          <Text style={styles.ctaText}>Track this order</Text>
        </Pressable>
      )}
      {order.authorization_url ? (
        <Pressable style={styles.secondaryCta} onPress={onTrack}>
          <Text style={styles.secondaryCtaText}>Track this order</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
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
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
      marginTop: spacing(2.5),
    },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
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
