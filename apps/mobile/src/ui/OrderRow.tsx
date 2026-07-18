import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatGHS } from "../api";
import { orderTone, type BusinessOrder } from "../businessApi";
import { fonts, radius, spacing, type Palette } from "../theme";
import { useTheme } from "../theme-mode";

export function OrderRow({
  order,
  onPress,
}: {
  order: BusinessOrder;
  onPress?: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = orderTone(order.status);
  const body = (
    <>
      <View style={styles.orderTop}>
        <Text style={styles.orderDesign} numberOfLines={1}>
          {order.design_title}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: tone }]}>
          <Text style={styles.statusPillText}>{order.stage_name || order.status}</Text>
        </View>
      </View>
      <Text style={styles.orderCustomer} numberOfLines={1}>
        {order.customer_name} · {order.channel}
      </Text>
      <View style={styles.orderBottom}>
        <Text style={styles.orderTotal}>
          {order.agreed_total_minor === null &&
          order.payment_amount_minor === null
            ? "Not set"
            : formatGHS(
                (order.agreed_total_minor ?? order.payment_amount_minor) as number,
              )}
        </Text>
        <Text style={styles.orderSettled}>
          {formatGHS(order.settled_minor)} settled
        </Text>
      </View>
    </>
  );
  if (!onPress) return <View style={styles.orderRow}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.orderRow, pressed && { opacity: 0.85 }]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    orderRow: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
      gap: spacing(0.75),
    },
    orderTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    orderDesign: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 17,
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
    orderCustomer: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    orderBottom: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing(1.25),
      marginTop: spacing(0.5),
    },
    orderTotal: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.burgundy,
    },
    orderSettled: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
    },
  });
