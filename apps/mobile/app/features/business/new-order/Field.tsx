import { useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// Labelled text field shared by the walk-in order forms (customer details
// and bespoke measurement values).
export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad" | "email-address" | "decimal-pad";
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        autoCorrect={false}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    fieldLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
      marginBottom: spacing(0.75),
    },
    input: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.75),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
  });
