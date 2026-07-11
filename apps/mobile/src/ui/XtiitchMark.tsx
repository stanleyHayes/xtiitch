import { View } from "react-native";

// The ii-stitch brand mark (two dots over two columns) approximated with Views,
// since react-native-svg isn't bundled. Reads as the "ii" signature.
export function XtiitchMark({
  color = "#800020",
  size = 30,
}: {
  color?: string;
  size?: number;
}) {
  const dot = size * 0.22;
  const barW = size * 0.2;
  const barH = size * 0.5;
  const gap = size * 0.16;
  return (
    <View style={{ alignItems: "center" }} accessibilityElementsHidden>
      <View style={{ flexDirection: "row", gap }}>
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
      </View>
      <View style={{ flexDirection: "row", gap, marginTop: size * 0.07 }}>
        <View style={{ width: barW, height: barH, borderRadius: barW / 2, backgroundColor: color }} />
        <View style={{ width: barW, height: barH, borderRadius: barW / 2, backgroundColor: color }} />
      </View>
    </View>
  );
}
