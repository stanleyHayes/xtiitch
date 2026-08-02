import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect } from "expo-router";
import {
  businessAccountApi,
  type MFAStatus,
  type OwnProfile,
} from "../../src/businessAccountApi";
import { useTheme } from "../../src/theme-mode";
import { makeStyles } from "./account.styles";
import { IdentityVerificationCard } from "../features/business/account/IdentityVerificationCard";

const empty: OwnProfile = {
  business_id: "",
  user_id: "",
  role: "",
  email: "",
  display_name: "",
  phone: "",
  phone_verified: false,
  whatsapp_number: "",
};

// eslint-disable-next-line max-lines-per-function, complexity -- complete profile and security workspace
export default function BusinessAccountScreen() {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const [profile, setProfile] = useState(empty);
  const [mfa, setMfa] = useState<MFAStatus | null>(null);
  const [otp, setOtp] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [p, m] = await Promise.all([
      businessAccountApi.profile(),
      businessAccountApi.mfaStatus(),
    ]);
    if (p.ok) setProfile(p.data);
    if (m.ok) setMfa(m.data);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const input = (
    value: string,
    onChangeText: (v: string) => void,
    placeholder: string,
    secure = false,
  ) => (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.mutedText}
      secureTextEntry={secure}
      autoCapitalize="none"
      style={s.input}
    />
  );
  const saveProfile = async () => {
    setBusy(true);
    const result = await businessAccountApi.updateProfile({
      display_name: profile.display_name.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
      whatsapp_number: profile.whatsapp_number.trim(),
      ...(otp ? { otp_code: otp } : {}),
    });
    setBusy(false);
    if (result.ok) {
      setOtp("");
      await load();
      Alert.alert("Profile saved", "Your studio identity is up to date.");
    } else
      Alert.alert(
        "Couldn’t save profile",
        result.error === "upstream_409"
          ? "That email or WhatsApp number is already in use."
          : "Check your details. A changed phone number also needs its SMS code.",
      );
  };
  const changePassword = async () => {
    if (newPassword.length < 8)
      return Alert.alert("Password too short", "Use at least 8 characters.");
    setBusy(true);
    const result = await businessAccountApi.changePassword(
      currentPassword,
      newPassword,
    );
    setBusy(false);
    if (result.ok) {
      setCurrentPassword("");
      setNewPassword("");
      Alert.alert("Password changed");
    } else
      Alert.alert(
        "Password not changed",
        "Check your current password and try again.",
      );
  };
  const toggleMFA = async () => {
    if (mfa?.enabled) {
      const result = await businessAccountApi.disableMFA(mfaCode);
      if (result.ok) {
        setMfaCode("");
        await load();
      } else
        Alert.alert(
          "Couldn’t disable MFA",
          "Enter a current authenticator or backup code.",
        );
      return;
    }
    if (!secret) {
      const setup = await businessAccountApi.startMFA();
      if (setup.ok) setSecret(setup.data.secret);
      else Alert.alert("MFA setup unavailable");
      return;
    }
    const result = await businessAccountApi.activateMFA(mfaCode);
    if (result.ok) {
      Alert.alert(
        "Save your backup codes",
        result.data.backup_codes.join("\n"),
      );
      setSecret("");
      setMfaCode("");
      await load();
    } else Alert.alert("That code didn’t work");
  };
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Account & security" }} />
      <View style={s.hero}>
        <Ionicons
          name="shield-checkmark-outline"
          size={150}
          color={palette.onAccent}
          style={s.watermark}
        />
        <Text style={s.eyebrow}>YOUR STUDIO IDENTITY</Text>
        <Text style={s.title}>Account & security</Text>
        <Text style={s.subtitle}>
          Keep your profile current and lock the workspace behind stronger
          sign-in.
        </Text>
      </View>
      <Text style={s.section}>Profile</Text>
      <View style={s.card}>
        {input(
          profile.display_name,
          (v) => setProfile((p) => ({ ...p, display_name: v })),
          "Display name",
        )}
        {input(
          profile.email,
          (v) => setProfile((p) => ({ ...p, email: v })),
          "Email",
        )}
        {input(
          profile.phone,
          (v) => setProfile((p) => ({ ...p, phone: v })),
          "Phone",
        )}
        {input(
          profile.whatsapp_number,
          (v) => setProfile((p) => ({ ...p, whatsapp_number: v })),
          "WhatsApp",
        )}
        {!profile.phone_verified ? (
          <View style={s.inline}>
            {input(otp, setOtp, "SMS code")}
            <Pressable
              onPress={() =>
                void businessAccountApi.requestPhoneCode(profile.phone)
              }
              style={s.secondary}
            >
              <Text style={s.secondaryText}>Send code</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={s.good}>✓ Phone verified</Text>
        )}
        <Pressable
          disabled={busy}
          onPress={() => void saveProfile()}
          style={s.primary}
        >
          <Text style={s.primaryText}>Save profile</Text>
        </Pressable>
      </View>
      <Text style={s.section}>Password</Text>
      <View style={s.card}>
        {input(currentPassword, setCurrentPassword, "Current password", true)}
        {input(newPassword, setNewPassword, "New password", true)}
        <Pressable
          disabled={busy || !currentPassword || !newPassword}
          onPress={() => void changePassword()}
          style={s.primary}
        >
          <Text style={s.primaryText}>Change password</Text>
        </Pressable>
      </View>
      <Text style={s.section}>Authenticator MFA</Text>
      <View style={s.card}>
        <Text style={s.cardTitle}>
          {mfa?.enabled ? "MFA is on" : "Add a second layer"}
        </Text>
        <Text style={s.hint}>
          {mfa?.enabled
            ? `${mfa.backup_codes_left} backup codes remain.`
            : secret
              ? `Add this secret to your authenticator: ${secret}`
              : "Use any TOTP authenticator app when you sign in."}
        </Text>
        {secret || mfa?.enabled
          ? input(mfaCode, setMfaCode, "6-digit or backup code")
          : null}
        <Pressable onPress={() => void toggleMFA()} style={s.secondary}>
          <Text style={s.secondaryText}>
            {mfa?.enabled
              ? "Disable MFA"
              : secret
                ? "Verify and enable"
                : "Start MFA setup"}
          </Text>
        </Pressable>
      </View>
      {profile.role === "owner" || profile.role === "admin" ? (
        <>
          <Text style={s.section}>Business verification</Text>
          <IdentityVerificationCard />
        </>
      ) : null}
    </ScrollView>
  );
}
