import { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

// Labelled text input for the customer account forms, styled like the design
// flow's DesignField (kept local so the account lane stays self-contained).
export default function AccountField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={maxLength}
        style={styles.input}
      />
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    field: { gap: spacing(0.75) },
    label: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
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
