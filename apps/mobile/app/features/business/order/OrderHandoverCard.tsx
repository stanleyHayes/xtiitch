import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { TrackingHandover } from "../../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import OrderDetailRow from "./OrderDetailRow";

// Same status labels as the customer tracking panel and the web storefront
// (features/track/utils.ts) — the merchant sees the same delivery state.
const handoverStatusLabels: Record<string, string> = {
  pending: "Arranged",
  dispatched: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Compact business-side view of an order's handover block: method + status up
// top, then recipient/courier rows and the free-text address/note. Rendered
// only when the public tracking payload carries a handover.
export default function OrderHandoverCard({
  handover,
}: {
  handover: TrackingHandover;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const isDelivery = handover.method === "delivery";
  const recipient = [handover.recipient_name, handover.recipient_phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.method}>{isDelivery ? "Delivery" : "Pickup"}</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>
            {handoverStatusLabels[handover.status] ?? "Handover"}
          </Text>
        </View>
      </View>
      {recipient ? <OrderDetailRow label="Recipient" value={recipient} /> : null}
      {handover.courier ? (
        <OrderDetailRow label="Courier" value={handover.courier} />
      ) : null}
      {isDelivery && handover.address ? (
        <Text style={styles.detail}>{handover.address}</Text>
      ) : null}
      {handover.note ? <Text style={styles.detail}>{handover.note}</Text> : null}
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
      paddingHorizontal: spacing(2),
      paddingBottom: spacing(1.5),
    },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.25),
      paddingVertical: spacing(1.5),
    },
    method: {
      fontFamily: fonts.display,
      fontSize: 16,
      fontWeight: "700",
      color: palette.ink,
    },
    chip: {
      backgroundColor: "rgba(128,0,32,0.08)",
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: 2,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      color: palette.burgundy,
    },
    detail: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
      marginTop: spacing(0.75),
    },
  });
