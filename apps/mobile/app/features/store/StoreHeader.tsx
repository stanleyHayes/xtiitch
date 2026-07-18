import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { StoreSummary } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

type StoreHeaderProps = {
  store: StoreSummary;
  designCount: number;
};

// Storefront branding header: consumes the store's banner/logo when the plan
// entitlement exposes them (web: features/storefront/store-header.tsx), and
// falls back to the brand-coloured dot otherwise.
export default function StoreHeader({ store, designCount }: StoreHeaderProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const logoUrl = store.settings.logo_url?.trim() ?? "";
  const bannerUrl = store.settings.banner_url?.trim() ?? "";
  const brandColor = store.brand_color || palette.burgundy;

  return (
    <View style={styles.header}>
      {bannerUrl ? (
        <Image
          source={{ uri: bannerUrl }}
          resizeMode="cover"
          accessibilityLabel={`${store.name} banner`}
          style={styles.banner}
        />
      ) : null}
      <View style={styles.identityRow}>
        {logoUrl ? (
          <Image
            source={{ uri: logoUrl }}
            resizeMode="contain"
            accessibilityLabel={`${store.name} logo`}
            style={styles.logo}
          />
        ) : (
          <View style={[styles.brandDot, { backgroundColor: brandColor }]} />
        )}
        <View style={styles.identityText}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeHandle}>
            {store.handle}.xtiitch.com · {designCount} piece
            {designCount === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    header: { marginBottom: spacing(2.5) },
    banner: {
      width: "100%",
      height: 140,
      borderRadius: radius.md,
      marginBottom: spacing(1.5),
      backgroundColor: palette.panel,
    },
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.5),
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      backgroundColor: palette.white,
    },
    brandDot: { width: 44, height: 44, borderRadius: radius.pill },
    identityText: { flex: 1 },
    storeName: {
      fontFamily: fonts.display,
      fontSize: 26,
      color: palette.ink,
      fontWeight: "700",
    },
    storeHandle: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.25),
    },
  });
