import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatGHS, type DeliveryZone } from "../../../src/api";
import { fonts, radius, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignField from "./DesignField";

export type DeliveryValues = {
  fulfilment: "pickup" | "delivery";
  zoneId: string;
  address: string;
};

type DesignDeliveryFieldsProps = {
  zones: DeliveryZone[] | null;
  values: DeliveryValues;
  onChange: (field: keyof DeliveryValues, next: string) => void;
};

// Pickup vs delivery chooser with the store's delivery zones and address —
// ports the fulfilment block of the web CheckoutForm (features/checkout/
// CheckoutForm.tsx). GPS capture is skipped: the API's order routes take only
// zone id + address.
export default function DesignDeliveryFields({
  zones,
  values,
  onChange,
}: DesignDeliveryFieldsProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const options: { value: "pickup" | "delivery"; label: string }[] = [
    { value: "pickup", label: "Pick up from the studio (free)" },
    { value: "delivery", label: "Deliver to me" },
  ];

  return (
    <View>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = values.fulfilment === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange("fulfilment", option.value)}
              style={[styles.option, active && styles.optionActive]}
            >
              <Text
                style={[styles.optionText, active && styles.optionTextActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {values.fulfilment === "delivery" ? (
        <View style={styles.deliveryBody}>
          {zones === null ? (
            <Text style={styles.muted}>Loading delivery areas…</Text>
          ) : zones.length === 0 ? (
            <Text style={styles.muted}>
              This shop hasn&apos;t set up delivery areas yet — pick up from the
              studio instead.
            </Text>
          ) : (
            <View style={styles.zoneList}>
              {zones.map((zone) => {
                const active = zone.zone_id === values.zoneId;
                return (
                  <Pressable
                    key={zone.zone_id}
                    onPress={() => onChange("zoneId", zone.zone_id)}
                    style={[styles.zoneChip, active && styles.optionActive]}
                  >
                    <Text
                      style={[
                        styles.zoneName,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {zone.name}
                    </Text>
                    <Text
                      style={[
                        styles.zoneFee,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {formatGHS(zone.fee_minor)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <DesignField
            label="Delivery address"
            value={values.address}
            onChange={(next) => onChange("address", next)}
            placeholder="House number, street, area, landmark"
            autoCapitalize="sentences"
            multiline
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    optionRow: { gap: spacing(1) },
    option: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      backgroundColor: palette.white,
    },
    optionActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    optionText: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    optionTextActive: { color: palette.burgundy },
    deliveryBody: { marginTop: spacing(1.75), gap: spacing(1.75) },
    muted: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: palette.mutedText,
      lineHeight: 20,
    },
    zoneList: { gap: spacing(1) },
    zoneChip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      backgroundColor: palette.white,
    },
    zoneName: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    zoneFee: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
    },
  });
