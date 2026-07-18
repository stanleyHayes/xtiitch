import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";

import { XtiitchMark } from "../../../src/ui";
import { fonts, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

const XTIITCH_URL = "https://xtiitch.com";

// The "Powered by Xtiitch" badge at the foot of a storefront — shown unless the
// plan entitlement explicitly removes it (web: features/storefront/powered-by-
// badge.tsx). Deliberately quiet: a footer credit, not an advert.
export default function StorePoweredByBadge({ brand }: { brand: string }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <Pressable
      onPress={() => Linking.openURL(XTIITCH_URL)}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.7 }]}
      accessibilityRole="link"
    >
      <XtiitchMark color={brand} size={14} />
      <Text style={styles.text}>Powered by Xtiitch</Text>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing(0.75),
      borderTopWidth: 1,
      borderTopColor: palette.softBorder,
      marginTop: spacing(4),
      paddingTop: spacing(2.5),
      paddingBottom: spacing(1),
    },
    text: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      color: palette.mutedText,
    },
  });
