import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { NotificationSummary } from "../../../../src/businessAdminApi";
import { formatOrderDate } from "../../../../src/businessApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

// Human labels for the message kinds the API emits; anything new falls back to
// a de-underscored version of the raw kind.
const KIND_LABELS: Record<string, string> = {
  order_confirmed: "Order confirmed",
  order_stage_advanced: "Stage update",
  handover_dispatched: "Handover dispatched",
  new_order_owner: "New order",
  subscription_renewal_upcoming: "Renewal upcoming",
  subscription_renewal_past_due: "Renewal past due",
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

function channelLabel(channel: string): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "sms") return "SMS";
  return channel.toUpperCase();
}

function statusTone(status: string, palette: Palette): string {
  const value = status.toLowerCase();
  if (value === "delivered" || value === "sent") return palette.success;
  if (value === "failed" || value === "bounced") return palette.danger;
  return palette.mutedText;
}

export function NotificationRow({
  notification,
}: {
  notification: NotificationSummary;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = statusTone(notification.status, palette);
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.kind}>{kindLabel(notification.kind)}</Text>
        <View style={styles.channelChip}>
          <Text style={styles.channelChipText}>
            {channelLabel(notification.channel)}
          </Text>
        </View>
      </View>
      <Text style={styles.recipient}>{notification.recipient}</Text>
      <Text style={styles.meta}>
        <Text style={[styles.status, { color: tone }]}>
          {notification.status}
        </Text>
        {notification.attempts > 1
          ? ` · ${notification.attempts} attempts`
          : ""}
        {` · ${formatOrderDate(notification.created_at)}`}
      </Text>
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
      gap: spacing(1),
    },
    kind: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    channelChip: {
      borderRadius: radius.pill,
      backgroundColor: palette.wineTint,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    channelChipText: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      color: palette.burgundy,
    },
    recipient: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.5),
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(1),
    },
    status: { fontWeight: "700", textTransform: "capitalize" },
  });
