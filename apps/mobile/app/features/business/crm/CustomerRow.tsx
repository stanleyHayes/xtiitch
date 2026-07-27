import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../../src/api";
import { formatOrderDate } from "../../../../src/businessApi";
import type { CrmCustomerRow as CrmCustomerRowType } from "../../../../src/businessAdminApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// One CRM list row. orders_count/total_spend_minor are explicit null below CRM
// level 1 (plan-gated) — never render them as zero; show the upgrade hint
// instead. The tags key only exists at level 2, so chips render conditionally.
export default function CustomerRow({
  customer,
  onPress,
}: {
  customer: CrmCustomerRowType;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const insightsGated =
    customer.orders_count === null || customer.total_spend_minor === null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      {customer.phone ? (
        <Text style={styles.phone} numberOfLines={1}>
          {customer.phone}
        </Text>
      ) : null}
      {insightsGated ? (
        <Text style={styles.upgradeHint}>Upgrade for customer insights</Text>
      ) : (
        <Text style={styles.meta}>
          {customer.orders_count}{" "}
          {customer.orders_count === 1 ? "order" : "orders"} ·{" "}
          {formatGHS(customer.total_spend_minor ?? 0)} spent
        </Text>
      )}
      {customer.last_order_at ? (
        <Text style={styles.meta}>
          Last order {formatOrderDate(customer.last_order_at)}
        </Text>
      ) : null}
      {customer.tags && customer.tags.length > 0 ? (
        <View style={styles.tags}>
          {customer.tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    row: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
      gap: spacing(0.5),
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    name: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 17,
      color: palette.ink,
    },
    chevron: { fontSize: 22, fontWeight: "700", color: palette.burgundy },
    phone: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.ink,
      marginTop: spacing(0.25),
    },
    upgradeHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontStyle: "italic",
      color: palette.mauve,
      marginTop: spacing(0.25),
    },
    tags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(0.75),
      marginTop: spacing(0.75),
    },
    tagChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: palette.softBorder,
      backgroundColor: palette.panel,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    tagText: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "700",
      color: palette.mutedText,
      textTransform: "capitalize",
    },
  });
