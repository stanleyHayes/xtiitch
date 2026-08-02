import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { formatOrderDate } from "../../../../src/businessApi";
import {
  businessOpsApi,
  type BookingSummary,
} from "../../../../src/businessOpsApi";
import { fonts, radius, spacing, type Palette } from "../../../../src/theme";
import { useTheme } from "../../../../src/theme-mode";
import {
  parseDateInput,
  parseTimeInput,
  slotTime,
  toLocalRfc3339,
} from "./timeInput";

type AppointmentsSectionProps = {
  bookings: BookingSummary[];
  onChanged: () => Promise<void>;
  onExpired: () => void;
};

// Appointments list for the bookings screen. Booked/held rows carry Cancel
// (confirmed via Alert) and an inline Reschedule form; both refetch via
// onChanged after the mutation lands.
export default function AppointmentsSection({
  bookings,
  onChanged,
  onExpired,
}: AppointmentsSectionProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [busy, setBusy] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const runCancel = async (booking: BookingSummary) => {
    setBusy(true);
    const result = await businessOpsApi.cancelBooking(booking.booking_id);
    setBusy(false);
    if (result.ok) {
      await onChanged();
    } else if (result.expired) {
      onExpired();
    } else {
      Alert.alert("Couldn't cancel", "Check your connection and try again.");
    }
  };

  const confirmCancel = (booking: BookingSummary) => {
    Alert.alert(
      "Cancel this booking?",
      `${booking.customer_name} · ${slotLabel(booking)}`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: () => void runCancel(booking),
        },
      ],
    );
  };

  if (bookings.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No appointments yet</Text>
        <Text style={styles.emptyHint}>
          Fitting and pickup bookings will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {bookings.map((booking) => {
        const actionable =
          booking.status === "booked" || booking.status === "held";
        return (
          <View key={booking.booking_id} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {booking.design_title}
              </Text>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: statusTone(booking.status, palette) },
                ]}
              >
                <Text style={styles.pillText}>{booking.status}</Text>
              </View>
            </View>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {booking.customer_name}
              {booking.customer_phone ? ` · ${booking.customer_phone}` : ""}
            </Text>
            <Text style={styles.rowMeta}>{slotLabel(booking)}</Text>
            {booking.address ? (
              <Text style={styles.rowMeta} numberOfLines={2}>
                {booking.address}
              </Text>
            ) : null}

            {actionable ? (
              <View style={styles.actions}>
                <Pressable
                  disabled={busy}
                  hitSlop={8}
                  onPress={() =>
                    setReschedulingId((current) =>
                      current === booking.booking_id
                        ? null
                        : booking.booking_id,
                    )
                  }
                >
                  <Text style={styles.actionReschedule}>Reschedule</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  hitSlop={8}
                  onPress={() => confirmCancel(booking)}
                >
                  <Text style={styles.actionCancel}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}

            {reschedulingId === booking.booking_id ? (
              <RescheduleForm
                booking={booking}
                onDone={async (changed) => {
                  setReschedulingId(null);
                  if (changed) await onChanged();
                }}
                onExpired={onExpired}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function RescheduleForm({
  booking,
  onDone,
  onExpired,
}: {
  booking: BookingSummary;
  onDone: (changed: boolean) => Promise<void>;
  onExpired: () => void;
}) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const day = parseDateInput(dateInput);
    const minutes = parseTimeInput(timeInput);
    if (!day || minutes === null) {
      setError("Enter a valid date (YYYY-MM-DD) and time (HH:MM).");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await businessOpsApi.rescheduleBooking(
      booking.booking_id,
      toLocalRfc3339(day, minutes),
    );
    setSaving(false);
    if (result.ok) {
      await onDone(true);
    } else if (result.expired) {
      onExpired();
    } else {
      // The API 409s (slot_unavailable) when the replacement slot is taken —
      // only then claim the slot is gone; anything else is a generic failure.
      setError(
        result.error === "upstream_409"
          ? "That slot is no longer available."
          : "Could not reschedule that appointment. Please try again.",
      );
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>New date</Text>
      <TextInput
        value={dateInput}
        onChangeText={setDateInput}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={palette.mutedText}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        style={styles.input}
      />
      <Text style={styles.formLabel}>New time</Text>
      <TextInput
        value={timeInput}
        onChangeText={setTimeInput}
        placeholder="HH:MM"
        placeholderTextColor={palette.mutedText}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={saving}
        onPress={() => void submit()}
        style={[styles.saveButton, saving && styles.ctaDisabled]}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Saving…" : "Confirm new slot"}
        </Text>
      </Pressable>
      <Pressable disabled={saving} onPress={() => void onDone(false)}>
        <Text style={styles.linkBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function slotLabel(booking: BookingSummary): string {
  const start = slotTime(booking.slot_start);
  const end = slotTime(booking.slot_end);
  const range = end ? `${start}–${end}` : start;
  return `${formatOrderDate(booking.slot_start)}${range ? ` · ${range}` : ""}`;
}

// booked keeps the brand tone, completed is success, cancelled/rescheduled go
// muted; held (deposit pending) reads as warning.
function statusTone(status: string, palette: Palette): string {
  switch (status) {
    case "booked":
      return palette.burgundy;
    case "completed":
      return palette.success;
    case "held":
      return palette.warning;
    default:
      return palette.mutedText;
  }
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    list: { gap: spacing(1.5) },
    row: {
      backgroundColor: palette.white,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(2),
      gap: spacing(0.75),
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing(1),
    },
    rowTitle: {
      flex: 1,
      fontFamily: fonts.display,
      fontSize: 17,
      color: palette.ink,
    },
    pill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
    },
    pillText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    rowMeta: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing(2),
      marginTop: spacing(0.5),
    },
    actionReschedule: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.burgundy,
    },
    actionCancel: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.danger,
    },
    form: {
      marginTop: spacing(1),
      borderTopWidth: 1,
      borderTopColor: palette.softBorder,
      paddingTop: spacing(1.5),
      gap: spacing(1),
    },
    formLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.ink,
    },
    input: {
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
    error: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.danger,
    },
    saveButton: {
      backgroundColor: palette.burgundy,
      borderRadius: radius.pill,
      paddingVertical: spacing(1.5),
      alignItems: "center",
    },
    saveButtonText: {
      color: palette.onAccent,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
    },
    ctaDisabled: { backgroundColor: palette.mauve },
    linkBtnText: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "700",
      color: palette.mutedText,
      textAlign: "center",
    },
    empty: {
      backgroundColor: palette.panel,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: palette.softBorder,
      padding: spacing(3),
      alignItems: "center",
    },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: palette.ink,
    },
    emptyHint: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      textAlign: "center",
      marginTop: spacing(0.75),
      lineHeight: 20,
    },
  });
