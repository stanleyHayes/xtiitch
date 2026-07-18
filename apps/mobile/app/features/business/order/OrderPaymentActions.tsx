import { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { businessApi, type BusinessOrder, type CollectBalanceResult } from "../../../../src/businessApi";
import { formatGHS } from "../../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type OrderPaymentActionsProps = {
  order: BusinessOrder;
  orderId: string;
  balanceMinor: number;
  // The signed-in merchant's role from businessApi.me() — null while unknown.
  role: string | null;
  onLoad: () => Promise<void>;
  onExpired: () => void;
  onSetError: (message: string | null) => void;
};

// The API 403s staff on money management and restricts set-agreed-total and
// collect-balance to confirmed bespoke orders (apps/api
// internal/application/order/service.go). Collect also needs an agreed total
// and a customer email for the Paystack charge.
function canManageMoney(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

function moneyActionHint(order: BusinessOrder, manage: boolean): string {
  if (!manage) return "Only the owner or an admin can manage payments.";
  if (order.order_type !== "custom") {
    return "Standard orders are paid through the online checkout.";
  }
  return "Set an agreed total and add a customer email to collect the balance online.";
}

export default function OrderPaymentActions({
  order,
  orderId,
  balanceMinor,
  role,
  onLoad,
  onExpired,
  onSetError,
}: OrderPaymentActionsProps) {
  const { palette } = useTheme();
  const styles = useMemoStyles(palette);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalInput, setTotalInput] = useState("");
  const [savingTotal, setSavingTotal] = useState(false);

  const manage = canManageMoney(role);
  const customConfirmed =
    order.order_type === "custom" && order.status === "confirmed";
  const canAdjustTotal = manage && customConfirmed;
  const canCollect =
    canAdjustTotal &&
    order.agreed_total_minor !== null &&
    order.customer_email.trim().length > 0;
  const showSettled = order.agreed_total_minor !== null && balanceMinor <= 0;

  const openEditor = () => {
    const minor = order.agreed_total_minor;
    setTotalInput(minor === null ? "" : (minor / 100).toFixed(2));
    onSetError(null);
    setEditingTotal(true);
  };

  const saveTotal = async () => {
    if (!orderId) return;
    const minor = Math.round(Number.parseFloat(totalInput) * 100);
    // The API 400s a zero agreed total — a new total must be positive.
    if (!Number.isFinite(minor) || minor <= 0) {
      onSetError("Enter an amount greater than zero.");
      return;
    }
    setSavingTotal(true);
    onSetError(null);
    const result = await businessApi.setAgreedTotal(orderId, minor);
    setSavingTotal(false);
    if (result.ok) {
      setEditingTotal(false);
      await onLoad();
    } else if (result.expired) {
      onExpired();
    } else {
      onSetError("Couldn't update the agreed total.");
    }
  };

  return (
    <View style={styles.card}>
      {canAdjustTotal ? (
        <>
          {editingTotal ? (
            <View style={styles.editBlock}>
              <Text style={styles.editLabel}>New agreed total (GH₵)</Text>
              <View style={styles.editRow}>
                <TextInput
                  value={totalInput}
                  onChangeText={setTotalInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={palette.mutedText}
                  style={styles.input}
                />
                <Pressable
                  disabled={savingTotal}
                  onPress={saveTotal}
                  style={[styles.smallPrimary, savingTotal && styles.ctaDisabled]}
                >
                  <Text style={styles.smallPrimaryText}>
                    {savingTotal ? "…" : "Save"}
                  </Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setEditingTotal(false)}>
                <Text style={styles.linkBtnText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.actionRow} onPress={openEditor}>
              <Text style={styles.actionTitle}>Adjust agreed total</Text>
              <Text style={styles.actionArrow}>›</Text>
            </Pressable>
          )}
          <View style={styles.divider} />
        </>
      ) : null}

      {canCollect ? (
        <CollectBalanceSection
          key={order.agreed_total_minor ?? "unset"}
          orderId={orderId}
          balanceMinor={balanceMinor}
          onLoad={onLoad}
          onExpired={onExpired}
          onSetError={onSetError}
        />
      ) : showSettled ? (
        <Text style={styles.settled}>Balance fully settled.</Text>
      ) : (
        <Text style={styles.hint}>{moneyActionHint(order, manage)}</Text>
      )}
    </View>
  );
}

