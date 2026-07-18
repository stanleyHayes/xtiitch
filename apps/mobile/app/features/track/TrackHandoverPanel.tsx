import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { TrackingHandover } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";

// Ports the web storefront's handover labels (features/track/utils.ts).
const handoverStatusLabels: Record<string, string> = {
  pending: "Arranged",
  dispatched: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatHandoverMethod(method: string): string {
  return method === "delivery" ? "Delivery" : "Pickup";
}

function formatHandoverStatus(status: string): string {
  return handoverStatusLabels[status] ?? "Handover";
}

type TrackHandoverPanelProps = {
  handover: TrackingHandover;
};

// RN-styled port of the web HandoverPanel: method + status chip up top, then
// address/recipient/courier/note details for the handover of a finished piece.
export default function TrackHandoverPanel({
  handover,
}: TrackHandoverPanelProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const isDelivery = handover.method === "delivery";

  return (
    <View style={styles.panel}>
      <View style={styles.headRow}>
        <Text style={styles.method}>{formatHandoverMethod(handover.method)}</Text>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>
            {formatHandoverStatus(handover.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.body}>
        {isDelivery
          ? handover.address || "Delivery details are being finalised."
          : "Pickup is handled directly with the store."}
      </Text>
      {handover.recipient_name || handover.recipient_phone ? (
        <Text style={styles.detail}>
          {handover.recipient_name}
          {handover.recipient_name && handover.recipient_phone ? " · " : ""}
          {handover.recipient_phone}
        </Text>
      ) : null}
      {handover.courier ? (
        <Text style={styles.detail}>Courier: {handover.courier}</Text>
      ) : null}
      {handover.note ? <Text style={styles.detail}>{handover.note}</Text> : null}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    panel: {
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      padding: spacing(2),
      marginTop: spacing(2),
    },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.25),
    },
    method: {
      fontFamily: fonts.display,
      fontSize: 16,
      fontWeight: "700",
      color: palette.ink,
    },
    statusChip: {
      backgroundColor: "rgba(128,0,32,0.08)",
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: 2,
    },
    statusChipText: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      color: palette.burgundy,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
      marginTop: spacing(1),
    },
    detail: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
      marginTop: spacing(0.75),
    },
  });
