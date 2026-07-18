import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import type { MarketplaceTab, SortKey } from "./marketplaceUtils";

// Sort options mirror the web marketplace's Select; RN has no native dropdown,
// so they render as a chip row. `popular` is labelled per tab like the web
// ("Most designs" for studios, "Featured" for designs).
const SORT_OPTIONS: { key: SortKey; label: string; designsOnly?: boolean }[] = [
  { key: "popular", label: "Most designs" },
  { key: "name", label: "Name A–Z" },
  { key: "price_low", label: "Price: low → high", designsOnly: true },
  { key: "price_high", label: "Price: high → low", designsOnly: true },
];

const TABS: { key: MarketplaceTab; label: string }[] = [
  { key: "studios", label: "Studios" },
  { key: "designs", label: "Designs" },
];

type MarketplaceFilterBarProps = {
  tab: MarketplaceTab;
  onTabChange: (tab: MarketplaceTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
};

export default function MarketplaceFilterBar({
  tab,
  onTabChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: MarketplaceFilterBarProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const sortOptions = SORT_OPTIONS.filter(
    (option) => tab === "designs" || !option.designsOnly,
  ).map((option) =>
    option.key === "popular" && tab === "designs"
      ? { ...option, label: "Featured" }
      : option,
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onTabChange(item.key)}
            style={[styles.tabPill, tab === item.key && styles.tabPillActive]}
          >
            <Text
              style={[
                styles.tabPillText,
                tab === item.key && styles.tabPillTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={search}
        onChangeText={onSearchChange}
        placeholder={tab === "studios" ? "Search studios" : "Search designs"}
        placeholderTextColor={palette.mutedText}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
        returnKeyType="search"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {sortOptions.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => onSortChange(option.key)}
            style={[styles.sortChip, sort === option.key && styles.sortChipActive]}
          >
            <Text
              style={[
                styles.sortChipText,
                sort === option.key && styles.sortChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    container: { gap: spacing(1.5) },
    tabRow: {
      flexDirection: "row",
      alignSelf: "flex-start",
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      padding: spacing(0.5),
      gap: spacing(0.5),
    },
    tabPill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2.5),
      paddingVertical: spacing(1),
    },
    tabPillActive: { backgroundColor: palette.burgundy },
    tabPillText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      color: palette.mutedText,
    },
    tabPillTextActive: { color: palette.onAccent },
    search: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
    sortRow: { gap: spacing(1), paddingRight: spacing(3) },
    sortChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.softBorder,
      backgroundColor: palette.white,
      paddingHorizontal: spacing(1.75),
      paddingVertical: spacing(0.875),
    },
    sortChipActive: {
      backgroundColor: palette.wineTint,
      borderColor: palette.burgundy,
    },
    sortChipText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.mutedText,
    },
    sortChipTextActive: { color: palette.burgundy },
  });
