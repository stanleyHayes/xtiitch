import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatGHS,
  type AvailabilitySlot,
  type CustomSizeMode,
  type Design,
  type PlaceOrderResult,
  type StoreSummary,
} from "../../../src/api";
import { fonts, radius, shadow, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import { bespokeRoutes, resolveDepositMinor } from "./bespoke-routes";
import DesignHomeVisitForm from "./DesignHomeVisitForm";
import DesignSelfMeasureForm from "./DesignSelfMeasureForm";
import DesignShopReserveForm from "./DesignShopReserveForm";

type DesignBespokePanelProps = {
  design: Design;
  store: StoreSummary;
  visitSlots: AvailabilitySlot[];
  onOrdered: (order: PlaceOrderResult) => void;
};

// The "Customise this piece" panel: deposit summary, the three measurement
// routes, then the active route's form. Ports the web storefront's
// BespokeCustomise (features/design/bespoke-forms.tsx).
export default function DesignBespokePanel({
  design,
  store,
  visitSlots,
  onOrdered,
}: DesignBespokePanelProps) {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const depositMinor = resolveDepositMinor(design, store);
  const depositLabel = formatGHS(depositMinor);
  const routes = useMemo(
    () => bespokeRoutes(store, depositLabel, visitSlots),
    [store, depositLabel, visitSlots],
  );
  const [selectedMode, setSelectedMode] = useState<CustomSizeMode | null>(null);
  const activeRoute = routes.find((route) => route.mode === selectedMode) ?? null;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Customise this piece</Text>
      <Text style={styles.subtitle}>
        Choose how you&apos;d like to be measured. The bespoke deposit is the
        same for every option.
      </Text>

      <View style={styles.depositRow}>
        <Text style={styles.depositLabel}>Bespoke deposit</Text>
        <Text style={styles.depositValue}>{depositLabel}</Text>
      </View>

      <Text style={styles.routesLabel}>
        How would you like to be measured?
      </Text>
      <View style={styles.routeList}>
        {routes.map((route) => {
          const selected = route.mode === selectedMode;
          return (
            <Pressable
              key={route.mode}
              onPress={() => setSelectedMode(route.mode)}
              style={[styles.routeChip, selected && styles.routeChipActive]}
            >
              <Text
                style={[styles.routeTitle, selected && styles.routeTitleActive]}
              >
                {route.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeRoute ? (
        <View>
          <Text style={styles.helper}>{activeRoute.helper}</Text>
          {activeRoute.enabled ? (
            <ActiveRouteForm
              mode={activeRoute.mode}
              buttonLabel={activeRoute.buttonLabel}
              design={design}
              store={store}
              visitSlots={visitSlots}
              depositMinor={depositMinor}
              onOrdered={onOrdered}
            />
          ) : (
            <Text style={styles.infoNote}>{activeRoute.disabledReason}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.infoNote}>Select an option above to continue.</Text>
      )}
    </View>
  );
}

type ActiveRouteFormProps = {
  mode: CustomSizeMode;
  buttonLabel: string;
  design: Design;
  store: StoreSummary;
  visitSlots: AvailabilitySlot[];
  depositMinor: number;
  onOrdered: (order: PlaceOrderResult) => void;
};

function ActiveRouteForm({
  mode,
  buttonLabel,
  design,
  store,
  visitSlots,
  depositMinor,
  onOrdered,
}: ActiveRouteFormProps) {
  if (mode === "self_measure") {
    return (
      <DesignSelfMeasureForm
        design={design}
        store={store}
        depositMinor={depositMinor}
        buttonLabel={buttonLabel}
        onOrdered={onOrdered}
      />
    );
  }
  if (mode === "home_visit") {
    return (
      <DesignHomeVisitForm
        design={design}
        store={store}
        visitSlots={visitSlots}
        depositMinor={depositMinor}
        buttonLabel={buttonLabel}
        onOrdered={onOrdered}
      />
    );
  }
  return (
    <DesignShopReserveForm
      design={design}
      store={store}
      buttonLabel={buttonLabel}
      onOrdered={onOrdered}
    />
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    panel: {
      backgroundColor: palette.white,
      borderRadius: radius.lg,
      padding: spacing(2.5),
      marginTop: spacing(2.5),
      ...shadow.card,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 20,
      fontWeight: "700",
      color: palette.ink,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      lineHeight: 19,
      marginTop: spacing(0.5),
    },
    depositRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      backgroundColor: palette.panel,
      paddingHorizontal: spacing(1.75),
      paddingVertical: spacing(1.5),
      marginTop: spacing(2),
    },
    depositLabel: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "800",
      color: palette.ink,
    },
    depositValue: {
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: "800",
      color: palette.burgundy,
    },
    routesLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      fontWeight: "800",
      color: palette.ink,
      marginTop: spacing(2),
      marginBottom: spacing(1),
    },
    routeList: { gap: spacing(1) },
    routeChip: {
      borderWidth: 1.5,
      borderColor: palette.softBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1.5),
      backgroundColor: palette.white,
    },
    routeChipActive: {
      borderColor: palette.burgundy,
      backgroundColor: "rgba(128,0,32,0.06)",
    },
    routeTitle: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.ink,
    },
    routeTitleActive: { color: palette.burgundy },
    helper: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      lineHeight: 19,
      marginTop: spacing(1.75),
    },
    infoNote: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: palette.mutedText,
      lineHeight: 19,
      borderWidth: 1,
      borderColor: palette.softBorder,
      borderRadius: radius.sm,
      backgroundColor: palette.panel,
      padding: spacing(1.5),
      marginTop: spacing(1.75),
    },
  });
