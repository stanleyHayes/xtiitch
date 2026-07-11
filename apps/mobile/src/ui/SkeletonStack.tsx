import { useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { spacing, type Palette } from "../theme";
import { useTheme } from "../theme-mode";
import { SkeletonBlock } from "./SkeletonBlock";

export function SkeletonStack({ rows = 3 }: { rows?: number }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const widths: ViewStyle["width"][] = ["82%", "100%", "64%", "90%"];
  return (
    <View style={styles.skeletonStack} accessibilityLabel="Loading section">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock
          key={`skeleton-${index}`}
          width={widths[index % widths.length]}
          height={index === 0 ? 18 : 13}
        />
      ))}
    </View>
  );
}

const makeStyles = (_palette: Palette) =>
  StyleSheet.create({
    skeletonStack: {
      width: "100%",
      gap: spacing(1),
    },
  });
