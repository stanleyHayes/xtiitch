// Shared presentational helpers for the customer screens: a centred
// loading / empty / error state and a brand image-or-swatch tile, so every
// screen handles the three async outcomes the same way.
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { fonts, palette, radius, spacing, swatchFor } from "./theme";

export function CenterState({
  loading,
  title,
  hint,
}: {
  loading?: boolean;
  title?: string;
  hint?: string;
}) {
  return (
    <View style={styles.center}>
      {loading ? (
        <ActivityIndicator size="large" color={palette.burgundy} />
      ) : (
        <>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </>
      )}
    </View>
  );
}

export function ImageTile({
  uri,
  seed,
  style,
  radiusOverride,
}: {
  uri?: string | null;
  seed: string;
  style?: object;
  radiusOverride?: number;
}) {
  const [from, to] = swatchFor(seed);
  const borderRadius = radiusOverride ?? radius.md;
  if (uri) {
    return <Image source={{ uri }} style={[{ borderRadius }, style]} />;
  }
  return (
    <View style={[{ backgroundColor: from, borderRadius }, styles.swatch, style]}>
      <View style={[styles.swatchBar, { backgroundColor: to }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(4),
    gap: spacing(1),
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    textAlign: "center",
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.mutedText,
    textAlign: "center",
    lineHeight: 20,
  },
  swatch: { justifyContent: "flex-end", overflow: "hidden" },
  swatchBar: { height: "32%", width: "60%", opacity: 0.7 },
});
