import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import {
  businessAdminApi,
  type CreateBusinessUserInput,
} from "../../../../src/businessAdminApi";
import { LoadingButtonLabel } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

const ROLES: { value: CreateBusinessUserInput["role"]; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
];

export function InviteForm({
  onCreated,
  onSessionExpired,
}: {
  onCreated: () => void;
  onSessionExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreateBusinessUserInput["role"]>("staff");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit =
    name.trim().length > 1 && emailValid && password.length >= 8 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const input: CreateBusinessUserInput = {
      display_name: name.trim(),
      email: email.trim(),
      password,
      role,
    };
    if (phone.trim()) input.phone = phone.trim();
    const result = await businessAdminApi.inviteTeamMember(input);
    setSubmitting(false);
    if (result.ok) {
      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRole("staff");
      onCreated();
    } else if (result.expired) {
      onSessionExpired();
    } else if (result.error === "upstream_409") {
      setError("A user with that email already exists.");
    } else {
      setError("Couldn't create the invite. Check the details and retry.");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Invite member</Text>
      <Text style={styles.hint}>
        They sign in with this email and the temporary password below.
      </Text>

      <View style={styles.form}>
        <Field
          label="Display name"
          value={name}
          onChange={setName}
          placeholder="Ama Serwaa"
        />
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="ama@studio.com"
          keyboardType="email-address"
        />
        <Field
          label="Phone (optional)"
          value={phone}
          onChange={setPhone}
          placeholder="+233 50 123 4567"
          keyboardType="phone-pad"
        />
        <Field
          label="Temporary password"
          value={password}
          onChange={setPassword}
          placeholder="Minimum 8 characters"
          secureTextEntry
        />

        <View>
          <Text style={styles.fieldLabel}>Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map((option) => {
              const active = role === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setRole(option.value)}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      active && styles.roleChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {success ? (
        <Text style={styles.success}>
          Invite created — share the temporary password securely.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        {submitting ? (
          <LoadingButtonLabel label="Creating invite" />
        ) : (
          <Text style={styles.ctaText}>Create invite</Text>
        )}
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const unaccented =
    keyboardType === "email-address" || label === "Temporary password";
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        autoCapitalize={unaccented ? "none" : "words"}
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2.5),
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "700",
      color: palette.ink,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.5),
      lineHeight: 19,
    },
    form: { gap: spacing(1.75), marginTop: spacing(2) },
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
    roleRow: { flexDirection: "row", gap: spacing(1) },
    roleChip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      backgroundColor: palette.white,
    },
    roleChipActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.wineTint,
    },
    roleChipText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    roleChipTextActive: { color: palette.burgundy },
    success: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.success,
      marginTop: spacing(2),
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(2),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
      marginTop: spacing(2.5),
    },
    ctaDisabled: { backgroundColor: palette.mauve },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
  });
