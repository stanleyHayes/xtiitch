import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../src/api";
import type { Shop, ShopDesign } from "../../../src/marketplaceApi";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { ImageTile } from "../../../src/ui";

type StudioCardProps = {
  shop: Shop;
  onOpenShop: (shop: Shop) => void;
  onOpenDesign: (design: ShopDesign) => void;
};

// Directory card for one shop: banner (or brand swatch), brand-coloured name
// row, design count, and up to three top designs with image and price. The
// card body opens the store; each design tile opens the design directly.
export default function StudioCard({
  shop,
  onOpenShop,
  onOpenDesign,
}: StudioCardProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const brandColor = shop.brand_color || palette.burgundy;
  const topDesigns = shop.designs.slice(0, 3);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onOpenShop(shop)}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <ImageTile
          uri={shop.banner_url || null}
          seed={shop.handle}
          style={styles.banner}
          radiusOverride={0}
        />
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <View style={[styles.brandDot, { backgroundColor: brandColor }]} />
            <Text style={styles.name} numberOfLines={1}>
              {shop.name}
            </Text>
          </View>
          <Text style={styles.count}>
            {shop.design_count} {shop.design_count === 1 ? "design" : "designs"}
          </Text>
        </View>
      </Pressable>
      {topDesigns.length > 0 ? (
        <View style={styles.designsRow}>
          {topDesigns.map((design) => (
            <Pressable
              key={design.handle}
              onPress={() => onOpenDesign(design)}
              style={({ pressed }) => [
                styles.designTile,
                pressed && { opacity: 0.85 },
              ]}
            >
              <ImageTile
                uri={design.image}
                seed={design.handle}
                style={styles.designImage}
                radiusOverride={radius.sm}
              />
              <Text style={styles.designTitle} numberOfLines={1}>
                {design.title}
              </Text>
              <Text style={styles.designPrice}>{formatGHS(design.price_minor)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      overflow: "hidden",
      ...shadow.card,
    },
    banner: { width: "100%", height: 110 },
    body: { padding: spacing(2), paddingBottom: spacing(1.5) },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1),
    },
    brandDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    name: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "700",
      color: palette.ink,
    },
    count: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
    designsRow: {
      flexDirection: "row",
      gap: spacing(1.5),
      paddingHorizontal: spacing(2),
      paddingBottom: spacing(2),
    },
    designTile: { flex: 1 },
    designImage: { width: "100%", height: 72 },
    designTitle: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "600",
      color: palette.ink,
      marginTop: spacing(0.75),
    },
    designPrice: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      color: palette.burgundy,
      marginTop: 2,
    },
  });
