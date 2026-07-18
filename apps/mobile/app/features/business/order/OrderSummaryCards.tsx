import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatGHS } from "../../../../src/api";
import {
  formatOrderDate,
  orderTone,
  paymentStatusLabel,
  type BusinessOrder,
} from "../../../../src/businessApi";
import { fonts, radius, shadow, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import OrderDetailRow from "./OrderDetailRow";

// The effective money target of an order: the negotiated total for bespoke,
// the checkout amount for online orders (web dashboard features/orders/utils.ts).
function orderTargetMinor(order: BusinessOrder): number | null {
  return order.agreed_total_minor ?? order.payment_amount_minor;
}

export function balanceDueMinor(order: BusinessOrder): number {
  const target = orderTargetMinor(order);
  return target === null ? 0 : Math.max(target - order.settled_minor, 0);
}

function formatOrderTotal(order: BusinessOrder): string {
  const target = orderTargetMinor(order);
  return target === null ? "Not set" : formatGHS(target);
}

// The web builds the wa.me link from customer_whatsapp, falling back to phone.
function whatsappNumber(order: BusinessOrder): string {
  return order.customer_whatsapp || order.customer_phone;
}

export function OrderHeaderCard({ order }: { order: BusinessOrder }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const tone = orderTone(order.status);
  return (
    <View style={styles.headerCard}>
      <Text style={styles.design}>{order.design_title}</Text>
      <View style={[styles.statusPill, { backgroundColor: tone }]}>
        <Text style={styles.statusPillText}>{order.stage_name || order.status}</Text>
      </View>
      <Text style={styles.meta}>
        {order.order_type} · {order.channel} · {formatOrderDate(order.created_at)}
      </Text>
    </View>
  );
}

export function CustomerCard({ order }: { order: BusinessOrder }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const whatsapp = whatsappNumber(order);
  return (
    <View style={styles.card}>
      <OrderDetailRow label="Name" value={order.customer_name} />
      <OrderDetailRow
        label="Phone"
        value={order.customer_phone || "—"}
        href={
          order.customer_phone
            ? `tel:${order.customer_phone.replace(/\s+/g, "")}`
            : undefined
        }
      />
      <OrderDetailRow
        label="Email"
        value={order.customer_email || "—"}
        href={order.customer_email ? `mailto:${order.customer_email}` : undefined}
      />
      {whatsapp ? (
        <OrderDetailRow
          label="WhatsApp"
          value={whatsapp}
          href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`}
        />
      ) : null}
    </View>
  );
}

export function PaymentCard({ order }: { order: BusinessOrder }) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const target = orderTargetMinor(order);
  const balance = balanceDueMinor(order);
  const balanceTone = balance > 0 ? palette.warning : palette.success;
  return (
    <View style={styles.card}>
      <OrderDetailRow label="Agreed total" value={formatOrderTotal(order)} strong />
      <OrderDetailRow label="Settled" value={formatGHS(order.settled_minor)} />
      <OrderDetailRow
        label="Balance due"
        value={target === null ? "—" : formatGHS(balance)}
        strong={target !== null && balance > 0}
        tone={target === null ? undefined : balanceTone}
      />
      <OrderDetailRow label="Payment status" value={paymentStatusLabel(order)} />
    </View>
  );
}

// The API fulfils an order by advancing it PAST its final stage, so advance
// must stay enabled for the whole confirmed lifecycle. Every other status
// hides the action — fulfilled gets a labelled disabled state, matching the
// web dashboard's OrderActions gating.
export function AdvanceFooter({
  status,
  advancing,
  onAdvance,
}: {
  status: string;
  advancing: boolean;
  onAdvance: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const value = status.toLowerCase();
  if (value === "fulfilled") {
    return (
      <View style={[styles.cta, styles.ctaDisabled]}>
        <Text style={styles.ctaText}>Order complete</Text>
      </View>
    );
  }
  if (value !== "confirmed") return null;
  return (
    <Pressable
      disabled={advancing}
      onPress={onAdvance}
      style={[styles.cta, advancing && styles.ctaDisabled]}
    >
      <Text style={styles.ctaText}>
        {advancing ? "Advancing…" : "Advance to next stage"}
      </Text>
    </Pressable>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    headerCard: {
      backgroundColor: palette.white,
      borderRadius: radius.lg,
      padding: spacing(3),
      ...shadow.card,
    },
    design: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: palette.ink,
      fontWeight: "700",
    },
    statusPill: {
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(0.75),
      marginTop: spacing(1.5),
    },
    statusPillText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontWeight: "800",
      fontSize: 13,
      textTransform: "capitalize",
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(1.5),
      textTransform: "capitalize",
    },
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      paddingHorizontal: spacing(2),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
      marginTop: spacing(3),
    },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
  });
