import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../../src/api";
import { formatOrderDate, orderTone } from "../../../../src/businessApi";
import type { CrmCustomerProfile } from "../../../../src/businessAdminApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type CrmOrder = CrmCustomerProfile["orders"][number];

// One order inside the CRM profile. agreed_total_minor is null on an unpriced
// bespoke order — show "Not priced" rather than GH₵0.00.
export default function CrmOrderRow({
  order,
  onPress,
}: {
  order: CrmOrder;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = orderTone(order.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.top}>
        <Text style={styles.date}>{formatOrderDate(order.created_at)}</Text>
        <View style={[styles.statusPill, { backgroundColor: tone }]}>
          <Text style={styles.statusPillText}>{order.status}</Text>
        </View>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.total}>
          {order.agreed_total_minor === null
            ? "Not priced"
            : formatGHS(order.agreed_total_minor)}
        </Text>
        <Text style={styles.settled}>
          {formatGHS(order.settled_minor)} settled
        </Text>
      </View>
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
      gap: spacing(0.75),
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    date: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    statusPill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    statusPillText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    bottom: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing(1.25),
    },
    total: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.burgundy,
    },
    settled: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
    },
  });
