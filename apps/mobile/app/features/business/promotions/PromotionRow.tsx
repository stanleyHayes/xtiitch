import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  promotionDiscountLabel,
  type BusinessPromotion,
} from "../../../../src/businessAdminApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// Human scope label for a promotion row. The API also supports "collection",
// which the mobile create form doesn't offer but existing rows may carry.
export function promotionScopeLabel(promo: BusinessPromotion): string {
  switch (promo.scope) {
    case "store":
      return "Store-wide";
    case "design":
      return "Design";
    case "collection":
      return "Collection";
    default:
      return promo.scope;
  }
}

function statusTone(promo: BusinessPromotion, palette: Palette): string {
  switch (promo.status) {
    case "active":
      return palette.success;
    case "paused":
      return palette.warning;
    default:
      return palette.mutedText;
  }
}

export function PromotionRow({
  promo,
  busy,
  onToggleStatus,
  onArchive,
}: {
  promo: BusinessPromotion;
  busy: boolean;
  onToggleStatus: () => void;
  onArchive: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = statusTone(promo, palette);
  const archived = promo.status === "archived";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.code}>{promo.code}</Text>
        <View style={[styles.pill, { backgroundColor: `${tone}1a` }]}>
          <Text style={[styles.pillText, { color: tone }]}>{promo.status}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {promo.title}
      </Text>
      <Text style={styles.meta}>
        {promotionDiscountLabel(promo)} · {promotionScopeLabel(promo)} ·{" "}
        {promo.redemption_count}{" "}
        {promo.redemption_count === 1 ? "redemption" : "redemptions"}
      </Text>

      {!archived ? (
        <View style={styles.actions}>
          <Pressable
            disabled={busy}
            onPress={onToggleStatus}
            hitSlop={6}
            style={({ pressed }) => [
              styles.action,
              (pressed || busy) && styles.actionDim,
            ]}
          >
            <Text style={styles.actionText}>
              {promo.status === "active" ? "Pause" : "Resume"}
            </Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onArchive}
            hitSlop={6}
            style={({ pressed }) => [
              styles.action,
              (pressed || busy) && styles.actionDim,
            ]}
          >
            <Text style={[styles.actionText, styles.archiveText]}>Archive</Text>
          </Pressable>
        </View>
      ) : null}
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
      padding: spacing(2),
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1.5),
    },
    code: {
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: palette.ink,
    },
    pill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    pillText: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    title: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.ink,
      marginTop: spacing(0.5),
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
    actions: {
      flexDirection: "row",
      gap: spacing(2.5),
      marginTop: spacing(1.5),
      paddingTop: spacing(1.25),
      borderTopWidth: 1,
      borderTopColor: palette.softBorder,
    },
    action: { paddingVertical: spacing(0.25) },
    actionDim: { opacity: 0.5 },
    actionText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.burgundy,
    },
    archiveText: { color: palette.danger },
  });
