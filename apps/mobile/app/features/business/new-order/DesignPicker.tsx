import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type BusinessDesign } from "../../../../src/businessApi";
import { ImageTile } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// The walk-in design picker: active designs only (filtered by the caller),
// one selectable card each with the radio treatment used across the app.
export function DesignPicker({
  designs,
  designId,
  onSelect,
}: {
  designs: BusinessDesign[];
  designId: string | null;
  onSelect: (designId: string) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.designList}>
      {designs.map((design) => {
        const active = design.design_id === designId;
        return (
          <Pressable
            key={design.design_id}
            onPress={() => onSelect(design.design_id)}
            style={[styles.designCard, active && styles.designCardActive]}
          >
            <ImageTile
              uri={design.images[0]}
              seed={design.handle}
              style={styles.designThumb}
              radiusOverride={radius.sm}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.designTitle} numberOfLines={1}>
                {design.title}
              </Text>
              <Text style={styles.designStatus}>{design.status}</Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    designList: { gap: spacing(1.25) },
    designCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.5),
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      padding: spacing(1.5),
    },
    designCardActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.04)",
    },
    designThumb: { width: 52, height: 52 },
    designTitle: { fontFamily: fonts.display, fontSize: 17, color: palette.ink },
    designStatus: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      textTransform: "capitalize",
      marginTop: 2,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: palette.softBorder,
    },
    radioActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.burgundy,
    },
  });
