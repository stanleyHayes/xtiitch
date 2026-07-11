import { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { radius, type Palette } from "../theme";
import { swatchFor } from "../theme";
import { useTheme } from "../theme-mode";

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
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
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

const makeStyles = (_palette: Palette) =>
  StyleSheet.create({
    swatch: { justifyContent: "flex-end", overflow: "hidden" },
    swatchBar: { height: "32%", width: "60%", opacity: 0.7 },
  });
