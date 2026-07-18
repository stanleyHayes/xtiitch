import { useEffect, useState, useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { api, type SponsoredPlacement } from "../../../src/api";
import { useBranding } from "../../../src/branding";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { SkeletonBlock, XtiitchMark } from "../../../src/ui";
import HomeAccountEntry from "./HomeAccountEntry";
import HomeFeaturedCard from "./HomeFeaturedCard";
import HomePrimaryButton from "./HomePrimaryButton";
import HomeSection from "./HomeSection";
import { trackingTarget } from "./trackingTarget";

export default function HomeScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();
  const { logoUrl } = useBranding();
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
    // Accepts a bare id, a `#`-prefixed id, or a pasted tracking link.
    const clean = trackingTarget(orderId);
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
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              resizeMode="contain"
              accessibilityLabel="Platform logo"
              style={styles.brandLogo}
            />
          ) : (
            <>
              <XtiitchMark color={palette.cream} size={38} />
              <Text style={styles.wordmark}>Xtiitch</Text>
            </>
          )}
        </View>
        <View style={styles.goldRule} />
        <Text style={styles.heroLead}>
          Ghana's fashion houses, in your pocket. Browse a studio, order a
          piece, and follow it from cut to collection.
        </Text>
      </View>

      <MarketplaceEntry onPress={() => router.push("/marketplace")} />

      <HomeAccountEntry onPress={() => router.push("/account")} />

      <HomeSection label="Open a store">
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
          <HomePrimaryButton label="Open" onPress={() => openStore(storeHandle)} />
        </View>
      </HomeSection>

      {loadingFeatured ? (
        <HomeSection label="Featured studios">
          <View style={styles.featuredRow} accessibilityLabel="Loading featured studios">
            {[0, 1].map((item) => (
              <View key={item} style={styles.featuredSkeletonCard}>
                <SkeletonBlock height={130} radiusOverride={radius.md} />
                <View style={styles.featuredSkeletonBody}>
                  <SkeletonBlock width="62%" height={12} />
                  <SkeletonBlock width="86%" height={18} />
                  <SkeletonBlock width="48%" height={12} />
                </View>
              </View>
            ))}
          </View>
        </HomeSection>
      ) : featured.length > 0 ? (
        <HomeSection label="Featured studios">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}
          >
            {featured.map((placement) => (
              <HomeFeaturedCard
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
        </HomeSection>
      ) : null}

      <HomeSection label="Track an order">
        <View style={styles.inlineRow}>
          <TextInput
            value={orderId}
            onChangeText={setOrderId}
            placeholder="order id or tracking link"
            placeholderTextColor={palette.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={trackOrder}
          />
          <HomePrimaryButton label="Track" onPress={trackOrder} />
        </View>
      </HomeSection>

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
    </ScrollView>
  );
}

// Entry card to the marketplace directory. Kept as its own component so the
// HomeScreen function stays within the max-lines-per-function budget.
function MarketplaceEntry({ onPress }: { onPress: () => void }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeMarketStyles(palette), [palette]);
  return (
    <View style={styles.section}>
      <Pressable
        style={({ pressed }) => [styles.marketCard, pressed && styles.cardPressed]}
        onPress={onPress}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.marketKicker}>MARKETPLACE</Text>
          <Text style={styles.marketTitle}>Browse the marketplace</Text>
          <Text style={styles.marketHint}>
            Studios and designs from across Ghana — no account needed to look.
          </Text>
        </View>
        <Text style={styles.marketArrow}>›</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
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
      color: palette.onAccent,
      fontFamily: fonts.display,
      fontSize: 44,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    brandLogo: {
      height: 56,
      width: 220,
      maxWidth: "100%",
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
    inlineRow: {
      flexDirection: "row",
      gap: spacing(1.25),
      alignItems: "center",
    },
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
    featuredSkeletonCard: {
      width: 220,
      backgroundColor: palette.white,
      borderRadius: radius.md,
      overflow: "hidden",
      ...shadow.card,
    },
    featuredSkeletonBody: { padding: spacing(1.75), gap: spacing(1) },
    featuredRow: { gap: spacing(1.75), paddingRight: spacing(3) },
    cardPressed: { opacity: 0.85 },
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
      color: palette.onAccent,
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
  });

// MarketplaceEntry gets its own factory so makeStyles stays within the
// max-lines-per-function budget.
const makeMarketStyles = (palette: Palette) =>
  StyleSheet.create({
    section: {
      paddingHorizontal: spacing(3),
      marginTop: spacing(3.5),
    },
    marketCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.5),
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      padding: spacing(2.5),
      ...shadow.card,
    },
    cardPressed: { opacity: 0.85 },
    marketKicker: {
      color: palette.burgundy,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    marketTitle: {
      color: palette.ink,
      fontFamily: fonts.display,
      fontSize: 19,
      fontWeight: "700",
      marginTop: spacing(0.5),
    },
    marketHint: {
      color: palette.mutedText,
      fontFamily: fonts.body,
      fontSize: 13,
      marginTop: spacing(0.5),
      lineHeight: 19,
    },
    marketArrow: {
      color: palette.burgundy,
      fontSize: 30,
      fontWeight: "700",
    },
  });
