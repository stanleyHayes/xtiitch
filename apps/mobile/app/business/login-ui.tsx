import { useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { fonts, radius, spacing, type Palette } from "../../src/theme";
import { useTheme } from "../../src/theme-mode";

// Shared look for the business sign-in screens: the password form, the MFA
// challenge, and the WhatsApp code form (otp-login-form.tsx) all build on
// these styles and the same labelled field.
export const makeLoginStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    checking: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.cream,
      padding: spacing(3),
      gap: spacing(1.25),
    },
    checkingPanel: {
      width: "100%",
      marginTop: spacing(2),
      gap: spacing(1.25),
    },
    content: { paddingBottom: spacing(6) },
    hero: {
      backgroundColor: palette.burgundy,
      paddingHorizontal: spacing(3),
      paddingTop: spacing(3),
      paddingBottom: spacing(4),
      borderBottomLeftRadius: radius.lg,
      borderBottomRightRadius: radius.lg,
    },
    kicker: {
      color: palette.gold,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 2,
    },
    title: {
      color: palette.onAccent,
      fontFamily: fonts.display,
      fontSize: 30,
      fontWeight: "700",
      marginTop: spacing(1),
    },
    lead: {
      color: "rgba(255,255,255,0.85)",
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      marginTop: spacing(1),
    },
    form: { padding: spacing(3), gap: spacing(1.75) },
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
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(0.5),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
      marginTop: spacing(1.5),
    },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
    link: { alignItems: "center", paddingVertical: spacing(1.5) },
    linkText: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
    },
  });

export function LoginField({
  label,
  value,
  onChange,
  placeholder,
  autoCapitalize,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "words";
  keyboardType?: "email-address" | "phone-pad" | "number-pad";
  secureTextEntry?: boolean;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeLoginStyles(palette), [palette]);
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}
