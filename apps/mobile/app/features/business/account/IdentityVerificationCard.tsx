import { useMemo, useState } from "react";
import { Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import { businessAccountApi } from "../../../../src/businessAccountApi";
import { pickAndUploadDesignImage } from "../../../../src/businessMedia";
import { useTheme } from "../../../../src/theme-mode";
import { makeStyles } from "../../../business/account.styles";

export function IdentityVerificationCard() {
  const { palette } = useTheme();
  const s = useMemo(() => makeStyles(palette), [palette]);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [busy, setBusy] = useState(false);
  const photo = async (side: "front" | "back") => {
    const result = await pickAndUploadDesignImage();
    if (result.ok) (side === "front" ? setFront : setBack)(result.url);
    else if (result.error !== "cancelled") Alert.alert("Couldn’t upload photo");
  };
  const submit = async () => {
    if (!/^GHA-\d{9}-\d$/.test(number.trim().toUpperCase())) {
      return Alert.alert(
        "Check Ghana Card number",
        "Use the format GHA-123456789-0.",
      );
    }
    setBusy(true);
    const result = await businessAccountApi.submitIdentity({
      full_legal_name: name.trim(),
      card_number: number.trim().toUpperCase(),
      id_photo_url: front,
      id_photo_back_url: back,
    });
    setBusy(false);
    Alert.alert(
      result.ok ? "Submitted for review" : "Couldn’t submit verification",
      result.ok
        ? "Xtiitch will review your Ghana Card. Payout setup unlocks after approval."
        : "Check the name, number, and both photos.",
    );
  };
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Business verification</Text>
      <Text style={s.hint}>
        Submit the owner’s Ghana Card before enabling customer payments and
        payouts.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Full legal name"
        placeholderTextColor={palette.mutedText}
        style={s.input}
      />
      <TextInput
        value={number}
        onChangeText={(value) => setNumber(value.toUpperCase())}
        placeholder="GHA-123456789-0"
        placeholderTextColor={palette.mutedText}
        autoCapitalize="characters"
        style={s.input}
      />
      <View style={s.photoRow}>
        {(["front", "back"] as const).map((side) => {
          const url = side === "front" ? front : back;
          return (
            <Pressable
              key={side}
              onPress={() => void photo(side)}
              style={s.photoButton}
            >
              {url ? (
                <Image source={{ uri: url }} style={s.photo} />
              ) : (
                <Text style={s.secondaryText}>Add {side} photo</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        disabled={busy || !name.trim() || !front || !back}
        onPress={() => void submit()}
        style={s.primary}
      >
        <Text style={s.primaryText}>
          {busy ? "Submitting…" : "Submit for verification"}
        </Text>
      </Pressable>
    </View>
  );
}
