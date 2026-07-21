import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

// "XCreativs" is the name that appears at payment, which is unfamiliar to a
// shopper who only knows Xtiitch — say so here, at the moment of payment, so it
// reads as expected rather than as a wrong charge. Copy ports the web
// storefront's XCreativsPaymentNotice (components/xcreativs-payment-notice.tsx).
export default function DesignPaymentNotice() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.notice}>
      <Text style={styles.text}>
        Payments show as <Text style={styles.strong}>XCreativs</Text>, not
        Xtiitch. Xtiitch is a product of XCreativs Technologies, which
        handles all payments and legals for Xtiitch — so{" "}
        <Text style={styles.strong}>XCreativs</Text> is the name you&apos;ll see
        while paying and on your statement.
      </Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    notice: {
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.sm,
      backgroundColor: palette.panel,
      padding: spacing(1.5),
    },
    text: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      lineHeight: 18,
    },
    strong: { fontWeight: "800", color: palette.ink },
  });
