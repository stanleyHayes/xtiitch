import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../src/api";
import type { CustomerOrder } from "../../../src/customerOrders";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { CenterState } from "../../../src/ui";
import OrderActions from "./OrderActions";

export type OrdersState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; orders: CustomerOrder[] };

// The signed-in customer's order list with per-order actions. Tapping a row's
// body opens tracking; the action row underneath mutates and asks the parent
// to refresh via onChanged.
export default function OrderHistory({
  state,
  onRetry,
  onOpen,
  onChanged,
  onSessionExpired,
}: {
  state: OrdersState;
  onRetry: () => void;
  onOpen: (orderId: string) => void;
  onChanged: () => void;
  onSessionExpired: () => void;
}) {
  const styles = useThemedStyles();
  if (state.phase === "loading") return <CenterState loading />;
  if (state.phase === "error") {
    return (
      <CenterState
        title="Couldn't load your orders"
        hint="Check your connection and retry."
        onRetry={onRetry}
      />
    );
  }
  if (state.orders.length === 0) {
    return (
      <CenterState
        title="No orders yet"
        hint="Pieces you order while signed in will show up here."
      />
    );
  }
  return (
    <View style={styles.list}>
      {state.orders.map((order) => (
        <OrderHistoryRow
          key={order.order_id}
          order={order}
          onPress={() => onOpen(order.order_id)}
          onChanged={onChanged}
          onSessionExpired={onSessionExpired}
        />
      ))}
    </View>
  );
}

function OrderHistoryRow({
  order,
  onPress,
  onChanged,
  onSessionExpired,
}: {
  order: CustomerOrder;
  onPress: () => void;
  onChanged: () => void;
  onSessionExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles();
  return (
    <View style={styles.orderRow}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <View style={styles.orderTop}>
          <Text style={styles.orderDesign} numberOfLines={1}>
            {order.design_title}
          </Text>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: statusTone(order.status, palette) },
            ]}
          >
            <Text style={styles.statusPillText}>{order.status}</Text>
          </View>
        </View>
        <Text style={styles.orderStore} numberOfLines={1}>
          {order.business_name}
        </Text>
        <View style={styles.orderBottom}>
          <Text style={styles.orderTotal}>
            {formatGHS(order.agreed_total_minor)}
          </Text>
          <Text style={styles.orderDate}>
            {formatOrderDate(order.created_at)}
          </Text>
        </View>
      </Pressable>
      <OrderActions
        order={order}
        onChanged={onChanged}
        onSessionExpired={onSessionExpired}
      />
    </View>
  );
}

// Status pill colours, mirroring the business lane's orderTone mapping.
function statusTone(status: string, palette: Palette): string {
  switch (status.toLowerCase()) {
    case "fulfilled":
      return palette.success;
    case "cancelled":
      return palette.danger;
    case "confirmed":
      return palette.warning;
    case "draft":
    case "awaiting_deposit":
      return palette.info;
    default:
      return palette.burgundy;
  }
}

function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function useThemedStyles() {
  const { palette } = useTheme();
  return useMemo(() => makeStyles(palette), [palette]);
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { gap: spacing(1.5) },
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
    orderStore: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.75),
    },
    orderBottom: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: spacing(1.25),
    },
    orderTotal: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.burgundy,
    },
    orderDate: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
    },
  });
