import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  affiliateApi,
  type AffiliateCampaign,
  type AffiliateShare,
} from "../../src/affiliateApi";
import {
  fonts,
  radius,
  spacing,
  type Palette,
  typeScale,
} from "../../src/theme";
import { useTheme } from "../../src/theme-mode";
import { CenterState, LoadingButtonLabel } from "../../src/ui";

export default function AffiliateLinksScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const [share, setShare] = useState<AffiliateShare | null>(null);
  const [campaigns, setCampaigns] = useState<AffiliateCampaign[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [destination, setDestination] = useState("https://xtiitch.com");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      affiliateApi.share(),
      affiliateApi.campaigns(),
    ]);
    if ((!s.ok && s.expired) || (!c.ok && c.expired)) {
      router.replace("/affiliate/login");
      return;
    }
    if (s.ok) setShare(s.data);
    if (c.ok) setCampaigns(c.data.campaign_links);
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  if (!share) return <CenterState loading />;
  const create = async () => {
    if (!name.trim() || !slug.trim() || !destination.trim()) {
      setMessage("Complete all three campaign fields.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = await affiliateApi.createCampaign({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      destination_url: destination.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(
        result.error.includes("slug")
          ? "That campaign slug is already in use."
          : "We couldn't create that link.",
      );
      return;
    }
    setName("");
    setSlug("");
    setMessage("Campaign link created.");
    await load();
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Campaign links" }} />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PRIMARY REFERRAL LINK</Text>
        <Text style={styles.code}>{share.code}</Text>
        <Text style={styles.url}>{share.canonical_url}</Text>
        <Pressable
          style={styles.shareButton}
          onPress={() =>
            Share.share({ message: `Discover Xtiitch: ${share.canonical_url}` })
          }
        >
          <Ionicons name="share-outline" size={18} color={palette.onAccent} />
          <Text style={styles.shareText}>Share link</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>Create campaign link</Text>
      <View style={styles.form}>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Field
          label="Campaign name"
          value={name}
          onChange={setName}
          placeholder="August Instagram"
        />
        <Field
          label="Short slug"
          value={slug}
          onChange={setSlug}
          placeholder="august-ig"
        />
        <Field
          label="Destination URL"
          value={destination}
          onChange={setDestination}
          placeholder="https://xtiitch.com"
        />
        <Pressable disabled={busy} onPress={create} style={styles.create}>
          {busy ? (
            <LoadingButtonLabel label="Creating" color={palette.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Create campaign link</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.title}>Your campaigns</Text>
      <View style={styles.list}>
        {campaigns.length ? (
          campaigns.map((item, index) => (
            <Pressable
              key={item.campaign_link_id}
              onPress={() =>
                Share.share({
                  message: `${item.name}: ${item.destination_url}`,
                })
              }
              style={[styles.row, index > 0 && styles.border]}
            >
              <View style={styles.icon}>
                <Ionicons
                  name="megaphone-outline"
                  size={18}
                  color={palette.burgundy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  /{item.slug} · {item.destination_url}
                </Text>
              </View>
              <Ionicons
                name="share-outline"
                size={18}
                color={palette.mutedText}
              />
            </Pressable>
          ))
        ) : (
          <Text style={styles.empty}>No campaign links yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        style={styles.input}
      />
    </View>
  );
}
const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(2.5), paddingBottom: spacing(6) },
    hero: {
      padding: spacing(2.5),
      backgroundColor: palette.burgundyDeep,
      borderRadius: radius.lg,
    },
    eyebrow: {
      color: palette.gold,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.5,
    },
    code: {
      color: palette.onAccent,
      fontSize: 26,
      fontWeight: "900",
      marginTop: spacing(1),
    },
    url: {
      color: "rgba(255,255,255,0.66)",
      lineHeight: 20,
      marginTop: spacing(0.5),
    },
    shareButton: {
      minHeight: 46,
      marginTop: spacing(2),
      borderRadius: radius.pill,
      backgroundColor: palette.burgundy,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing(1),
    },
    shareText: { color: palette.onAccent, fontWeight: "800" },
    title: {
      ...typeScale.heading,
      color: palette.ink,
      fontFamily: fonts.display,
      fontWeight: "800",
      marginTop: spacing(3),
      marginBottom: spacing(1.25),
    },
    form: {
      gap: spacing(1.5),
      padding: spacing(2),
      backgroundColor: palette.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.hairline,
    },
    label: {
      color: palette.ink,
      fontWeight: "700",
      fontSize: 13,
      marginBottom: spacing(0.6),
    },
    input: {
      minHeight: 50,
      paddingHorizontal: spacing(1.5),
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.sm,
      backgroundColor: palette.white,
      color: palette.ink,
    },
    create: {
      minHeight: 50,
      borderRadius: radius.pill,
      backgroundColor: palette.burgundy,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing(0.5),
    },
    buttonText: { color: palette.onAccent, fontWeight: "800" },
    message: { color: palette.burgundy, fontWeight: "700" },
    list: {
      backgroundColor: palette.elevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.hairline,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.25),
      padding: spacing(1.75),
    },
    border: { borderTopWidth: 1, borderTopColor: palette.hairline },
    icon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: palette.wineTint,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: { color: palette.ink, fontWeight: "800" },
    rowMeta: { color: palette.mutedText, fontSize: 11, marginTop: 3 },
    empty: {
      color: palette.mutedText,
      textAlign: "center",
      padding: spacing(3),
    },
  });
