import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { businessOpsApi } from "../../../../src/businessOpsApi";
import {
  fonts,
  radius,
  shadow,
  spacing,
  type Palette,
} from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

const networks = ["MTN", "VOD", "ATL"] as const;

export function PayoutSetupCard() {
  const { palette } = useTheme();
  const s = useMemo(() => styles(palette), [palette]);
  const [network, setNetwork] = useState<(typeof networks)[number]>("MTN");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const result = await businessOpsApi.profile();
    if (result.ok) {
      setReady(result.data.payout_ready);
      setVerified(result.data.verification_status === "verified");
      setNetwork(
        (networks.includes(result.data.settlement_bank as never)
          ? result.data.settlement_bank
          : "MTN") as (typeof networks)[number],
      );
      setAccount(result.data.settlement_account);
      setName(result.data.settlement_account_name);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const sendCode = async () => {
    if (account.trim().length < 9) return Alert.alert("Enter a payout number");
    setBusy(true);
    const result = await businessOpsApi.requestPayoutOTP(account.trim());
    setBusy(false);
    Alert.alert(
      result.ok ? "Code sent" : "Couldn’t send code",
      result.ok
        ? "Enter the SMS code below to prove this wallet."
        : "Check the number and try again.",
    );
  };
  const save = async () => {
    setBusy(true);
    const result = await businessOpsApi.savePayout({
      settlement_bank: network,
      settlement_account: account.trim(),
      settlement_account_name: name.trim(),
      otp_code: code.trim(),
    });
    setBusy(false);
    if (result.ok) {
      setCode("");
      setReady(true);
      Alert.alert("Payout wallet saved");
    } else
      Alert.alert(
        "Couldn’t save payout wallet",
        "Check the wallet details and SMS code.",
      );
  };
  if (ready === null) return null;
  if (!verified)
    return (
      <View style={s.card}>
        <Text style={s.title}>Payout wallet locked</Text>
        <Text style={s.hint}>
          Submit your Ghana Card in Account & security. Wallet setup unlocks
          after Xtiitch approves the business verification.
        </Text>
      </View>
    );
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>Payout wallet</Text>
        <Text style={[s.badge, ready && s.badgeReady]}>
          {ready ? "Ready" : "Setup needed"}
        </Text>
      </View>
      <Text style={s.hint}>
        Settled customer payments move to this verified mobile money wallet.
      </Text>
      <View style={s.chips}>
        {networks.map((item) => (
          <Pressable
            key={item}
            onPress={() => setNetwork(item)}
            style={[s.chip, network === item && s.chipActive]}
          >
            <Text style={[s.chipText, network === item && s.chipTextActive]}>
              {item === "VOD" ? "Telecel" : item === "ATL" ? "AT" : "MTN"}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Wallet account name"
        placeholderTextColor={palette.mutedText}
        style={s.input}
      />
      <TextInput
        value={account}
        onChangeText={setAccount}
        placeholder="Mobile money number"
        placeholderTextColor={palette.mutedText}
        keyboardType="phone-pad"
        style={s.input}
      />
      <View style={s.inline}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="SMS code"
          placeholderTextColor={palette.mutedText}
          keyboardType="number-pad"
          style={[s.input, s.flex]}
        />
        <Pressable
          disabled={busy}
          onPress={() => void sendCode()}
          style={s.secondary}
        >
          <Text style={s.secondaryText}>Send code</Text>
        </Pressable>
      </View>
      <Pressable
        disabled={busy || !code || !name || !account}
        onPress={() => void save()}
        style={s.primary}
      >
        <Text style={s.primaryText}>
          {busy
            ? "Working…"
            : ready
              ? "Update payout wallet"
              : "Enable payouts"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = (p: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: p.white,
      borderColor: p.softBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing(1.1),
      padding: spacing(2),
      ...shadow.card,
    },
    head: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    title: {
      color: p.ink,
      fontFamily: fonts.display,
      fontSize: 19,
      fontWeight: "800",
    },
    badge: {
      backgroundColor: p.wineTint,
      borderRadius: radius.pill,
      color: p.burgundy,
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: "900",
      overflow: "hidden",
      paddingHorizontal: spacing(1),
      paddingVertical: 5,
    },
    badgeReady: { backgroundColor: "rgba(30,142,78,0.12)", color: p.success },
    hint: {
      color: p.mutedText,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
    },
    chips: { flexDirection: "row", gap: spacing(0.75) },
    chip: {
      backgroundColor: p.sunken,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.8),
    },
    chipActive: { backgroundColor: p.burgundy },
    chipText: {
      color: p.ink,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
    },
    chipTextActive: { color: p.onAccent },
    input: {
      backgroundColor: p.sunken,
      borderColor: p.softBorder,
      borderRadius: radius.sm,
      borderWidth: 1,
      color: p.ink,
      fontFamily: fonts.body,
      fontSize: 14,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(1.2),
    },
    inline: { alignItems: "center", flexDirection: "row", gap: spacing(0.75) },
    flex: { flex: 1 },
    secondary: {
      borderColor: p.burgundy,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(1.1),
    },
    secondaryText: {
      color: p.burgundy,
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "900",
    },
    primary: {
      alignItems: "center",
      backgroundColor: p.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.35),
    },
    primaryText: {
      color: p.onAccent,
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "900",
    },
  });
