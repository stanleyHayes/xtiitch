import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type HomeSectionProps = {
  label: string;
  children: React.ReactNode;
};

export default function HomeSection({ label, children }: HomeSectionProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: spacing(3),
      marginTop: spacing(3.5),
    },
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: palette.mutedText,
      marginBottom: spacing(1.5),
    },
  });
