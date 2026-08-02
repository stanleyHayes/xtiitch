import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  businessApi,
  type ArrangeHandoverInput,
  type BusinessOrder,
} from "../../../../src/businessApi";
import { LoadingButtonLabel } from "../../../../src/ui";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";

type Method = ArrangeHandoverInput["method"];

const METHODS: { value: Method; label: string }[] = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
];

// Card for turning a fulfilled order into a pickup/delivery handover — the
// mobile counterpart of the web dashboard's HandoverPanel arrange form.
// `orders` is pre-filtered by the screen (fulfilled orders with no open
// handover).
// eslint-disable-next-line max-lines-per-function -- complete handover arranger
export default function ArrangeHandoverCard({
  orders,
  onArranged,
  onExpired,
}: {
  orders: BusinessOrder[];
  onArranged: () => void;
  onExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("pickup");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [courier, setCourier] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = Boolean(orderId) && !submitting;

  const submit = async () => {
    if (!orderId || submitting) return;
    setError(null);
    setSuccess(null);
    if (method === "delivery" && !address.trim()) {
      setError("Delivery needs an address.");
      return;
    }
    setSubmitting(true);
    const input: ArrangeHandoverInput = { order_id: orderId, method };
    if (recipientName.trim()) input.recipient_name = recipientName.trim();
    if (recipientPhone.trim()) input.recipient_phone = recipientPhone.trim();
    if (method === "delivery") input.address = address.trim();
    if (courier.trim()) input.courier = courier.trim();
    if (note.trim()) input.note = note.trim();
    const result = await businessApi.arrangeHandover(input);
    setSubmitting(false);
    if (result.ok) {
      setOrderId(null);
      setRecipientName("");
      setRecipientPhone("");
      setAddress("");
      setCourier("");
      setNote("");
      setSuccess("Handover arranged.");
      onArranged();
      return;
    }
    if (result.expired) {
      onExpired();
      return;
    }
    setError("Couldn't arrange the handover. Check the details and retry.");
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Arrange handover</Text>
      <Text style={styles.cardHint}>
        Turn an open order into a pickup or delivery.
      </Text>

      {orders.length === 0 ? (
        <Text style={styles.noOrders}>
          No fulfilled orders waiting for a handover.
        </Text>
      ) : (
        <View style={styles.orderList}>
          {orders.map((order) => {
            const active = order.order_id === orderId;
            return (
              <Pressable
                key={order.order_id}
                onPress={() => setOrderId(active ? null : order.order_id)}
                style={[styles.orderOption, active && styles.orderOptionActive]}
              >
                <Text
                  style={[styles.orderTitle, active && styles.orderTitleActive]}
                  numberOfLines={1}
                >
                  {order.design_title}
                </Text>
                <Text style={styles.orderSub} numberOfLines={1}>
                  {order.customer_name || "Customer"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.chipRow}>
        {METHODS.map((option) => {
          const active = method === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setMethod(option.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.form}>
        <Field
          label="Recipient name (optional)"
          value={recipientName}
          onChange={setRecipientName}
          placeholder="Esi Mensah"
        />
        <Field
          label="Recipient phone (optional)"
          value={recipientPhone}
          onChange={setRecipientPhone}
          placeholder="+233 50 123 4567"
          keyboardType="phone-pad"
        />
        {method === "delivery" ? (
          <Field
            label="Delivery address"
            value={address}
            onChange={setAddress}
            placeholder="House no., street, area"
          />
        ) : null}
        <Field
          label="Courier or rider (optional)"
          value={courier}
          onChange={setCourier}
          placeholder="Speedaf, in-house rider…"
        />
        <Field
          label="Note (optional)"
          value={note}
          onChange={setNote}
          placeholder="Call on arrival"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.cta, !canSubmit && styles.ctaDisabled]}
      >
        {submitting ? (
          <LoadingButtonLabel label="Arranging" />
        ) : (
          <Text style={styles.ctaText}>Arrange handover</Text>
        )}
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad";
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedText}
        autoCapitalize="words"
        autoCorrect={false}
        keyboardType={keyboardType}
        style={styles.input}
      />
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
    cardTitle: {
      fontFamily: fonts.display,
      fontSize: 18,
      fontWeight: "700",
      color: palette.ink,
    },
    cardHint: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      marginTop: spacing(0.5),
      marginBottom: spacing(1.75),
    },
    noOrders: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      marginBottom: spacing(1.75),
    },
    orderList: { gap: spacing(1), marginBottom: spacing(1.75) },
    orderOption: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(1.75),
      paddingVertical: spacing(1.25),
      backgroundColor: palette.white,
    },
    orderOptionActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.wineTint,
    },
    orderTitle: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      color: palette.ink,
    },
    orderTitleActive: { color: palette.burgundy },
    orderSub: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: palette.mutedText,
      marginTop: spacing(0.25),
    },
    chipRow: {
      flexDirection: "row",
      gap: spacing(1),
      marginBottom: spacing(1.75),
    },
    chip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      backgroundColor: palette.white,
    },
    chipActive: {
      borderColor: palette.burgundy,
      backgroundColor: palette.wineTint,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    chipTextActive: { color: palette.burgundy },
    form: { gap: spacing(1.75) },
    fieldLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
      marginBottom: spacing(0.75),
    },
    input: {
      backgroundColor: palette.white,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.75),
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
    },
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
      marginTop: spacing(2),
    },
    success: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.success,
      marginTop: spacing(2),
    },
    cta: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(2),
      alignItems: "center",
      marginTop: spacing(2.5),
    },
    ctaDisabled: { backgroundColor: palette.mauve },
    ctaText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 16,
      fontWeight: "800",
    },
  });
