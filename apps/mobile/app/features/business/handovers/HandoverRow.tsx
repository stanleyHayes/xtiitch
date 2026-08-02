import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatOrderDate,
  type HandoverSummary,
} from "../../../../src/businessApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// Handover lifecycle (src/businessApi.ts): pending → dispatched → completed
// for delivery, pending → completed for pickup, or cancelled. Mirrors the web
// dashboard's handoverTone (features/shared/utils.ts).
const STATUS_TONES: Record<string, keyof Palette> = {
  pending: "warning",
  dispatched: "info",
  completed: "success",
  cancelled: "mutedText",
};

function statusLabel(status: string): string {
  const lower = status.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// The advance button's verb depends on where the handover sits: a pending
// delivery gets dispatched, everything else completes.
export function advanceLabel(handover: HandoverSummary): string {
  if (
    handover.status.toLowerCase() === "pending" &&
    handover.method === "delivery"
  ) {
    return "Mark dispatched";
  }
  return "Mark completed";
}

export function canAdvance(handover: HandoverSummary): boolean {
  const status = handover.status.toLowerCase();
  if (status === "pending") return true;
  return status === "dispatched" && handover.method === "delivery";
}

export default function HandoverRow({
  handover,
  busy,
  onAdvance,
  onCancel,
}: {
  handover: HandoverSummary;
  busy: boolean;
  onAdvance: (handover: HandoverSummary) => void;
  onCancel: (handover: HandoverSummary) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const status = handover.status.toLowerCase();
  const toneKey = STATUS_TONES[status] ?? "burgundy";
  const tone = palette[toneKey];
  const advanceable = canAdvance(handover);
  const cancellable = status === "pending";
  const recipient = [handover.recipient_name, handover.recipient_phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {handover.design_title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {handover.customer_name || "Customer"} ·{" "}
            {formatOrderDate(handover.created_at)}
          </Text>
        </View>
      </View>

      <View style={styles.pillRow}>
        <View
          style={[styles.pill, { backgroundColor: `${palette.burgundy}14` }]}
        >
          <Text style={[styles.pillText, { color: palette.burgundy }]}>
            {handover.method === "delivery" ? "Delivery" : "Pickup"}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: `${tone}1a` }]}>
          <Text style={[styles.pillText, { color: tone }]}>
            {statusLabel(handover.status)}
          </Text>
        </View>
      </View>

      {recipient ? (
        <Text style={styles.detail}>Recipient: {recipient}</Text>
      ) : null}
      {handover.address ? (
        <Text style={styles.detail}>Address: {handover.address}</Text>
      ) : null}
      {handover.courier ? (
        <Text style={styles.detail}>Courier: {handover.courier}</Text>
      ) : null}
      {handover.note ? (
        <Text style={styles.detail}>{handover.note}</Text>
      ) : null}

      {advanceable || cancellable ? (
        <View style={styles.actions}>
          {advanceable ? (
            <Pressable
              disabled={busy}
              onPress={() => onAdvance(handover)}
              style={[styles.advance, busy && styles.actionDisabled]}
            >
              <Text style={styles.advanceText}>{advanceLabel(handover)}</Text>
            </Pressable>
          ) : null}
          {cancellable ? (
            <Pressable
              disabled={busy}
              onPress={() => onCancel(handover)}
              style={[styles.cancel, busy && styles.actionDisabled]}
              hitSlop={6}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
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
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    titleWrap: { flex: 1, minWidth: 0 },
    title: {
      fontFamily: fonts.display,
      fontSize: 16,
      fontWeight: "700",
      color: palette.ink,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.25),
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(1),
      marginTop: spacing(1.25),
    },
    pill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: 3,
    },
    pillText: {
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    detail: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
      marginTop: spacing(0.75),
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.5),
      marginTop: spacing(1.75),
    },
    advance: {
      flexGrow: 1,
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.25),
      alignItems: "center",
    },
    advanceText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    cancel: {
      borderWidth: 1.5,
      borderColor: palette.danger,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.25),
      alignItems: "center",
    },
    cancelText: {
      color: palette.danger,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    actionDisabled: { opacity: 0.5 },
  });
