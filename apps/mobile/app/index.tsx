import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import {
  api,
  apiBaseUrl,
  type SponsoredPlacement,
} from "../src/api";
import { fonts, palette, radius, shadow, spacing, swatchFor } from "../src/theme";
import { XtiitchMark } from "../src/ui";

const SUGGESTED_STORE = "demo-atelier";

export default function HomeScreen() {
  const router = useRouter();
  const [storeHandle, setStoreHandle] = useState("");
  const [orderId, setOrderId] = useState("");
  const [featured, setFeatured] = useState<SponsoredPlacement[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    let active = true;
    api.sponsored().then((result) => {
      if (!active) return;
      if (result.ok) setFeatured(result.data.placements);
      setLoadingFeatured(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const openStore = (handle: string) => {
    const clean = handle.trim().toLowerCase();
    if (!clean) return;
    router.push(`/store/${encodeURIComponent(clean)}`);
  };

  const trackOrder = () => {
    const clean = orderId.trim();
    if (!clean) return;
    router.push(`/track/${encodeURIComponent(clean)}`);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>XCREATIVS · GHANA</Text>
        <View style={styles.lockup}>
          <XtiitchMark color={palette.cream} size={38} />
          <Text style={styles.wordmark}>Xtiitch</Text>
        </View>
        <View style={styles.goldRule} />
        <Text style={styles.heroLead}>
          Ghana's fashion houses, in your pocket. Browse a studio, order a
          piece, and follow it from cut to collection.
        </Text>
      </View>

      <Section label="Open a store">
        <View style={styles.inlineRow}>
          <TextInput
            value={storeHandle}
            onChangeText={setStoreHandle}
            placeholder="store handle (e.g. demo-atelier)"
            placeholderTextColor={palette.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={() => openStore(storeHandle)}
          />
          <PrimaryButton label="Open" onPress={() => openStore(storeHandle)} />
        </View>
        <Pressable
          style={styles.suggestChip}
          onPress={() => openStore(SUGGESTED_STORE)}
        >
          <Text style={styles.suggestChipText}>Try {SUGGESTED_STORE}</Text>
        </Pressable>
      </Section>

      <Section label="Featured studios">
        {loadingFeatured ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={palette.burgundy} />
          </View>
        ) : featured.length === 0 ? (
          <Pressable
            style={styles.emptyFeatured}
            onPress={() => openStore(SUGGESTED_STORE)}
          >
            <Text style={styles.emptyFeaturedTitle}>No sponsored studios yet</Text>
            <Text style={styles.emptyFeaturedHint}>
              Featured placements appear here. Tap to explore {SUGGESTED_STORE}.
            </Text>
          </Pressable>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}
          >
            {featured.map((placement) => (
              <FeaturedCard
                key={placement.campaign_id}
                placement={placement}
                onPress={() =>
                  placement.design_handle
                    ? router.push(`/design/${placement.design_handle}`)
                    : openStore(placement.store_handle || placement.business_handle)
                }
              />
            ))}
          </ScrollView>
        )}
      </Section>

      <Section label="Track an order">
        <View style={styles.inlineRow}>
          <TextInput
            value={orderId}
            onChangeText={setOrderId}
            placeholder="order id from your receipt"
            placeholderTextColor={palette.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={trackOrder}
          />
          <PrimaryButton label="Track" onPress={trackOrder} />
        </View>
      </Section>

      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [styles.studioCard, pressed && styles.cardPressed]}
          onPress={() => router.push("/business")}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.studioKicker}>RUN A STUDIO?</Text>
            <Text style={styles.studioTitle}>Open the studio console</Text>
            <Text style={styles.studioHint}>
              Sign in to manage orders, fulfilment, and takings.
            </Text>
          </View>
          <Text style={styles.studioArrow}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>Connected to {apiBaseUrl()}</Text>
    </ScrollView>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
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

function FeaturedCard({
  placement,
  onPress,
}: {
  placement: SponsoredPlacement;
  onPress: () => void;
}) {
  const [from, to] = swatchFor(placement.business_handle || placement.headline);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.featuredCard, pressed && styles.cardPressed]}
    >
      {placement.image_url ? (
        <Image source={{ uri: placement.image_url }} style={styles.featuredImage} />
      ) : (
        <View style={[styles.featuredImage, { backgroundColor: from }]}>
          <View style={[styles.featuredSwatchAccent, { backgroundColor: to }]} />
        </View>
      )}
      <View style={styles.featuredBody}>
        <Text style={styles.featuredBusiness} numberOfLines={1}>
          {placement.business_name}
        </Text>
        <Text style={styles.featuredHeadline} numberOfLines={2}>
          {placement.headline || placement.target_label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  content: { paddingBottom: spacing(5) },
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
  lockup: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing(1.25),
    marginTop: spacing(0.75),
  },
  wordmark: {
    color: palette.white,
    fontFamily: fonts.display,
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  goldRule: {
    width: 54,
    height: 3,
    borderRadius: 3,
    backgroundColor: palette.gold,
    marginTop: spacing(1.5),
    marginBottom: spacing(1.5),
  },
  heroLead: {
    color: "rgba(255,255,255,0.86)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
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
  inlineRow: { flexDirection: "row", gap: spacing(1.25), alignItems: "center" },
  input: {
    flex: 1,
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
  primaryButton: {
    backgroundColor: palette.burgundy,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.75),
    paddingVertical: spacing(1.75),
  },
  primaryButtonPressed: { backgroundColor: palette.burgundyDeep },
  primaryButtonText: {
    color: palette.white,
    fontFamily: fonts.body,
    fontWeight: "800",
    fontSize: 15,
  },
  suggestChip: {
    alignSelf: "flex-start",
    marginTop: spacing(1.5),
    backgroundColor: "rgba(128,0,32,0.08)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.75),
    paddingVertical: spacing(0.75),
  },
  suggestChipText: {
    color: palette.burgundy,
    fontFamily: fonts.body,
    fontWeight: "700",
    fontSize: 13,
  },
  loadingRow: { paddingVertical: spacing(3), alignItems: "center" },
  emptyFeatured: {
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.softBorder,
    padding: spacing(2.5),
  },
  emptyFeaturedTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: palette.ink,
    fontWeight: "700",
  },
  emptyFeaturedHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.mutedText,
    marginTop: spacing(0.75),
    lineHeight: 20,
  },
  featuredRow: { gap: spacing(1.75), paddingRight: spacing(3) },
  featuredCard: {
    width: 220,
    backgroundColor: palette.white,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadow.card,
  },
  cardPressed: { opacity: 0.85 },
  featuredImage: {
    height: 130,
    width: "100%",
    justifyContent: "flex-end",
  },
  featuredSwatchAccent: { height: 34, width: "55%", opacity: 0.7 },
  featuredBody: { padding: spacing(1.75) },
  featuredBusiness: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: palette.gold,
  },
  featuredHeadline: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: palette.ink,
    marginTop: spacing(0.5),
    lineHeight: 22,
  },
  studioCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    backgroundColor: palette.ink,
    borderRadius: radius.md,
    padding: spacing(2.5),
  },
  studioKicker: {
    color: palette.gold,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  studioTitle: {
    color: palette.white,
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: "700",
    marginTop: spacing(0.5),
  },
  studioHint: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing(0.5),
    lineHeight: 19,
  },
  studioArrow: {
    color: palette.gold,
    fontSize: 30,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    color: palette.mutedText,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: spacing(4),
  },
});
