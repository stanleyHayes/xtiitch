import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

// Entry card to the customer account (OTP sign-in + order history). Same
// pattern as MarketplaceEntry — the wine-tinted card distinguishes the
// personal account lane from the neutral marketplace card above it.
export default function HomeAccountEntry({ onPress }: { onPress: () => void }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.section}>
      <Pressable
        style={({ pressed }) => [styles.accountCard, pressed && styles.cardPressed]}
        onPress={onPress}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.accountKicker}>YOUR ACCOUNT</Text>
          <Text style={styles.accountTitle}>Sign in &amp; your orders</Text>
          <Text style={styles.accountHint}>
            One code by SMS or email — no password. Track every order across
            studios.
          </Text>
        </View>
        <Text style={styles.accountArrow}>›</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: spacing(3),
      marginTop: spacing(3.5),
    },
    accountCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.5),
      backgroundColor: palette.wineTint,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      padding: spacing(2.5),
      ...shadow.card,
    },
    cardPressed: { opacity: 0.85 },
    accountKicker: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    accountTitle: {
      color: palette.ink,
      fontFamily: fonts.display,
      fontSize: 19,
      fontWeight: "700",
      marginTop: spacing(0.5),
    },
    accountHint: {
      color: palette.mutedText,
      fontFamily: fonts.body,
      fontSize: 13,
      marginTop: spacing(0.5),
      lineHeight: 19,
    },
    accountArrow: {
      color: palette.burgundy,
      fontSize: 30,
      fontWeight: "700",
    },
  });
