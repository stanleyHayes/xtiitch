import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../src/api";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { ImageTile } from "../../../src/ui";
import type { FlatDesign } from "./marketplaceUtils";

type MarketplaceDesignCardProps = {
  design: FlatDesign;
  onOpen: (design: FlatDesign) => void;
};

// Two-up grid card for the designs tab, matching StoreDesignGrid's shape but
// carrying the shop name so a design is attributable across stores.
export default function MarketplaceDesignCard({
  design,
  onOpen,
}: MarketplaceDesignCardProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => onOpen(design)}
    >
      <ImageTile
        uri={design.image}
        seed={design.handle}
        style={styles.cardImage}
        radiusOverride={0}
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {design.title}
        </Text>
        <Text style={styles.cardStore} numberOfLines={1}>
          {design.store_name}
        </Text>
        <Text style={styles.cardPrice}>{formatGHS(design.price_minor)}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      flexGrow: 1,
      flexBasis: "46%",
      maxWidth: "48%",
      backgroundColor: palette.white,
      borderRadius: radius.md,
      overflow: "hidden",
      ...shadow.card,
    },
    cardImage: { width: "100%", height: 150 },
    cardBody: { padding: spacing(1.5) },
    cardTitle: {
      fontFamily: fonts.display,
      fontSize: 16,
      color: palette.ink,
      lineHeight: 21,
    },
    cardStore: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
    cardPrice: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.burgundy,
      marginTop: spacing(0.5),
    },
  });
