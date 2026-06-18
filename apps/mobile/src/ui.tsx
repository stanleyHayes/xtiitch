// Shared presentational helpers: a centred loading / empty / error state, a
// brand image-or-swatch tile, and the studio order row — so every screen
// handles async outcomes and renders orders the same way.
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { formatGHS } from "./api";
import { orderTone, type BusinessOrder } from "./businessApi";
import { fonts, palette, radius, spacing, swatchFor } from "./theme";

export function CenterState({
  loading,
  title,
  hint,
}: {
  loading?: boolean;
  title?: string;
  hint?: string;
}) {
  return (
    <View style={styles.center}>
      {loading ? (
        <ActivityIndicator size="large" color={palette.burgundy} />
      ) : (
        <>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </>
      )}
    </View>
  );
}

export function ImageTile({
  uri,
  seed,
  style,
  radiusOverride,
}: {
  uri?: string | null;
  seed: string;
  style?: object;
  radiusOverride?: number;
}) {
  const [from, to] = swatchFor(seed);
  const borderRadius = radiusOverride ?? radius.md;
  if (uri) {
    return <Image source={{ uri }} style={[{ borderRadius }, style]} />;
  }
  return (
    <View style={[{ backgroundColor: from, borderRadius }, styles.swatch, style]}>
      <View style={[styles.swatchBar, { backgroundColor: to }]} />
    </View>
  );
}

export function OrderRow({ order }: { order: BusinessOrder }) {
  const tone = orderTone(order.status);
  return (
    <View style={styles.orderRow}>
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
        <Text style={styles.orderTotal}>{formatGHS(order.agreed_total_minor)}</Text>
        <Text style={styles.orderSettled}>
          {formatGHS(order.settled_minor)} settled
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(4),
    gap: spacing(1),
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    textAlign: "center",
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.mutedText,
    textAlign: "center",
    lineHeight: 20,
  },
  swatch: { justifyContent: "flex-end", overflow: "hidden" },
  swatchBar: { height: "32%", width: "60%", opacity: 0.7 },
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
    color: palette.white,
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
  orderSettled: { fontFamily: fonts.body, fontSize: 12, color: palette.mutedText },
});
