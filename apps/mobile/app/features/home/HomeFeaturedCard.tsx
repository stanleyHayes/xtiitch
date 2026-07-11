import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  fonts,
  radius,
  shadow,
  spacing,
  swatchFor,
  type Palette,
} from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import type { SponsoredPlacement } from "../../../src/api";

type HomeFeaturedCardProps = {
  placement: SponsoredPlacement;
  onPress: () => void;
};

export default function HomeFeaturedCard({
  placement,
  onPress,
}: HomeFeaturedCardProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [from, to] = swatchFor(placement.business_handle || placement.headline);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.featuredCard, pressed && styles.cardPressed]}
    >
      {placement.image_url ? (
        <Image source={{ uri: placement.image_url }} style={styles.featuredImage} />
      ) : (
        <View style={[styles.featuredImage, { backgroundColor: from }]}>
          <View style={[styles.featuredSwatchAccent, { backgroundColor: to }]} />
        </View>
      )}
      <View style={styles.featuredBody}>
        <Text style={styles.featuredBusiness} numberOfLines={1}>
          {placement.business_name}
        </Text>
        <Text style={styles.featuredHeadline} numberOfLines={2}>
          {placement.headline || placement.target_label}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    featuredCard: {
      width: 220,
      backgroundColor: palette.white,
      borderRadius: radius.md,
      overflow: "hidden",
      ...shadow.card,
    },
    cardPressed: { opacity: 0.85 },
    featuredImage: {
      height: 130,
      width: "100%",
      justifyContent: "flex-end",
    },
    featuredSwatchAccent: { height: 34, width: "55%", opacity: 0.7 },
    featuredBody: { padding: spacing(1.75) },
    featuredBusiness: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: palette.gold,
    },
    featuredHeadline: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: palette.ink,
      marginTop: spacing(0.5),
      lineHeight: 22,
    },
  });
