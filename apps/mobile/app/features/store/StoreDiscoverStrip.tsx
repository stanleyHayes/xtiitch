import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type StoreDiscoverStripProps = {
  onExplore: () => void;
};

// "Discover other studios" footer — free-plan storefronts carry this
// cross-promotion (web: store-view.tsx gates it on plan_code === "free").
// Mobile has no marketplace directory yet, so it routes back to home.
export default function StoreDiscoverStrip({
  onExplore,
}: StoreDiscoverStripProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.strip}>
      <Text style={styles.title}>Discover other studios</Text>
      <Text style={styles.hint}>
        More Ghanaian fashion houses are on Xtiitch — browse featured studios
        from the home screen.
      </Text>
      <Pressable
        onPress={onExplore}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.ctaText}>Explore studios</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    strip: {
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      padding: spacing(2.5),
      marginTop: spacing(4),
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "700",
      color: palette.ink,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
      marginTop: spacing(0.75),
    },
    cta: {
      alignSelf: "flex-start",
      borderWidth: 1.5,
      borderColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2.5),
      paddingVertical: spacing(1.25),
      marginTop: spacing(1.75),
    },
    ctaText: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
  });
