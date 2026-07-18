import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import type { Collection } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type StoreCollectionsStripProps = {
  collections: Collection[];
  brandColor: string;
  selectedId: string | null;
  onSelect: (collectionId: string | null) => void;
};

// Horizontal "shop by collection" chips. Selecting a chip filters the design
// grid to that collection; "All" clears the filter.
export default function StoreCollectionsStrip({
  collections,
  brandColor,
  selectedId,
  onSelect,
}: StoreCollectionsStripProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const ordered = [...collections].sort((a, b) => a.sequence - b.sequence);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
    >
      <Pressable
        onPress={() => onSelect(null)}
        style={[
          styles.chip,
          selectedId === null && { borderColor: brandColor },
        ]}
      >
        <Text
          style={[styles.chipText, selectedId === null && { color: brandColor }]}
        >
          All
        </Text>
      </Pressable>
      {ordered.map((collection) => {
        const active = collection.collection_id === selectedId;
        return (
          <Pressable
            key={collection.collection_id}
            onPress={() => onSelect(active ? null : collection.collection_id)}
            style={[styles.chip, active && { borderColor: brandColor }]}
          >
            <Text style={[styles.chipText, active && { color: brandColor }]}>
              {collection.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    strip: { marginBottom: spacing(2.5) },
    stripContent: { gap: spacing(1.25), paddingRight: spacing(3) },
    chip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      backgroundColor: palette.white,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
  });
