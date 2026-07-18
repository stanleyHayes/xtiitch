import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Design } from "../../../src/api";
import { ImageTile } from "../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

const DEFAULT_SWATCH_ID = "__default__";

type ColourSwatch = {
  id: string;
  label: string;
  thumb: string | undefined;
  images: string[];
};

// Ports the web storefront's buildSwatches (features/design/gallery.tsx): the
// design's own photos are the default swatch, then each non-default variation
// ordered by sequence. Variations share the price and order flow; only the
// gallery images differ.
function buildSwatches(design: Design): ColourSwatch[] {
  const base: ColourSwatch = {
    id: DEFAULT_SWATCH_ID,
    label: "Original",
    thumb: design.images[0],
    images: design.images,
  };
  const variations = (design.variations ?? [])
    .filter((variation) => !variation.is_default)
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((variation) => ({
      id: variation.variation_id,
      label: variation.name,
      thumb: variation.images[0] ?? design.images[0],
      images: variation.images.length > 0 ? variation.images : design.images,
    }));
  return [base, ...variations];
}

type DesignGalleryProps = {
  design: Design;
};

export default function DesignGallery({ design }: DesignGalleryProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const swatches = useMemo(() => buildSwatches(design), [design]);
  const [activeSwatchId, setActiveSwatchId] = useState(DEFAULT_SWATCH_ID);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const activeSwatch =
    swatches.find((swatch) => swatch.id === activeSwatchId) ?? swatches[0];
  const images = activeSwatch.images;
  const heroIndex = Math.min(activeImageIndex, Math.max(images.length - 1, 0));

  const selectSwatch = (id: string) => {
    setActiveSwatchId(id);
    setActiveImageIndex(0);
  };

  return (
    <View>
      <ImageTile
        uri={images[heroIndex]}
        seed={`${design.handle}-${activeSwatch.id}-${heroIndex}`}
        style={styles.hero}
        radiusOverride={radius.lg}
      />
      {images.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbRow}
        >
          {images.map((uri, index) => (
            <Pressable
              key={`${uri}-${index}`}
              onPress={() => setActiveImageIndex(index)}
              style={[
                styles.thumbFrame,
                index === heroIndex && styles.thumbFrameActive,
              ]}
            >
              <ImageTile
                uri={uri}
                seed={`${design.handle}-thumb-${index}`}
                style={styles.thumb}
                radiusOverride={radius.sm}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {swatches.length > 1 ? (
        <View style={styles.swatchSection}>
          <Text style={styles.swatchLabel}>Colour variations</Text>
          <View style={styles.swatchRow}>
            {swatches.map((swatch) => {
              const active = swatch.id === activeSwatch.id;
              return (
                <Pressable
                  key={swatch.id}
                  onPress={() => selectSwatch(swatch.id)}
                  style={[styles.swatch, active && styles.swatchActive]}
                >
                  <ImageTile
                    uri={swatch.thumb}
                    seed={`${design.handle}-swatch-${swatch.id}`}
                    style={styles.swatchThumb}
                    radiusOverride={radius.sm}
                  />
                  <Text
                    style={[
                      styles.swatchName,
                      active && styles.swatchNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {swatch.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    hero: { width: "100%", height: 280 },
    thumbRow: { gap: spacing(1), marginTop: spacing(1.25) },
    thumbFrame: {
      borderWidth: 2,
      borderColor: "transparent",
      borderRadius: radius.sm + 2,
    },
    thumbFrameActive: { borderColor: palette.burgundy },
    thumb: { width: 64, height: 64 },
    swatchSection: { marginTop: spacing(2) },
    swatchLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
      color: palette.ink,
      marginBottom: spacing(1),
    },
    swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1.25) },
    swatch: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      padding: spacing(0.75),
      backgroundColor: palette.white,
      alignItems: "center",
      width: 84,
    },
    swatchActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    swatchThumb: { width: 56, height: 56 },
    swatchName: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "700",
      color: palette.ink,
      marginTop: spacing(0.75),
    },
    swatchNameActive: { color: palette.burgundy },
  });