// The key on usage remounts this when the agreed total changes, so a stale
// payment link never survives a new total.
function CollectBalanceSection({
  orderId,
  balanceMinor,
  onLoad,
  onExpired,
  onSetError,
}: {
  orderId: string;
  balanceMinor: number;
  onLoad: () => Promise<void>;
  onExpired: () => void;
  onSetError: (message: string | null) => void;
}) {
  const { palette } = useTheme();
  const styles = useMemoStyles(palette);
  const [collectMethod, setCollectMethod] = useState<"momo" | "card">("momo");
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] =
    useState<CollectBalanceResult | null>(null);

  const collect = async () => {
    if (!orderId) return;
    setCollecting(true);
    onSetError(null);
    const result = await businessApi.collectBalance(orderId, collectMethod);
    setCollecting(false);
    if (result.ok) {
      setCollectResult(result.data);
      await onLoad();
    } else if (result.expired) {
      onExpired();
    } else {
      onSetError("Couldn't raise a payment link for this balance.");
    }
  };

  if (balanceMinor <= 0 && !collectResult) {
    return <Text style={styles.settled}>Balance fully settled.</Text>;
  }

  if (collectResult) {
    return (
      <View style={styles.editBlock}>
        <Text style={styles.linkRaised}>
          Payment link raised · {formatGHS(collectResult.amount_minor)}
        </Text>
        <Text style={styles.reference}>Ref {collectResult.reference}</Text>
        <Pressable
          style={styles.smallPrimaryWide}
          onPress={() => void Linking.openURL(collectResult.authorization_url)}
        >
          <Text style={styles.smallPrimaryText}>Open payment link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.editBlock}>
      <Text style={styles.editLabel}>
        Collect balance · {formatGHS(balanceMinor)}
      </Text>
      <View style={styles.methodRow}>
        {(["momo", "card"] as const).map((method) => {
          const active = collectMethod === method;
          return (
            <Pressable
              key={method}
              onPress={() => setCollectMethod(method)}
              style={[styles.method, active && styles.methodActive]}
            >
              <Text
                style={[styles.methodText, active && styles.methodTextActive]}
              >
                {method === "momo" ? "Mobile money" : "Card"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        disabled={collecting}
        onPress={collect}
        style={[styles.smallPrimaryWide, collecting && styles.ctaDisabled]}
      >
        <Text style={styles.smallPrimaryText}>
          {collecting ? "Raising link…" : "Send payment link"}
        </Text>
      </Pressable>
    </View>
  );
}

function useMemoStyles(palette: Palette) {
  return useMemo(() => makeStyles(palette), [palette]);
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      paddingHorizontal: spacing(2),
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing(1.75),
    },
    actionTitle: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "700",
      color: palette.burgundy,
    },
    actionArrow: { fontSize: 22, fontWeight: "700", color: palette.burgundy },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: palette.softBorder,
    },
    editBlock: { paddingVertical: spacing(1.75), gap: spacing(1.25) },
    editLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
    editRow: { flexDirection: "row", gap: spacing(1.25), alignItems: "center" },
    input: {
      flex: 1,
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
    smallPrimary: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2.5),
      paddingVertical: spacing(1.5),
    },
    smallPrimaryWide: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    smallPrimaryText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    linkBtnText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.mutedText,
    },
    settled: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.success,
      fontWeight: "700",
      paddingVertical: spacing(1.75),
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      lineHeight: 19,
      paddingVertical: spacing(1.75),
    },
    linkRaised: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: palette.success,
      fontWeight: "700",
    },
    reference: { fontFamily: fonts.body, fontSize: 12, color: palette.mutedText },
    methodRow: { flexDirection: "row", gap: spacing(1) },
    method: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingVertical: spacing(1.25),
      alignItems: "center",
      backgroundColor: palette.white,
    },
    methodActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    methodText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
    methodTextActive: { color: palette.burgundy },
    ctaDisabled: { backgroundColor: "rgba(128,0,32,0.4)" },
  });
