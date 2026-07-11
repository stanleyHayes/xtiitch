import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type HomePrimaryButtonProps = {
  label: string;
  onPress: () => void;
};

export default function HomePrimaryButton({
  label,
  onPress,
}: HomePrimaryButtonProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.primaryButtonPressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    primaryButton: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2.75),
      paddingVertical: spacing(1.75),
    },
    primaryButtonPressed: { backgroundColor: palette.burgundyDeep },
    primaryButtonText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontWeight: "800",
      fontSize: 15,
    },
  });
