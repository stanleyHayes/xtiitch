import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CustomerSessionExpiredError } from "../../../src/customerAuth";
import {
  canMarkReceived,
  closeOrder,
  isPayableDraft,
  markBasketReceived,
  markOrderReceived,
  requestOrderPaymentLink,
  type ActionOutcome,
  type CustomerOrder,
} from "../../../src/customerOrders";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { LoadingButtonLabel } from "../../../src/ui";

type BusyAction = "pay" | "close" | "received" | null;

// Per-order customer actions, rendered inside the order card: pay a draft,
// close a draft, acknowledge receipt (single order or whole basket), and call
// the store. Mutating actions confirm first and refresh the list via
// onChanged; errors render inline under the buttons.
// eslint-disable-next-line max-lines-per-function, complexity -- all customer order commands
export default function OrderActions({
  order,
  onChanged,
  onSessionExpired,
}: {
  order: CustomerOrder;
  onChanged: () => void;
  onSessionExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const payable = isPayableDraft(order);
  const isDraft = order.status.toLowerCase() === "draft";
  const receivable = canMarkReceived(order);
  const callable = order.store_phone.trim() !== "";

  // Shared runner for the confirm-then-post actions: surfaces the API's
  // friendly error inline, refreshes on success, drops to sign-in on expiry.
  const run = async (
    action: Exclude<BusyAction, null>,
    fn: () => Promise<ActionOutcome>,
  ) => {
    setBusy(action);
    setError(null);
    try {
      const outcome = await fn();
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      onChanged();
    } catch (err) {
      if (err instanceof CustomerSessionExpiredError) {
        onSessionExpired();
      } else {
        setError("Network error — check your connection and retry.");
      }
    } finally {
      setBusy(null);
    }
  };

  const pay = async () => {
    setBusy("pay");
    setError(null);
    setReference(null);
    try {
      const outcome = await requestOrderPaymentLink(order.order_id);
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      // Keep the reference visible so the customer can quote it to the store.
      setReference(outcome.reference);
      void Linking.openURL(outcome.authorization_url).catch(() =>
        setError(
          "Couldn't open the payment page — quote the reference below to the store.",
        ),
      );
    } catch (err) {
      if (err instanceof CustomerSessionExpiredError) {
        onSessionExpired();
      } else {
        setError("Network error — check your connection and retry.");
      }
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    // Closing one line of a basket closes the WHOLE basket server-side — the
    // confirmation must say so.
    const isBasketLine = order.checkout_group_id !== null;
    Alert.alert(
      "Close this order?",
      isBasketLine
        ? "This order is part of a basket — closing it will close the whole basket. This cannot be undone."
        : "The store will be told you no longer want this piece. This cannot be undone.",
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Close order",
          style: "destructive",
          onPress: () => void run("close", () => closeOrder(order.order_id)),
        },
      ],
    );
  };

  const received = () => {
    const markOne = () =>
      void run("received", () => markOrderReceived(order.order_id));
    if (order.checkout_group_id) {
      const groupId = order.checkout_group_id;
      Alert.alert(
        "Mark as received?",
        "This order is part of a basket — mark just this piece, or everything in the basket.",
        [
          {
            text: "Mark whole basket received",
            onPress: () =>
              void run("received", () => markBasketReceived(groupId)),
          },
          { text: "Just this order", onPress: markOne },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }
    Alert.alert(
      "Mark as received?",
      "Only do this once the piece is in your hands.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Mark received", onPress: markOne },
      ],
    );
  };

  const call = () => {
    void Linking.openURL(`tel:${order.store_phone}`).catch(() =>
      setError("Couldn't start the call."),
    );
  };

  if (!payable && !isDraft && !receivable && !callable) return null;

  const disabled = busy !== null;

  return (
    <View style={styles.wrap}>
      <View style={styles.primaryRow}>
        {payable ? (
          <Pressable
            disabled={disabled}
            onPress={() => void pay()}
            style={[styles.payButton, disabled && styles.buttonDisabled]}
          >
            {busy === "pay" ? (
              <LoadingButtonLabel label="Starting" />
            ) : (
              <Text style={styles.payButtonText}>Pay now</Text>
            )}
          </Pressable>
        ) : null}
        {receivable ? (
          <Pressable
            disabled={disabled}
            onPress={received}
            style={[styles.receivedButton, disabled && styles.buttonDisabled]}
          >
            <Text style={styles.receivedButtonText}>
              {busy === "received" ? "Marking…" : "Mark received"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.linkRow}>
        {callable ? (
          <Pressable
            onPress={call}
            disabled={disabled}
            style={styles.linkButton}
            hitSlop={8}
          >
            <Ionicons name="call-outline" size={14} color={palette.burgundy} />
            <Text style={styles.linkText}>Call store</Text>
          </Pressable>
        ) : null}
        {isDraft ? (
          <Pressable
            onPress={close}
            disabled={disabled}
            style={styles.linkButton}
            hitSlop={8}
          >
            <Text style={styles.closeText}>
              {busy === "close" ? "Closing…" : "Close"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {reference ? (
        <View style={styles.referenceBox}>
          <Text style={styles.referenceLabel}>Payment reference</Text>
          <Text style={styles.referenceValue}>{reference}</Text>
          <Text style={styles.referenceHint}>
            Quote this if the store asks about your payment.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    wrap: { gap: spacing(1.25), marginTop: spacing(0.5) },
    primaryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing(1.25),
    },
    payButton: {
      flexGrow: 1,
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    payButtonText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    receivedButton: {
      flexGrow: 1,
      backgroundColor: palette.success,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    receivedButtonText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    buttonDisabled: { opacity: 0.5 },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(2.5),
    },
    linkButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(0.75),
    },
    linkText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.burgundy,
    },
    closeText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.danger,
    },
    referenceBox: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(1.5),
      gap: spacing(0.25),
    },
    referenceLabel: {
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: palette.mutedText,
    },
    referenceValue: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.ink,
    },
    referenceHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.danger,
    },
  });
