import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatGHS, type Design } from "../../../src/api";
import { ImageTile } from "../../../src/ui";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

function lowestPriceMinor(design: Design): number | null {
  if (design.prices.length === 0) return null;
  return design.prices.reduce(
    (min, price) => Math.min(min, price.price_minor),
    design.prices[0].price_minor,
  );
}

type StoreDesignGridProps = {
  designs: Design[];
  onOpen: (design: Design) => void;
};

export default function StoreDesignGrid({
  designs,
  onOpen,
}: StoreDesignGridProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  if (designs.length === 0) {
    return (
      <View style={styles.emptyGrid}>
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptyHint}>
          This studio hasn&apos;t published any pieces for this view.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {designs.map((design) => {
        const minor = lowestPriceMinor(design);
        return (
          <Pressable
            key={design.design_id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => onOpen(design)}
          >
            <ImageTile
              uri={design.images[0]}
              seed={design.handle}
              style={styles.cardImage}
              radiusOverride={0}
            />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {design.title}
              </Text>
              <Text style={styles.cardPrice}>
                {minor === null ? "Price on request" : `from ${formatGHS(minor)}`}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const CARD_GAP = spacing(2);

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CARD_GAP,
    },
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
    cardPrice: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.burgundy,
      marginTop: spacing(0.5),
    },
    emptyGrid: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(3),
      alignItems: "center",
    },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: palette.ink,
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(0.75),
      lineHeight: 20,
    },
  });
