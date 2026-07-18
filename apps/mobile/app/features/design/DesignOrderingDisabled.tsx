import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type DesignOrderingDisabledProps = {
  storeName?: string;
};

// Shown in place of the order form when the store has online ordering switched
// off — mirrors the web storefront's standard-order panel notice so the shopper
// gets an explanation instead of a form that would 409 on submit.
export default function DesignOrderingDisabled({
  storeName,
}: DesignOrderingDisabledProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Online ordering is off</Text>
      <Text style={styles.body}>
        {storeName ?? "This shop"} isn&apos;t taking online orders here yet —
        reach out to the shop directly to place an order.
      </Text>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    panel: {
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      backgroundColor: palette.panel,
      padding: spacing(2.5),
      marginTop: spacing(3),
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 17,
      fontWeight: "700",
      color: palette.ink,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
      marginTop: spacing(0.75),
    },
  });
