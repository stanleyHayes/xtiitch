import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, type Palette } from "../theme";
import { useTheme } from "../theme-mode";

export function SkeletonBlock({
  width = "100%",
  height = 16,
  radiusOverride = radius.sm,
  style,
}: {
  width?: ViewStyle["width"];
  height?: ViewStyle["height"];
  radiusOverride?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View
      style={[
        styles.skeletonBlock,
        { width, height, borderRadius: radiusOverride },
        style,
      ]}
    />
  );
}

const makeStyles = (_palette: Palette) =>
  StyleSheet.create({
    skeletonBlock: {
      backgroundColor: "rgba(128,0,32,0.11)",
      borderWidth: 1,
      borderColor: "rgba(128,0,32,0.05)",
    },
  });
